"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { userClient } from "@/lib/supabase/server";

// Mark a lesson done, or not done. Row level security decides whether she
// may: only her own progress, only on a lesson she can open.

const input = z.object({
  lessonId: z.uuid(),
  path: z.string().regex(/^\/learn\/[a-z0-9-]+\/[a-z0-9-]+$/),
  done: z.enum(["true", "false"]),
});

export async function setLessonDone(form: FormData): Promise<void> {
  const parsed = input.safeParse({
    lessonId: form.get("lessonId"),
    path: form.get("path"),
    done: form.get("done"),
  });
  if (!parsed.success) return;
  const { lessonId, path, done } = parsed.data;
  await requireUser(path);
  const supabase = await userClient();

  if (done === "true") {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert({ lesson_id: lessonId }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
    if (error) console.error("mark done", error.message);
  } else {
    const { error } = await supabase.from("lesson_progress").delete().eq("lesson_id", lessonId);
    if (error) console.error("mark not done", error.message);
  }
  revalidatePath(path);
  revalidatePath("/learn");
}
