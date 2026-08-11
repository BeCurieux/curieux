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
import { Why } from "@/app/why";
import type { Evidence } from "@/lib/graph/evidence";

export function Weekly({
  note,
  subjectId,
  evidence = {},
}: {
  note: ShownNote;
  subjectId: string;
  /** Memories behind each observation, keyed by entity id. */
  evidence?: Record<string, Evidence[]>;
}) {
  if (!note.worthShowing) return null;
  const { shownIds } = note;

  // No box. This was a beige panel identical to the seven below it, which
  // made the one genuinely alive thing on the screen read as another module.
  // It is now the page's opening statement: the first observation is set at
  // display size, and the ones after it step down — because the note is
  // ranked, and rendering three equal lines throws that ranking away.
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.18em] text-clay">I noticed</p>

      <ul className="mt-5 space-y-7">
        {note.observations.map((o, i) => (
          <li key={o.entityId}>
            <p
              className={
                i === 0
                  ? "max-w-[22ch] font-display text-4xl leading-[1.15] md:max-w-[24ch] md:text-5xl"
                  : "max-w-[40ch] font-display text-xl leading-snug"
              }
            >
              {o.line}
            </p>

            {/* The receipt, under the claim it belongs to and above the
                buttons that answer it. Every one of these lines already
                carried the memory ids it was counted from; until now nothing
                showed them to anybody — and an observation a family can
                check is one they can correct, which is worth more than the
                observation was. */}
            <Why evidence={evidence[o.entityId] ?? []} total={o.memoryIds.length} />

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
