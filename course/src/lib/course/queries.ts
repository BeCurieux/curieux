import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessTier } from "./tiers";
import type { Access, OutlineLesson, OutlineModule } from "./outline";
import { sortOutline } from "./outline";

// Reads for the course pages, as the signed-in person (row level security
// applies). Lesson columns are named one by one: video ids and scripts are
// closed to the API and come only from lesson_content().

const LESSON_COLUMNS =
  "id, module_id, slug, number, title, summary, min_tier, opens_with_benchmark_pack, video_provider, duration_sec, example, position";

export async function loadOutline(supabase: SupabaseClient): Promise<OutlineModule[]> {
  const [modules, lessons] = await Promise.all([
    supabase.from("modules").select("id, slug, number, title, summary, hidden, position"),
    supabase.from("lessons").select(LESSON_COLUMNS),
  ]);
  if (modules.error) throw new Error(`modules: ${modules.error.message}`);
  if (lessons.error) throw new Error(`lessons: ${lessons.error.message}`);
  const byModule = new Map<string, OutlineLesson[]>();
  for (const { module_id, ...lesson } of lessons.data as (OutlineLesson & {
    module_id: string;
  })[]) {
    byModule.set(module_id, [...(byModule.get(module_id) ?? []), lesson]);
  }
  return sortOutline(
    (modules.data as Omit<OutlineModule, "lessons">[]).map((mod) => ({
      ...mod,
      lessons: byModule.get(mod.id) ?? [],
    })),
  );
}

export async function loadAccess(supabase: SupabaseClient): Promise<Access> {
  const [tier, pack] = await Promise.all([
    supabase.rpc("my_tier"),
    supabase.rpc("my_benchmark_pack"),
  ]);
  if (tier.error) throw new Error(`my_tier: ${tier.error.message}`);
  if (pack.error) throw new Error(`my_benchmark_pack: ${pack.error.message}`);
  return { tier: tier.data as AccessTier, benchmarkPack: pack.data === true };
}

export async function loadDone(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from("lesson_progress").select("lesson_id");
  if (error) throw new Error(`lesson_progress: ${error.message}`);
  return new Set(data.map((row) => row.lesson_id as string));
}
