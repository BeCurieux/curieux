// Loads /content into the database: `npm run content:seed`
//
// Reads every module and lesson file, checks them all, then creates or
// updates the matching rows. Safe to run as often as you like: unchanged
// lessons stay as they are, and nobody's progress is touched.
//
// Lessons or modules that are in the database but no longer in /content are
// listed, not deleted, because deleting a lesson deletes everyone's progress
// on it. Run with --prune to delete them.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (environment or
// .env.local). Against production, run it with production's values.

import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ContentError, loadContent } from "../src/lib/content/load";

const prune = process.argv.includes("--prune");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or put them in .env.local).",
  );
  process.exit(1);
}
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function fail(what: string, error: { message: string } | null): asserts error is null {
  if (error) {
    console.error(`${what}: ${error.message}`);
    process.exit(1);
  }
}

let modules;
try {
  modules = await loadContent(path.resolve(import.meta.dirname, "../content"));
} catch (error) {
  if (error instanceof ContentError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const keptLessonIds = new Set<string>();
const keptModuleIds = new Set<string>();
const missingFiles: string[] = [];
let lessonCount = 0;

for (const mod of modules) {
  const { lessons, ...row } = mod;
  const { data: saved, error } = await db
    .from("modules")
    .upsert(row, { onConflict: "slug" })
    .select("id")
    .single();
  fail(`module ${mod.slug}`, error);
  keptModuleIds.add(saved.id);

  for (const lesson of lessons) {
    const { assets, ...lessonRow } = lesson;
    const { data: savedLesson, error: lessonError } = await db
      .from("lessons")
      .upsert({ ...lessonRow, module_id: saved.id }, { onConflict: "module_id,slug" })
      .select("id")
      .single();
    fail(`lesson ${lesson.number}`, lessonError);
    keptLessonIds.add(savedLesson.id);
    lessonCount += 1;

    // Assets keep their ids (and so their download links) while their path
    // stays the same; a changed label or kind is updated in place.
    const { data: existing, error: assetError } = await db
      .from("lesson_assets")
      .select("id, storage_path")
      .eq("lesson_id", savedLesson.id);
    fail(`assets for ${lesson.number}`, assetError);
    const byPath = new Map(existing.map((a) => [a.storage_path as string, a.id as string]));
    for (const asset of assets) {
      const id = byPath.get(asset.storage_path);
      const { error: saveError } = id
        ? await db.from("lesson_assets").update(asset).eq("id", id)
        : await db.from("lesson_assets").insert({ ...asset, lesson_id: savedLesson.id });
      fail(`asset ${asset.storage_path}`, saveError);
      byPath.delete(asset.storage_path);

      // Is the file actually in the bucket?
      const folder = path.posix.dirname(asset.storage_path);
      const { data: listed } = await db.storage
        .from("lesson-assets")
        .list(folder === "." ? "" : folder, { search: path.posix.basename(asset.storage_path) });
      if (!listed?.some((file) => file.name === path.posix.basename(asset.storage_path)))
        missingFiles.push(`${asset.storage_path} (lesson ${lesson.number})`);
    }
    // Assets removed from the frontmatter go: they hold no one's data.
    if (byPath.size) {
      const { error: deleteError } = await db
        .from("lesson_assets")
        .delete()
        .in("id", [...byPath.values()]);
      fail(`removing old assets for ${lesson.number}`, deleteError);
    }
  }
}

const { data: allLessons, error: listError } = await db.from("lessons").select("id, number, title");
fail("listing lessons", listError);
const { data: allModules, error: listModulesError } = await db.from("modules").select("id, slug");
fail("listing modules", listModulesError);
const staleLessons = allLessons.filter((lesson) => !keptLessonIds.has(lesson.id));
const staleModules = allModules.filter((mod) => !keptModuleIds.has(mod.id));

console.log(`Seeded ${modules.length} module(s) and ${lessonCount} lesson(s).`);
if (missingFiles.length) {
  console.warn(`\nNot in the lesson-assets bucket yet (upload them, or the download links fail):`);
  for (const file of missingFiles) console.warn(`  ${file}`);
}
if (staleLessons.length || staleModules.length) {
  if (prune) {
    if (staleLessons.length)
      fail(
        "pruning lessons",
        (
          await db
            .from("lessons")
            .delete()
            .in(
              "id",
              staleLessons.map((l) => l.id),
            )
        ).error,
      );
    if (staleModules.length)
      fail(
        "pruning modules",
        (
          await db
            .from("modules")
            .delete()
            .in(
              "id",
              staleModules.map((m) => m.id),
            )
        ).error,
      );
    console.log(
      `Deleted ${staleLessons.length} lesson(s) and ${staleModules.length} module(s) no longer in /content.`,
    );
  } else {
    console.warn(
      `\nIn the database but not in /content (run with --prune to delete them and their progress):`,
    );
    for (const lesson of staleLessons) console.warn(`  lesson ${lesson.number} ${lesson.title}`);
    for (const mod of staleModules) console.warn(`  module ${mod.slug}`);
  }
}
