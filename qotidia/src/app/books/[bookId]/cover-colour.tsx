// Choosing the colour of a cover.
//
// Shown as the actual object rather than as a row of colour chips: each
// swatch is a small spine with the child's name reversed out of it, because
// what a parent is deciding is how a book will look on a shelf, and a flat
// square answers a different question.
//
// The "follow the spectrum" option is a real, selectable state and not the
// absence of a choice. Without it, a parent who picks a colour has no way
// back to the default, and a parent who has picked nothing cannot tell
// whether they have.

import { COLOUR_CHOICES, colourForBook, isFollowingDefault } from "@/lib/book/colours";
import { setCoverColour, setCoverColourForAll } from "@/app/actions";

export function CoverColour({
  bookId,
  subjectId,
  childName,
  age,
  bookColour,
  subjectColour,
}: {
  bookId: string;
  subjectId: string;
  childName: string;
  age: number;
  bookColour: string | null;
  subjectColour: string | null;
}) {
  const current = colourForBook({ bookColour, subjectColour, age });
  const following = isFollowingDefault(bookColour);
  const first = childName.split(" ")[0];

  return (
    <section>
      <h2 className="text-lg">The colour of this one</h2>
      <p className="mt-1 max-w-[54ch] text-sm leading-relaxed text-stone">
        Every age has its own colour, so a row of them reads as a set. You
        don&rsquo;t have to keep it &mdash; change this one, or make them all
        the same.
      </p>

      <form action={setCoverColour} className="mt-5">
        <input type="hidden" name="book_id" value={bookId} />
        <input type="hidden" name="subject_id" value={subjectId} />

        <div className="flex flex-wrap gap-2">
          {/* The default, as a choice you can come back to. */}
          <button
            name="colour"
            value=""
            className={`flex h-24 w-16 flex-none flex-col items-center justify-center rounded-sm border border-dashed px-1 text-center text-[0.6rem] leading-tight ${
              following ? "border-clay text-clay" : "border-rule text-stone"
            }`}
          >
            {following ? "following the spectrum" : "back to the spectrum"}
          </button>

          {COLOUR_CHOICES.map((c) => {
            const selected = bookColour === c.id;
            // The one it is right now, which is not the same as the one that
            // was chosen: a book following the spectrum has a colour without
            // anyone having picked it, and a picker that shows nothing
            // highlighted leaves you hunting for which of nineteen it is.
            const isCurrent = !selected && c.id === current.id;
            return (
              <button
                key={c.id}
                name="colour"
                value={c.id}
                title={c.name}
                aria-label={c.name}
                className={`h-24 w-16 flex-none rounded-sm ${
                  selected
                    ? "ring-2 ring-ink ring-offset-2 ring-offset-paper"
                    : isCurrent
                      ? "ring-1 ring-stone ring-offset-2 ring-offset-paper"
                      : ""
                }`}
                style={{ backgroundColor: c.hex }}
              >
                <span
                  className="block px-1 pt-2 text-[0.55rem] lowercase leading-tight"
                  style={{ color: c.inkHex }}
                >
                  {first}
                </span>
                {isCurrent && (
                  <span
                    className="mt-1 block text-[0.5rem] lowercase"
                    style={{ color: c.inkHex, opacity: 0.75 }}
                  >
                    now
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm text-stone">
          This one is <span style={{ color: current.inkHex, backgroundColor: current.hex }} className="rounded px-1.5 py-0.5">{current.name}</span>
          {following && <> &mdash; the colour for {age === 0 ? "their first year" : `age ${age}`}.</>}
        </p>

      </form>

      {/* A separate form, not a checkbox on the one above. Ticking a box and
          then clicking a swatch reads as two steps in an order nobody can
          guess — and getting the order wrong would restyle a whole shelf by
          accident. This applies the colour already chosen, so what the button
          will do is written on it. */}
      <form action={setCoverColourForAll} className="mt-5 border-t border-rule pt-5">
        <input type="hidden" name="subject_id" value={subjectId} />
        <input type="hidden" name="colour" value={current.id} />
        <button className="btn-secondary !px-5 !py-2 text-xs">
          Use {current.name} for all of {first}&rsquo;s books
        </button>
        <p className="mt-2 max-w-[52ch] text-xs leading-relaxed text-stone">
          Including the ones not made yet. Any book you&rsquo;ve already set by
          hand keeps the colour you gave it.
        </p>
      </form>
    </section>
  );
}
