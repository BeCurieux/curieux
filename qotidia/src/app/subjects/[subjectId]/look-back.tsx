// Today's look-back, at the top of the archive.
//
// Placed above everything else on the page on purpose. The rest of the
// screen asks the parent to do something — add, review, approve. This asks
// nothing. It is the only part of the product that gives without wanting,
// and it is the reason to open the app on the three hundred days when there
// is no book to make.
//
// Quiet days render nothing at all. A panel that says "nothing today" every
// day is how a product teaches people to stop looking at that part of the
// screen.

import Link from "next/link";
import type { LoadedLookBack } from "@/lib/lookback/load";
import { friendlyDate } from "@/lib/words";

export function LookBackPanel({
  look,
  subjectId,
  first,
}: {
  look: LoadedLookBack;
  subjectId: string;
  first: string;
}) {
  if (look.kind === "quiet") return null;

  const photos = look.memories.filter((m) => look.photoUrls.has(m.id));
  const words = look.memories.filter((m) => m.text);

  return (
    <section className="card !p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-clay">{look.headline}</p>

      {look.littleThing && (
        <>
          <p className="mt-3 font-display text-2xl leading-snug">
            {look.littleThing.value}
          </p>
          <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-stone">
            Still true? {/* An invitation, not an assertion — we know what was
            written down, not what is the case now, and the difference between
            those two is the whole rule this product runs on. */}
            <Link href={`/subjects/${subjectId}/little-things`} className="text-ochre">
              Bring it up to date
            </Link>
          </p>
        </>
      )}

      {photos.length > 0 && (
        <div className="mt-4 flex gap-3">
          {photos.map((m) => (
            <img
              key={m.id}
              src={look.photoUrls.get(m.id)}
              alt=""
              className="h-40 w-40 flex-none rounded-sm object-cover"
            />
          ))}
        </div>
      )}

      {words.map((m) => (
        <div key={m.id} className="mt-4">
          {/* A quote is shown as a quote, in their words, exactly as given. */}
          {m.type === "quote" ? (
            <p className="font-display text-2xl leading-snug">&ldquo;{m.text}&rdquo;</p>
          ) : (
            <p className="max-w-[52ch] leading-relaxed">{m.text}</p>
          )}
          <p className="mt-1 text-xs text-stone">{friendlyDate(m.date)}</p>
        </div>
      ))}

      {look.memories.length > 0 && (
        <p className="mt-5 text-sm text-stone">
          <Link href={`/subjects/${subjectId}/years`} className="text-ochre">
            All of {first}&rsquo;s years
          </Link>
        </p>
      )}
    </section>
  );
}
