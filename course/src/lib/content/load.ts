import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

// Reads the course from /content/modules (SPEC.md → Content loading):
//
//   content/modules/<module-slug>/_module.md   the module: number, title, summary, hidden
//   content/modules/<module-slug>/<lesson>.md  one lesson: frontmatter, then the script
//
// Pure apart from reading files, so the seed script and the unit tests share
// it. Pages never read these files: they read the database the seed fills.

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase letters, numbers and single hyphens");

// "12:30", "1:02:03" or a number of seconds.
const duration = z.union(
  [
    z.number().int().nonnegative(),
    z
      .string()
      .regex(/^(\d+:)?\d{1,2}:\d{2}$/)
      .transform((value) => value.split(":").reduce((total, part) => total * 60 + Number(part), 0)),
  ],
  { error: 'write durations as "m:ss", "h:mm:ss" or a number of seconds' },
);

const assetSchema = z.object({
  label: z.string().min(1),
  // A path inside the private lesson-assets bucket, e.g. "module-0/landed-cost.xlsx".
  path: z
    .string()
    .min(1)
    .refine((value) => !value.startsWith("/") && !value.split("/").includes(".."), {
      message: "a path inside the lesson-assets bucket, without a leading / or ..",
    }),
  kind: z.enum(["sheet", "pdf", "template"]),
});

const moduleSchema = z.object({
  number: z.number().int().nonnegative(),
  title: z.string().min(1),
  summary: z.string().default(""),
  hidden: z.boolean().default(false),
});

const lessonSchema = z
  .object({
    number: z
      .union([z.string(), z.number()])
      .transform(String)
      .pipe(z.string().regex(/^\d+\.\d+$/, 'like "0.1"')),
    title: z.string().min(1),
    summary: z.string().default(""),
    min_tier: z.enum(["free", "module0", "course"]),
    video_provider: z.enum(["bunny", "youtube"]).nullish(),
    video_id: z.string().min(1).nullish(),
    duration: duration.nullish(),
    assets: z.array(assetSchema).default([]),
    example: z.boolean().default(false),
    // Library lessons with the benchmark sheets: also open with the pack alone.
    opens_with_benchmark_pack: z.boolean().default(false),
  })
  .refine((lesson) => Boolean(lesson.video_provider) === Boolean(lesson.video_id), {
    message: "video_provider and video_id go together: set both or neither",
    path: ["video_id"],
  });

export interface ContentAsset {
  label: string;
  storage_path: string;
  kind: "sheet" | "pdf" | "template";
}

export interface ContentLesson {
  slug: string;
  number: string;
  title: string;
  summary: string;
  min_tier: "free" | "module0" | "course";
  video_provider: "bunny" | "youtube" | null;
  video_id: string | null;
  duration_sec: number | null;
  position: number;
  script_md: string;
  example: boolean;
  opens_with_benchmark_pack: boolean;
  assets: ContentAsset[];
}

export interface ContentModule {
  slug: string;
  number: number;
  title: string;
  summary: string;
  position: number;
  hidden: boolean;
  lessons: ContentLesson[];
}

export class ContentError extends Error {
  constructor(readonly problems: string[]) {
    super(`The course content has ${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  }
}

/** Splits "---\nyaml\n---\nbody" into its frontmatter and body. */
export function splitFrontmatter(source: string): { data: unknown; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source.replace(/^﻿/, ""));
  if (!match) return { data: undefined, body: source };
  return { data: parseYaml(match[1]!) ?? {}, body: match[2]! };
}

const describe = (error: z.ZodError) =>
  error.issues
    .map((issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`)
    .join("; ");

/** Parses one lesson file. `file` names it in error messages. */
export function parseLesson(
  file: string,
  lessonSlug: string,
  source: string,
  moduleNumber: number,
) {
  const problems: string[] = [];
  if (!slug.safeParse(lessonSlug).success)
    problems.push(`${file}: the file name must be lowercase-with-hyphens.md`);
  const { data, body } = splitFrontmatter(source);
  if (data === undefined)
    return { problems: [...problems, `${file}: no frontmatter (start the file with ---)`] };
  const parsed = lessonSchema.safeParse(data);
  if (!parsed.success) return { problems: [...problems, `${file}: ${describe(parsed.error)}`] };
  const lesson = parsed.data;
  const [major, minor] = lesson.number.split(".").map(Number) as [number, number];
  if (major !== moduleNumber)
    problems.push(`${file}: lesson ${lesson.number} is in module ${moduleNumber}'s folder`);
  if (problems.length) return { problems };
  const value: ContentLesson = {
    slug: lessonSlug,
    number: lesson.number,
    title: lesson.title,
    summary: lesson.summary,
    min_tier: lesson.min_tier,
    video_provider: lesson.video_provider ?? null,
    video_id: lesson.video_id ?? null,
    duration_sec: lesson.duration ?? null,
    position: minor,
    script_md: body.trim(),
    example: lesson.example,
    opens_with_benchmark_pack: lesson.opens_with_benchmark_pack,
    assets: lesson.assets.map((asset) => ({
      label: asset.label,
      storage_path: asset.path,
      kind: asset.kind,
    })),
  };
  return { problems, value };
}

/** Parses one module's _module.md. */
export function parseModule(file: string, moduleSlug: string, source: string) {
  if (!slug.safeParse(moduleSlug).success)
    return { problems: [`${file}: the folder name must be lowercase-with-hyphens`] };
  const { data } = splitFrontmatter(source);
  const parsed = moduleSchema.safeParse(data ?? {});
  if (!parsed.success) return { problems: [`${file}: ${describe(parsed.error)}`] };
  return { problems: [] as string[], value: parsed.data };
}

/**
 * Reads and checks the whole course. Throws ContentError listing every
 * problem at once, so one run tells her everything to fix.
 */
export async function loadContent(root: string): Promise<ContentModule[]> {
  const modulesDir = path.join(root, "modules");
  const problems: string[] = [];
  const modules: ContentModule[] = [];

  const folders = (await readdir(modulesDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const folder of folders) {
    const dir = path.join(modulesDir, folder);
    const relative = (name: string) => path.join("content/modules", folder, name);
    let moduleSource: string;
    try {
      moduleSource = await readFile(path.join(dir, "_module.md"), "utf8");
    } catch {
      problems.push(`${relative("_module.md")}: missing (every module folder needs one)`);
      continue;
    }
    const mod = parseModule(relative("_module.md"), folder, moduleSource);
    problems.push(...mod.problems);
    if (!mod.value) continue;

    const lessons: ContentLesson[] = [];
    const files = (await readdir(dir))
      .filter((name) => name.endsWith(".md") && name !== "_module.md")
      .sort();
    for (const name of files) {
      const lesson = parseLesson(
        relative(name),
        name.slice(0, -3),
        await readFile(path.join(dir, name), "utf8"),
        mod.value.number,
      );
      problems.push(...lesson.problems);
      if (lesson.value) lessons.push(lesson.value);
    }
    lessons.sort((a, b) => a.position - b.position);
    modules.push({ slug: folder, ...mod.value, position: mod.value.number, lessons });
  }

  // Uniqueness the database would otherwise reject halfway through a seed.
  const seen = (label: string, values: string[]) => {
    const dupes = values.filter((value, i) => values.indexOf(value) !== i);
    for (const value of new Set(dupes)) problems.push(`${label} ${value} is used more than once`);
  };
  seen(
    "module number",
    modules.map((m) => String(m.number)),
  );
  seen(
    "lesson number",
    modules.flatMap((m) => m.lessons.map((l) => l.number)),
  );

  if (problems.length) throw new ContentError(problems);
  return modules.sort((a, b) => a.position - b.position);
}
