// What we don't know about the things that keep turning up.
//
// The sibling of /who. That page asks whether two names are one person; this
// one asks the other question — the archive can see that something matters
// and cannot see why, and only a person can close that gap.
//
// Built to be finishable, for the same reason /who is: a list of forty
// prompts is data entry, and data entry gets answered carelessly. One
// question, the arithmetic that produced it sitting right above it, and a
// box. When there is nothing to ask it says so and looks finished rather
// than empty, which is the common state.
//
// The answers already given are shown underneath, and that is not decoration.
// It is the only place in the product where a family can see the thing they
// are actually building: not photographs, but what the photographs were of.

import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser, userClient } from "@/lib/supabase/server";
import { loadEntities } from "@/lib/graph/extract";
import { contextQuestions, nextQuestion } from "@/lib/graph/context";
import { knownContext, settledContext } from "@/lib/graph/context-store";
import { answerAboutThing } from "@/app/actions";
import { todayIso } from "@/lib/time";
import { countOf, friendlyDate } from "@/lib/words";
import { evidenceFor, worthShowing } from "@/lib/graph/evidence";
import { Why } from "@/app/why";

export const dynamic = "force-dynamic";

const LABEL_FOR: Record<string, string> = {
  what_happened: "Something stopped",
  what_is_it: "A thing we can't name",
  was_it_a_ritual: "Same day, again",
};

export default async function AboutPage({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: subject } = await db
    .from("subjects")
    .select("id, family_id, display_name")
    .eq("id", params.subjectId)
    .maybeSingle();
  if (!subject?.family_id) redirect("/home");

  const today = todayIso();
  const entities = await loadEntities(db, params.subjectId);
  const settled = await settledContext(db, subject.family_id);
  const question = nextQuestion(entities, today, settled);
  const waiting = contextQuestions(entities, today, settled).length;
  const known = await knownContext(db, subject.family_id);
  const askedFrom = question && worthShowing(question.memoryIds)
    ? await evidenceFor(db, question.memoryIds)
    : [];

  const labelOf = (key: string) =>
    entities.find((e) => e.id === key)?.label ?? key.split(":").slice(1).join(":");

  return (
    <div className="py-12">
      <h1 className="text-title font-display lowercase">what we don&rsquo;t know</h1>
      <p className="mt-5 max-w-[54ch] leading-relaxed text-stone">
        The archive can see what keeps turning up. It can&rsquo;t see what any of
        it meant &mdash; and that part only exists in your head. The photographs
        will still be here in twenty years. This won&rsquo;t, unless somebody
        writes it down.
      </p>

      {question ? (
        <section className="panel mt-10 md:!p-10">
          <p className="text-sm uppercase tracking-[0.2em] text-clay">
            {LABEL_FOR[question.wondering] ?? "A question"}
          </p>

          {/* The arithmetic, first and in plain sight. It is what makes the
              question honest: we are not claiming the rabbit mattered, we
              are saying it is in twenty-three memories and asking. */}
          <p className="mt-5 max-w-[46ch] text-subhead leading-snug">{question.because}</p>
          <p className="mt-4 max-w-[46ch] text-lg leading-snug">{question.ask}</p>

          {/* Before the box, not after it. Somebody is about to write down
              something they will not be asked about again; they should be
              able to see what prompted it first. */}
          <Why evidence={askedFrom} total={question.memoryIds.length} what="we asked" />

          <form action={answerAboutThing} className="mt-7">
            <input type="hidden" name="subject_id" value={subject.id} />
            <input type="hidden" name="family_id" value={subject.family_id} />
            <input type="hidden" name="entity_key" value={question.entityId} />
            <input type="hidden" name="wondering" value={question.wondering} />
            <input type="hidden" name="because" value={question.because} />

            <label className="sr-only" htmlFor="answer">{question.ask}</label>
            <textarea
              id="answer"
              name="answer"
              rows={3}
              className="input w-full"
              placeholder={question.placeholder}
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <button name="intent" value="keep" className="btn !px-7">
                Keep this
              </button>
              <button name="intent" value="skip" className="btn-secondary !px-7">
                Skip
              </button>
            </div>
          </form>

          <p className="mt-7 max-w-[50ch] text-sm leading-relaxed text-stone">
            No need to write it well &mdash; a few words is plenty, and
            it&rsquo;s kept exactly as you type it. Skipping settles it too;
            we won&rsquo;t ask again either way.
          </p>

          {waiting > 1 && (
            <p className="mt-3 text-sm text-stone">
              {countOf(waiting - 1, "more question", "more questions")}, whenever you feel
              like it.
            </p>
          )}
        </section>
      ) : (
        <section className="panel mt-10 md:!p-10">
          <p className="text-subhead">Nothing to ask.</p>
          <p className="mt-4 max-w-[48ch] leading-relaxed text-stone">
            Nothing in {subject.display_name}&rsquo;s archive is recurring often
            enough for us to have a sensible question about it yet. As more goes
            in, this is where we&rsquo;ll ask.
          </p>
        </section>
      )}

      {/* ------------------------------------------------ what they've said */}
      {known.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl lowercase">what you&rsquo;ve told us</h2>
          <p className="mt-3 max-w-[52ch] leading-relaxed text-stone">
            All of this goes into the books, and none of it could have been
            worked out from the photographs.
          </p>
          <ul className="mt-6 space-y-4">
            {known.map((k) => (
              <li key={`${k.entityKey}-${k.wondering}`} className="panel md:!p-7">
                <p className="text-sm text-stone">{k.because ?? labelOf(k.entityKey)}</p>
                <p className="mt-2 text-lg leading-snug">{k.answer}</p>
                <p className="mt-3 text-xs text-stone">{friendlyDate(k.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-14 text-sm text-stone">
        <Link href={`/subjects/${subject.id}/who`} className="text-ochre">
          Who&rsquo;s who
        </Link>{" "}
        asks the other kind of question.
      </p>
    </div>
  );
}
