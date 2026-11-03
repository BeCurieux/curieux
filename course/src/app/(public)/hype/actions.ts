"use server";

import { MAX_LENGTH, MIN_LENGTH, redact, scoreHype, type HypeResult } from "@/lib/hype/score";
import { serviceClient } from "@/lib/supabase/server";

export type HypeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; result: HypeResult };

// Scores the post with the keyword rubric (no AI call, so it's free to run)
// and logs an anonymised copy for tuning. Logging never blocks the result.
export async function runHypeCheck(_prev: HypeState, form: FormData): Promise<HypeState> {
  const text = String(form.get("post") ?? "").trim();
  if (text.length < MIN_LENGTH)
    return { status: "error", message: "Paste a little more: at least a sentence or two." };
  if (text.length > MAX_LENGTH)
    return {
      status: "error",
      message: `That's long. Paste up to ${MAX_LENGTH.toLocaleString()} characters.`,
    };
  const result = scoreHype(text);
  const { error } = await serviceClient()
    .from("hype_checks")
    .insert({
      text_redacted: redact(text),
      score: result.score,
      signals: { signals: result.signals.map((s) => s.id), leaves_out: result.leavesOut },
      rubric_version: result.rubricVersion,
    });
  if (error) console.error("hype log", error.message);
  return { status: "done", result };
}
