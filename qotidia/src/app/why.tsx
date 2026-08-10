// Why am I seeing this?
//
// A disclosure under an observation that opens to the memories it was
// counted from. Closed by default, because the point of the product is that
// a parent does not have to check — but present on every observation,
// because the option to check is what makes not checking reasonable.
//
// Three things about the way it is built.
//
//   **It is a <details>, not a modal or a route.** No JavaScript, no
//   navigation, no state to lose. An observation and its evidence belong on
//   the same page in the same breath; sending somebody somewhere to verify
//   a sentence is how verification becomes something nobody does.
//
//   **The photographs are the evidence.** Not a list of ids, not "based on
//   17 memories" in grey. The thing that makes "the dinosaur hat, four
//   times this week" believable is seeing the four.
//
//   **It says how many, and shows fewer.** An observation from forty
//   memories shows twelve and says forty. Padding the grid to match the
//   number would be a different kind of dishonesty.

import { countOf, dateList } from "@/lib/words";
import type { Evidence } from "@/lib/graph/evidence";

export function Why({
  evidence,
  total,
  what = "this",
}: {
  evidence: Evidence[];
  /** How many memories it was actually computed from. */
  total: number;
  /** Filled into the summary — "why this", "why we asked". */
  what?: string;
}) {
  if (evidence.length === 0) return null;

  // Formatted as a set rather than one at a time, so the captions under the
  // grid do not print half with a year and half without.
  const dates = dateList(evidence.map((e) => e.date));

  return (
    <details className="mt-3">
      <summary className="cursor-pointer list-none text-sm text-ochre underline underline-offset-4 marker:content-['']">
        Why {what}?
      </summary>

      {/* Lighter than whatever it opens on, rather than darker.
          bg-card read as a panel on the dashboard and as an accidental
          indent on the asking page, which is already a card of that colour —
          a nested block with no visible edge. White lifts against both, and
          a sheet of evidence laid on top of the claim is the right
          metaphor anyway. */}
      <div className="mt-4 rounded-2xl bg-white/70 p-5 ring-1 ring-rule/70">
        <p className="text-sm text-stone">
          Counted from {countOf(total, "memory", "memories")} you kept
          {total > evidence.length && <>, {evidence.length} of them here</>}.
        </p>

        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {evidence.map((e, i) => (
            <li key={e.memoryId}>
              {e.photoUrl ? (
                <img
                  src={e.photoUrl}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ) : (
                // Something written rather than photographed. Shown as the
                // words, small — a grey box saying "text" would be worse
                // than useless as evidence.
                <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-card p-2">
                  <span className="reading line-clamp-4 text-center text-xs leading-snug">
                    {e.text ?? "—"}
                  </span>
                </div>
              )}
              {dates[i] && (
                <p className="mt-1 text-center text-[0.65rem] text-stone">{dates[i]}</p>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 max-w-[52ch] text-xs leading-relaxed text-stone">
          That&rsquo;s the whole basis for it. We count what you&rsquo;ve kept
          &mdash; we don&rsquo;t look at what&rsquo;s in the photographs, and we
          don&rsquo;t decide what any of it meant.
        </p>
      </div>
    </details>
  );
}
