import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currencyFor, type Currency } from "./format";
import type { Inputs, Outputs } from "./types";

// Her saved runs, read as her (row level security: her own rows only).

export interface Run {
  id: string;
  calculator_slug: string;
  currency: Currency;
  inputs_json: Inputs;
  outputs_json: Outputs;
  verdict: string | null;
  created_at: string;
}

export async function latestRun(supabase: SupabaseClient, slug: string): Promise<Run | null> {
  const { data, error } = await supabase
    .from("calc_runs")
    .select("id, calculator_slug, currency, inputs_json, outputs_json, verdict, created_at")
    .eq("calculator_slug", slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Run>();
  if (error) throw new Error(`calc_runs: ${error.message}`);
  return data;
}

/** AUD for Australia (and when we don't know), USD everywhere else. */
export async function myCurrency(supabase: SupabaseClient): Promise<Currency> {
  const { data } = await supabase
    .from("profiles")
    .select("country")
    .maybeSingle<{ country: string | null }>();
  return currencyFor(data?.country);
}
