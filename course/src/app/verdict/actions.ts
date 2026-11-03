"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { judge } from "@/lib/calc/product-verdict";
import { latestRun, myCurrency } from "@/lib/calc/runs";
import { currentUser } from "@/lib/auth/session";
import { userClient } from "@/lib/supabase/server";

// Saving a Product Verdict. Margin and break-even are read here, on the
// server, from her latest Unit Economics run, never taken from the browser;
// she supplies only the product name and the three yes/no answers. Row
// level security allows verdicts from Module 0 up, and sending one for
// review only for founding members.

const answers = z.object({
  product_name: z.string().trim().min(1, "Name the product.").max(200),
  demand_signal: z.boolean(),
  compliance_done: z.boolean(),
  cash_covers_first_order: z.boolean(),
});

export type VerdictSaveResult = { status: "saved" } | { status: "error"; message: string };

export async function saveVerdict(raw: unknown): Promise<VerdictSaveResult> {
  if (!(await currentUser()))
    return { status: "error", message: "You're signed out. Sign in again." };
  const parsed = answers.safeParse(raw);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]!.message };
  const supabase = await userClient();
  const unit = await latestRun(supabase, "unit-economics");
  if (!unit)
    return { status: "error", message: "Run Unit Economics first: the verdict starts from it." };

  const margin_pct = Number(unit.outputs_json.margin_pct);
  const breakEven = unit.outputs_json.break_even_units;
  const facts = {
    margin_pct,
    break_even_units: typeof breakEven === "number" ? breakEven : null,
    demand_signal: parsed.data.demand_signal,
    compliance_done: parsed.data.compliance_done,
    cash_covers_first_order: parsed.data.cash_covers_first_order,
  };
  const result = judge(facts);

  const { error } = await supabase.from("verdicts").insert({
    product_name: parsed.data.product_name,
    verdict: result.verdict,
    reasons_json: { reasons: result.reasons, to_green: result.to_green, facts },
  });
  if (error) {
    console.error("saveVerdict", error.message);
    return { status: "error", message: "Couldn't save the verdict just now. Try again." };
  }
  // The verdict is also a run of the Product Verdict calculator, so it shows
  // as her latest like any other tool.
  const { error: runError } = await supabase.from("calc_runs").insert({
    calculator_slug: "product-verdict",
    currency: await myCurrency(supabase),
    inputs_json: { product_name: parsed.data.product_name, ...facts },
    outputs_json: result,
    verdict: result.verdict,
  });
  if (runError) console.error("saveVerdict run", runError.message);
  revalidatePath("/verdict");
  return { status: "saved" };
}

export async function sendForReview(form: FormData): Promise<void> {
  const id = z.uuid().safeParse(form.get("verdictId"));
  if (!id.success || !(await currentUser())) return;
  const supabase = await userClient();
  const { error } = await supabase
    .from("verdicts")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", id.data)
    .is("submitted_at", null);
  if (error) console.error("sendForReview", error.message);
  revalidatePath("/verdict");
}
