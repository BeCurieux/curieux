// Which family a model call was for, without threading it through everything.
//
// The AIProvider interface is deliberately ignorant of the business: it takes
// memories and returns drafts, and it does not know about families, plans or
// bills. Adding a familyId parameter to all six methods to make accounting
// work would put billing into the one seam that was kept clean of it, and
// every future method would have to remember.
//
// So the family is ambient. A job wraps its work in meter(), the provider
// reports token usage to whatever meter is current, and the row is written
// when the scope closes. AsyncLocalStorage is the right tool for exactly
// this: a value that belongs to a call tree rather than to an argument list.
//
// ## The part that makes it un-forgettable
//
// spend() throws when there is no meter. A provider call outside a metered
// scope is not "unmetered", it is a bug, and it fails at the first line of
// the first call rather than showing up as an unexplained invoice at the end
// of the month. That is the whole reason to build this rather than to write
// `await log(...)` after each call site and hope.
//
// The mock provider does not spend, so tests and development are unaffected.

import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVERYBODY_DAILY, FAMILY_MONTHLY, costOf, mayCall, type Refusal } from "./cost";

/** What a model call was for. Coarse — never a prompt, never a memory. */
export type CallKind =
  | "analyse"
  | "cluster"
  | "questions"
  | "structure"
  | "copy"
  | "edit";

interface Scope {
  familyId: string | null;
  kind: CallKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

const store = new AsyncLocalStorage<Scope>();

/**
 * Report what a call used.
 *
 * Called by the provider at its one chokepoint. Throws outside a meter,
 * deliberately: see the note above.
 */
export function spend(model: string, inputTokens: number, outputTokens: number): void {
  const scope = store.getStore();
  if (!scope) {
    throw new Error(
      "an AI call was made outside a metered scope — wrap it in meter() so it is counted"
    );
  }
  scope.model = model;
  scope.inputTokens += Math.max(0, inputTokens);
  scope.outputTokens += Math.max(0, outputTokens);
  scope.calls += 1;
}

/** Whether a meter is currently open. For tests and for guards. */
export const metered = () => store.getStore() !== undefined;

export class OverBudget extends Error {
  constructor(public readonly because: Refusal) {
    super(`refused: ${because}`);
  }
}

/** What has been spent, from the database. */
export async function spentSoFar(
  db: SupabaseClient,
  familyId: string | null
): Promise<{ familyMonth: number; everybodyToday: number }> {
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [family, everybody] = await Promise.all([
    familyId
      ? db.from("ai_calls").select("cost").eq("family_id", familyId).gte("created_at", monthAgo)
      : Promise.resolve({ data: [] as any[] }),
    db.from("ai_calls").select("cost").gte("created_at", dayAgo),
  ]);

  const sum = (rows: any[]) => rows.reduce((n, r) => n + Number(r.cost ?? 0), 0);
  return {
    familyMonth: sum((family as any).data ?? []),
    everybodyToday: sum((everybody as any).data ?? []),
  };
}

/**
 * Run some work with a meter open, and write down what it cost.
 *
 * Checks the ceilings before starting rather than after: a refusal that
 * arrives once the money is spent is a receipt, not a control.
 *
 * The row is written even when the work throws. A failed job that burned
 * forty thousand tokens still burned them, and a cost log that only records
 * successes is one that under-reports precisely when something is going
 * wrong.
 */
export async function meter<T>(
  db: SupabaseClient,
  input: { familyId: string | null; kind: CallKind },
  work: () => Promise<T>
): Promise<T> {
  // A budget we cannot read is treated as spent, and this is the opposite
  // of the call storage/usage.ts makes for the same situation — deliberately.
  //
  // There, a family we cannot read is treated as having room, because the
  // failure mode of guessing "full" is refusing somebody's photographs
  // during our own outage, in front of them, while they wait.
  //
  // Here nobody is waiting in front of anything: these are background jobs
  // that retry. Failing open on a *spending* ceiling during an outage is how
  // a retry storm becomes an invoice, and an outage is exactly when retry
  // storms happen. So the read failing is a refusal, not a crash and not a
  // free pass.
  let budget: { familyMonth: number; everybodyToday: number };
  try {
    budget = await spentSoFar(db, input.familyId);
  } catch {
    throw new OverBudget("everybody over budget");
  }

  const allowed = mayCall(budget);
  if (!allowed.ok) {
    // Recorded, with no tokens against it. A refusal that leaves no trace is
    // indistinguishable from nothing having been attempted, which is exactly
    // what somebody wondering why a book never generated needs to know.
    await write(db, {
      familyId: input.familyId,
      kind: input.kind,
      model: "none",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      refused: allowed.because ?? null,
    });
    throw new OverBudget(allowed.because!);
  }

  const scope: Scope = {
    familyId: input.familyId,
    kind: input.kind,
    model: "none",
    inputTokens: 0,
    outputTokens: 0,
    calls: 0,
  };

  try {
    return await store.run(scope, work);
  } finally {
    if (scope.calls > 0) {
      await write(db, {
        familyId: scope.familyId,
        kind: scope.kind,
        model: scope.model,
        inputTokens: scope.inputTokens,
        outputTokens: scope.outputTokens,
        cost: costOf(scope.model, scope.inputTokens, scope.outputTokens),
        refused: null,
      });
    }
  }
}

async function write(
  db: SupabaseClient,
  row: {
    familyId: string | null;
    kind: CallKind;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    refused: Refusal | null;
  }
): Promise<void> {
  try {
    await db.from("ai_calls").insert({
      family_id: row.familyId,
      kind: row.kind,
      model: row.model,
      input_tokens: row.inputTokens,
      output_tokens: row.outputTokens,
      cost: row.cost,
      refused: row.refused,
    });
  } catch {
    // Never fail the work being measured. The same call the activity log and
    // the analytics writer both make, for the same reason.
  }
}

export { EVERYBODY_DAILY, FAMILY_MONTHLY };
