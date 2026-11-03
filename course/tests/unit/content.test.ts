import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContentError, loadContent, parseLesson, splitFrontmatter } from "@/lib/content/load";

const lesson = (frontmatter: string, body = "The script.") =>
  `---\n${frontmatter}\n---\n\n${body}\n`;

describe("splitFrontmatter", () => {
  it("separates the YAML from the body", () => {
    expect(splitFrontmatter("---\ntitle: Hi\n---\nBody\n")).toEqual({
      data: { title: "Hi" },
      body: "Body\n",
    });
  });
  it("reports a file without frontmatter", () => {
    expect(splitFrontmatter("Just text").data).toBeUndefined();
  });
});

describe("parseLesson", () => {
  it("reads every frontmatter field the spec lists", () => {
    const { value, problems } = parseLesson(
      "x.md",
      "landed-cost",
      lesson(
        [
          'number: "0.3"',
          "title: Landed cost",
          "summary: What it really costs",
          "min_tier: module0",
          "video_provider: bunny",
          "video_id: abc-123",
          'duration: "12:05"',
          "example: true",
          "assets:",
          "  - { label: Landed cost sheet, path: module-0/landed-cost.xlsx, kind: sheet }",
        ].join("\n"),
        "## Heading\n\nScript text.",
      ),
      0,
    );
    expect(problems).toEqual([]);
    expect(value).toEqual({
      slug: "landed-cost",
      number: "0.3",
      title: "Landed cost",
      summary: "What it really costs",
      min_tier: "module0",
      video_provider: "bunny",
      video_id: "abc-123",
      duration_sec: 725,
      position: 3,
      script_md: "## Heading\n\nScript text.",
      example: true,
      opens_with_benchmark_pack: false,
      assets: [
        { label: "Landed cost sheet", storage_path: "module-0/landed-cost.xlsx", kind: "sheet" },
      ],
    });
  });

  it("orders 0.10 after 0.9, not after 0.1", () => {
    const at = (n: string) =>
      parseLesson("x.md", "x", lesson(`number: "${n}"\ntitle: X\nmin_tier: free`), 0).value!
        .position;
    expect(at("0.10")).toBeGreaterThan(at("0.9"));
  });

  it("accepts seconds or h:mm:ss for duration, and no video at all", () => {
    const parse = (extra: string) =>
      parseLesson("x.md", "x", lesson(`number: "1.1"\ntitle: X\nmin_tier: course\n${extra}`), 1)
        .value!;
    expect(parse("duration: 90").duration_sec).toBe(90);
    expect(parse('duration: "1:02:03"').duration_sec).toBe(3723);
    expect(parse("").video_provider).toBeNull();
  });

  it("explains each mistake in words", () => {
    const problems = (frontmatter: string, slug = "ok", moduleNumber = 0) =>
      parseLesson("content/modules/m/x.md", slug, lesson(frontmatter), moduleNumber).problems.join(
        " ",
      );
    expect(problems('number: "0.1"\ntitle: X\nmin_tier: founding')).toMatch(/min_tier/);
    expect(problems('number: "0.1"\ntitle: X\nmin_tier: free\nvideo_provider: bunny')).toMatch(
      /set both or neither/,
    );
    expect(problems('number: "1.1"\ntitle: X\nmin_tier: free')).toMatch(/module 0's folder/);
    expect(problems('number: "0.1"\ntitle: X\nmin_tier: free\nduration: soon')).toMatch(/m:ss/);
    expect(problems('number: "0.1"\ntitle: X\nmin_tier: free', "Bad Name")).toMatch(/lowercase/);
    expect(
      problems(
        'number: "0.1"\ntitle: X\nmin_tier: free\nassets:\n  - { label: A, path: ../secret.pdf, kind: pdf }',
      ),
    ).toMatch(/inside the lesson-assets bucket/);
    expect(parseLesson("x.md", "x", "No frontmatter", 0).problems[0]).toMatch(/no frontmatter/);
  });
});

describe("loadContent", () => {
  let root: string;
  afterEach(() => rm(root, { recursive: true, force: true }));

  async function course(files: Record<string, string>) {
    root = await mkdtemp(path.join(os.tmpdir(), "content-"));
    for (const [name, source] of Object.entries(files)) {
      const file = path.join(root, "modules", name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, source);
    }
    return root;
  }

  it("reads modules and lessons in order, including a hidden library", async () => {
    const modules = await loadContent(
      await course({
        "module-1/_module.md": "---\nnumber: 1\ntitle: One\n---\n",
        "module-1/b.md": lesson('number: "1.2"\ntitle: B\nmin_tier: course'),
        "module-1/a.md": lesson('number: "1.1"\ntitle: A\nmin_tier: course'),
        "module-0/_module.md": "---\nnumber: 0\ntitle: Zero\n---\n",
        "module-0/x.md": lesson('number: "0.1"\ntitle: X\nmin_tier: free'),
        "library/_module.md": "---\nnumber: 9\ntitle: Library\nhidden: true\n---\n",
      }),
    );
    expect(modules.map((m) => [m.slug, m.position, m.hidden])).toEqual([
      ["module-0", 0, false],
      ["module-1", 1, false],
      ["library", 9, true],
    ]);
    expect(modules[1]!.lessons.map((l) => l.number)).toEqual(["1.1", "1.2"]);
  });

  it("lists every problem at once", async () => {
    const error = await loadContent(
      await course({
        "module-0/_module.md": "---\nnumber: 0\ntitle: Zero\n---\n",
        "module-0/a.md": lesson('number: "0.1"\ntitle: A\nmin_tier: free'),
        "module-0/b.md": lesson('number: "0.1"\ntitle: B\nmin_tier: free'),
        "module-0/c.md": lesson('number: "0.3"\nmin_tier: free'),
        "module-1/x.md": lesson('number: "1.1"\ntitle: X\nmin_tier: free'),
      }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentError);
    const problems = (error as ContentError).problems.join("\n");
    expect(problems).toMatch(/lesson number 0.1 is used more than once/);
    expect(problems).toMatch(/c\.md: title/);
    expect(problems).toMatch(/module-1\/_module\.md: missing/);
  });

  it("accepts the course's own content", async () => {
    const modules = await loadContent(path.resolve(import.meta.dirname, "../../content"));
    const zero = modules.find((m) => m.number === 0)!;
    expect(zero.lessons.map((l) => [l.number, l.min_tier])).toEqual([
      ["0.1", "free"],
      ["0.2", "free"],
    ]);
  });
});
