// This week, on the archive page.
//
// Not an email and not a separate screen. It sits where the family already
// goes, because a weekly note that requires opening a link is a weekly note
// competing with everything else in an inbox — and this one has to feel like
// the product noticing rather than the product marketing.
//
// Renders nothing when there is nothing. That is the whole discipline: three
// manufactured observations a week is how a product teaches people to stop
// reading it, and by then the good weeks have nowhere to land.

import type { ShownNote } from "@/lib/weekly/build";
import { answerNoticed } from "@/app/actions";

export function Weekly({ note, subjectId }: { note: ShownNote; subjectId: string }) {
  if (!note.worthShowing) return null;
  const { shownIds } = note;

  return (
    <section className="card !p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-clay">This week</p>

      <ul className="mt-4 space-y-4">
        {note.observations.map((o, i) => (
          <li key={o.entityId} className="border-b border-rule/60 pb-4 last:border-0 last:pb-0">
            <p className="font-display text-lg leading-snug">{o.line}</p>

            {/* Three answers, all one tap, none of them dismissive of the
                others. "Ignore" is offered as plainly as "keep" — a product
                that makes it awkward to say "you were wrong" stops being
                told, and then stops improving. */}
            {shownIds[i] && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {[
                  ["kept", "Keep"],
                  ["more", "Tell me more"],
                  ["ignored", "Ignore"],
                ].map(([verdict, label]) => (
                  <form action={answerNoticed} key={verdict}>
                    <input type="hidden" name="noticed_id" value={shownIds[i]} />
                    <input type="hidden" name="subject_id" value={subjectId} />
                    <input type="hidden" name="verdict" value={verdict} />
                    <button className="rounded-full border border-rule px-3 py-1 text-xs text-stone transition hover:border-ink hover:text-ink">
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* At most one question, and only after the observations. A note that
          leads with a request has asked the parent to do work before it has
          given them anything. */}
      {note.question && (
        <p className="mt-5 max-w-[52ch] text-sm leading-relaxed text-stone">
          {note.question}
        </p>
      )}
    </section>
  );
}
