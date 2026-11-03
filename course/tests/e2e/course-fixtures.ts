import { service } from "./helpers";

// Test-only lessons beside the real placeholders, so gating can be seen:
//
//   module 90 "e2e-module"   90.1 module0 (YouTube video + script)
//                            90.2 course  (with a download)
//   module 91 "e2e-library"  91.1 course, opens with the benchmark pack (download)
//
// Removed again after the tests. Numbers 90+ stay clear of real modules.

export const FIXTURE = {
  videoId: "e2eVideo123",
  lockedScript: "E2E-SECRET-SCRIPT: only Module 0 buyers read this.",
  courseScript: "E2E-COURSE-SCRIPT",
  file: { path: "e2e/benchmarks.csv", body: "metric,value\nmargin,55\n" },
};

export interface Fixture {
  m0Lesson: string;
  courseAsset: string;
  libraryAsset: string;
}

const check = <T>(
  result: { data: T | null; error: { message: string } | null },
  what: string,
): T => {
  if (result.error || result.data === null)
    throw new Error(`${what}: ${result.error?.message ?? "no data"}`);
  return result.data;
};

export async function removeCourseFixtures() {
  const { error } = await service
    .from("modules")
    .delete()
    .in("slug", ["e2e-module", "e2e-library"]);
  if (error) throw new Error(`remove fixtures: ${error.message}`);
  await service.storage.from("lesson-assets").remove([FIXTURE.file.path]);
}

export async function createCourseFixtures(): Promise<Fixture> {
  await removeCourseFixtures();
  const modules = check(
    await service
      .from("modules")
      .insert(
        [
          { slug: "e2e-module", number: 90, title: "E2E module", position: 90 },
          { slug: "e2e-library", number: 91, title: "E2E library", position: 91, hidden: true },
        ],
        { defaultToNull: false },
      )
      .select("id, slug"),
    "fixture modules",
  );
  const id = (slug: string) => modules.find((m) => m.slug === slug)!.id as string;
  const lessons = check(
    await service
      .from("lessons")
      .insert(
        [
          {
            module_id: id("e2e-module"),
            slug: "m0-lesson",
            number: "90.1",
            title: "A Module 0 lesson",
            min_tier: "module0",
            position: 1,
            video_provider: "youtube",
            video_id: FIXTURE.videoId,
            duration_sec: 300,
            script_md: `## Script\n\n${FIXTURE.lockedScript}`,
            example: true,
          },
          {
            module_id: id("e2e-module"),
            slug: "course-lesson",
            number: "90.2",
            title: "A course lesson",
            min_tier: "course",
            position: 2,
            script_md: FIXTURE.courseScript,
          },
          {
            module_id: id("e2e-library"),
            slug: "benchmarks",
            number: "91.1",
            title: "Benchmark sheets",
            min_tier: "course",
            position: 1,
            opens_with_benchmark_pack: true,
            script_md: "The benchmark sheets.",
          },
        ],
        { defaultToNull: false },
      )
      .select("id, slug"),
    "fixture lessons",
  );
  const lessonId = (slug: string) => lessons.find((l) => l.slug === slug)!.id as string;
  const assets = check(
    await service
      .from("lesson_assets")
      .insert([
        {
          lesson_id: lessonId("course-lesson"),
          label: "Course sheet",
          storage_path: FIXTURE.file.path,
          kind: "sheet",
        },
        {
          lesson_id: lessonId("benchmarks"),
          label: "Benchmark sheet",
          storage_path: FIXTURE.file.path,
          kind: "sheet",
        },
      ])
      .select("id, label"),
    "fixture assets",
  );
  check(
    await service.storage
      .from("lesson-assets")
      .upload(FIXTURE.file.path, new Blob([FIXTURE.file.body], { type: "text/csv" }), {
        upsert: true,
      }),
    "fixture file",
  );
  return {
    m0Lesson: lessonId("m0-lesson"),
    courseAsset: assets.find((a) => a.label === "Course sheet")!.id as string,
    libraryAsset: assets.find((a) => a.label === "Benchmark sheet")!.id as string,
  };
}

/** A hand grant, as the webhook or admin will make them. */
export async function grant(email: string, tiers: string[]) {
  const profile = await service
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .single<{ user_id: string }>();
  if (profile.error) throw new Error(`profile: ${profile.error.message}`);
  const { error } = await service
    .from("entitlements")
    .insert(tiers.map((tier) => ({ user_id: profile.data.user_id, tier })));
  if (error) throw new Error(`grant: ${error.message}`);
}
