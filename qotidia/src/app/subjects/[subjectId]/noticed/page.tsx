// The first ten minutes.
//
// A parent has just emptied part of a camera roll in here. This is the screen
// that decides whether they think Qotidia is an archivist or a folder, and it
// gets one shot: three things about their own family they had not put into
// words, and then two or three questions worth answering.
//
// The questions are the point as much as the observations. An observation is
// pleasant; a question that only this archive could have thought to ask is
// what makes somebody believe it is paying attention. And the answers become
// memories — so the first thing this product ever asks a parent to do also
// leaves the archive better than it found it.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient, adminClient } from "@/lib/supabase/server";
import { answerQuestion } from "@/app/actions";
import { loadFirstLook } from "@/lib/graph/extract";
import { ENOUGH_TO_NOTICE } from "@/lib/graph/first-look";
import { note } from "@/lib/analytics/record";
import { roleForSubject } from "@/lib/family/membership";
import { canEdit } from "@/lib/family/roles";

export const dynamic = "force-dynamic";

export default async function NoticedPage(props: { params: Promise<{ subjectId: string }> }) {
  const params = await props.params;
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await userClient();

  const { data: child } = await db
    .from("subjects")
    .select("id, display_name")
    .eq("id", params.subjectId)
    .single();
  if (!child) redirect("/home");

  const first = child.display_name?.split(" ")[0] ?? child.display_name;
  const role = (await roleForSubject(db, child.id, user.id))?.role ?? null;
  const look = await loadFirstLook(db, child.id);

  // The questions become real rows, so answering one goes through the same
  // path every other answer does and turns into a memory. Written once:
  // matched on the question text, because re-running the graph next week
  // should not ask the same thing again with a new id.
  if (look.questions.length > 0 && canEdit(role)) {
    const { data: existing } = await db
      .from("follow_up_questions")
      .select("question")
      .eq("subject_id", child.id);
    const already = new Set(((existing ?? []) as any[]).map((q) => q.question));
    const fresh = look.questions.filter((q) => !already.has(q.question));
    if (fresh.length > 0) {
      await adminClient()
        .from("follow_up_questions")
        .insert(
          fresh.map((q) => ({
            subject_id: child.id,
            question: q.question,
            reason: `${q.label} is in ${q.appearances} of these, and there's nothing written about them.`,
            status: "pending",
          }))
        );
    }
  }

  const { data: pending } = await db
    .from("follow_up_questions")
    .select("id, question")
    .eq("subject_id", child.id)
    .eq("status", "pending")
    .limit(3);

  const enough = look.memoryCount >= ENOUGH_TO_NOTICE;
  // Recorded here rather than in an action, because this is the only place
  // it happens: the moment the archive has enough to say something back is a
  // render, not a button. Fire and forget — see lib/analytics/record.ts.
  if (enough) void note(adminClient(), user.id, { name: "noticing_shown", count: look.memoryCount });

  return (
    <div className="py-10">
      <p className="text-xs uppercase tracking-[0.18em] text-clay">
        {enough ? "What we noticed" : "So far"}
      </p>

      {enough ? (
        <>
          <h1 className="mt-3 max-w-[20ch] text-4xl leading-tight">
            Here&rsquo;s what&rsquo;s already in {first}&rsquo;s year.
          </h1>

          <ul className="mt-8 max-w-[46ch] space-y-5">
            {look.observations.map((o) => (
              <li key={o.entityId} className="border-b border-rule/60 pb-5 last:border-0">
                <p className="font-display text-2xl leading-snug">{o.line}</p>
                {/* The provenance rule, made visible. Every line here can be
                    traced to things the family put in, and saying how many
                    is the cheapest possible way to prove it. */}
                <p className="mt-1.5 text-xs text-stone">
                  from {o.memoryIds.length} of the things you added
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-[52ch] text-sm leading-relaxed text-stone">
            None of that was written by us. It&rsquo;s counted from what you
            added &mdash; which is the only kind of thing we&rsquo;ll ever tell
            you about {first}.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-3 max-w-[22ch] text-4xl leading-tight">
            A few more and we can start noticing things.
          </h1>
          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-stone">
            There are {look.memoryCount} so far. Patterns need something to be
            a pattern in &mdash; at about {ENOUGH_TO_NOTICE} we can start
            telling you what keeps turning up, and we&rsquo;d rather say
            nothing than make something up.
          </p>
        </>
      )}

      {(pending ?? []).length > 0 && (
        <div className="mt-12 border-t border-rule pt-8">
          <h2 className="text-2xl">
            {(pending ?? []).length === 1 ? "One thing we can't tell" : "A couple of things we can't tell"}
          </h2>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-stone">
            Answer what you like, skip what you don&rsquo;t. Anything you skip
            simply stays out of the book &mdash; we&rsquo;d rather leave a gap
            than fill it with something you didn&rsquo;t say.
          </p>

          <div className="mt-6 space-y-4">
            {(pending ?? []).map((q: any) => (
              <div key={q.id} className="card">
                <p className="font-display text-lg">{q.question}</p>
                <form action={answerQuestion} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="question_id" value={q.id} />
                  <input type="hidden" name="subject_id" value={child.id} />
                  <input className="input flex-1" name="answer" placeholder="Your answer…" />
                  <button className="btn !px-4 !py-2 text-xs" name="action" value="answer">
                    Answer
                  </button>
                  <button className="text-xs text-stone hover:text-ink" name="action" value="dismiss">
                    Skip
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href={`/subjects/${child.id}`} className="btn">
          Go to {first}&rsquo;s archive
        </Link>
        <Link
          href={`/subjects/${child.id}/upload?backfill=1`}
          className="btn-secondary"
        >
          Add more
        </Link>
      </div>
    </div>
  );
}
