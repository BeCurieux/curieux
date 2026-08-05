// Smart questions (brief §10): only what the photos can't explain.
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { answerQuestion } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();
  const { data: questions } = await db
    .from("follow_up_questions")
    .select("*")
    .eq("subject_id", params.subjectId)
    .order("created_at");

  const pending = (questions ?? []).filter((q) => q.status === "pending");
  const answered = (questions ?? []).filter((q) => q.status === "answered");

  return (
    <div className="py-10">
      <h1 className="text-3xl">A few things we couldn&rsquo;t tell from the photos</h1>
      <p className="mt-2 text-sm text-stone">
        Answer what you like, skip what you don&rsquo;t. Never more than five.
      </p>

      <div className="mt-8 space-y-4">
        {pending.map((q) => (
          <div key={q.id} className="card">
            <p className="font-display text-lg">{q.question}</p>
            <form action={answerQuestion} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="question_id" value={q.id} />
              <input type="hidden" name="subject_id" value={params.subjectId} />
              <input className="input flex-1" name="answer" placeholder="Your answer…" />
              <button className="btn !px-4 !py-2 text-xs" name="action" value="answer">Answer</button>
              <button className="text-xs text-stone hover:text-ink" name="action" value="dismiss">Skip</button>
            </form>
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-stone">Nothing waiting.</p>}
      </div>

      {answered.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl">Answered</h2>
          <ul className="mt-4 space-y-3">
            {answered.map((q) => (
              <li key={q.id} className="card !p-4 text-sm">
                <p className="text-stone">{q.question}</p>
                <p className="mt-1 font-medium">{q.answer}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
