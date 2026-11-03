import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { sendEmail } from "./send";
import { loadTemplate } from "./templates";

// "Lesson 0.8 completed → your verdict is saved; here's what it means, with
// the next step by colour" (SPEC.md → Email). Once per person.

export const VERDICT_LESSON = "0.8";

export async function sendVerdictMeaning(
  userId: string,
  email: string,
  lessonId: string,
): Promise<void> {
  try {
    const db = serviceClient();
    const { data: lesson } = await db
      .from("lessons")
      .select("number")
      .eq("id", lessonId)
      .maybeSingle();
    if (lesson?.number !== VERDICT_LESSON || !email) return;
    const { data: verdict } = await db
      .from("verdicts")
      .select("verdict")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ verdict: "green" | "amber" | "red" }>();
    const colour = verdict?.verdict ?? "none";
    const template = await loadTemplate("verdict_meaning");
    await sendEmail(
      "verdict_meaning",
      "verdict_meaning",
      { userId, email },
      {
        verdict: colour === "none" ? "not saved yet" : colour[0]!.toUpperCase() + colour.slice(1),
        next_step: template.nextSteps[colour] ?? "",
      },
    );
  } catch (error) {
    console.error("verdict_meaning", error instanceof Error ? error.message : error);
  }
}
