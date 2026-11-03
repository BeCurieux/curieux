"use server";

import { calculator } from "@/lib/calc";
import { myCurrency } from "@/lib/calc/runs";
import { parseInputs } from "@/lib/calc/types";
import { currentUser } from "@/lib/auth/session";
import { userClient } from "@/lib/supabase/server";

// Autosave for /tools/[slug]. The browser shows results as she types; this
// re-checks her inputs and recomputes on the server, so a saved run's
// results never come from the browser. Row level security refuses a run on
// a calculator her tier doesn't reach.

export type SaveResult =
  | { status: "saved"; savedAt: string }
  | { status: "unchanged" }
  | { status: "invalid"; problems: string[] }
  | { status: "error"; message: string };

export async function saveRun(slug: string, raw: unknown): Promise<SaveResult> {
  const user = await currentUser();
  if (!user)
    return { status: "error", message: "You're signed out. Sign in again to keep saving." };
  const calc = calculator(slug);
  // The verdict is saved from /verdict, which reads her own runs itself.
  if (!calc || calc.slug === "product-verdict")
    return { status: "error", message: "Unknown calculator." };

  const parsed = parseInputs(calc, raw);
  if (!parsed.ok) return { status: "invalid", problems: parsed.problems };
  const outputs = calc.compute(parsed.inputs);

  const supabase = await userClient();
  const { data: last } = await supabase
    .from("calc_runs")
    .select("inputs_json")
    .eq("calculator_slug", slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && JSON.stringify(last.inputs_json) === JSON.stringify(parsed.inputs))
    return { status: "unchanged" };

  const { data, error } = await supabase
    .from("calc_runs")
    .insert({
      calculator_slug: slug,
      currency: await myCurrency(supabase),
      inputs_json: parsed.inputs,
      outputs_json: outputs,
      verdict: calc.verdict?.(outputs) ?? null,
    })
    .select("created_at")
    .single();
  if (error) {
    console.error("saveRun", slug, error.message);
    return {
      status: "error",
      message: "Couldn't save just now. Your numbers are still here; we'll try again.",
    };
  }
  return { status: "saved", savedAt: data.created_at as string };
}
