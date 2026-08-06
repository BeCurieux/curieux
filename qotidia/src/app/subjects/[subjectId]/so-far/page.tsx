// The book, so far.
//
// A contents page half-written. Deliberately not a progress bar: a bar says
// "you are 62% of the way to a product", which is true and is the least
// interesting true thing about a year. A contents page says "there is a
// chapter about the yellow boots now", which is a fact about a childhood.
//
// It is set as a book rather than as an interface — book type, right-aligned
// counts, a rule between chapters — because the point of the screen is that
// somebody recognises the thing they are going to be holding in December.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { loadBookSoFar } from "@/lib/book/so-far";
import { countOf } from "@/lib/words";

export const dynamic = "force-dynamic";

export default async function SoFarPage({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: child } = await db
    .from("subjects")
    .select("id, display_name")
    .eq("id", params.subjectId)
    .single();
  if (!child) redirect("/home");

  const first = child.display_name?.split(" ")[0] ?? child.display_name;
  const soFar = await loadBookSoFar(db, child.id);
  if (!soFar) redirect(`/subjects/${child.id}`);

  return (
    <div className="py-10">
      <p className="text-xs uppercase tracking-[0.18em] text-clay">The book so far</p>

      {soFar.tooEarly ? (
        <>
          <h1 className="mt-3 max-w-[22ch] text-4xl leading-tight">
            Not enough of a year yet.
          </h1>
          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-stone">
            There are {countOf(soFar.kept, "thing")} in {first}&rsquo;s year.
            A book starts having a shape at about fifteen &mdash; and
            we&rsquo;d rather show you nothing than a contents page made of
            chapters that don&rsquo;t exist.
          </p>
          <Link href={`/subjects/${child.id}/upload`} className="btn mt-8 inline-block">
            Add to {first}&rsquo;s year
          </Link>
        </>
      ) : (
        <>
          {/* Set the way the cover is, not the way the row is. The book's
              stored title is the year phrase and its subtitle is the name,
              but the object a family will be holding reads FLORENCE, then
              THE YEAR YOU WERE TWO — and the whole purpose of this screen is
              that somebody recognises it. A life story has no subtitle and
              its title stands alone, which is why this is a swap rather than
              a reordering of two things that are always there. */}
          <h1 className="mt-3 max-w-[18ch] font-display text-5xl leading-[1.05]">
            {soFar.subtitle ?? soFar.title}
          </h1>
          {soFar.subtitle && (
            <p className="mt-2 font-display text-xl text-stone">{soFar.title}</p>
          )}
          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-stone">
            This is what&rsquo;s in it today. Nothing is printed and nothing is
            decided &mdash; chapters appear as the year does, and you can keep
            adding right up until you read it through.
          </p>

          {/* -------------------------------------------- what is in it */}

          {soFar.chapters.length > 0 && (
            <ol className="mt-10 max-w-[34rem]">
              {soFar.chapters.map((c, i) => (
                <li
                  key={`${c.sectionType}-${c.title}-${i}`}
                  className="flex items-baseline justify-between gap-4 border-b border-rule/60 py-3.5"
                >
                  <span className="font-display text-xl leading-snug">{c.title}</span>
                  {c.count > 0 && (
                    <span className="shrink-0 text-xs tabular-nums text-stone">{c.count}</span>
                  )}
                </li>
              ))}
            </ol>
          )}

          {/* ------------------------------------------ what is nearly in it */}

          {soFar.forming.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xs uppercase tracking-[0.18em] text-clay">
                Not chapters yet
              </h2>
              {/* The part that earns the screen. A finished contents page is
                  pleasant; "one more and it's a chapter" is the sentence that
                  makes somebody open their camera roll. */}
              <ul className="mt-5 max-w-[34rem] space-y-4">
                {soFar.forming.map((f) => (
                  <li key={f.title} className="border-b border-rule/40 pb-4 last:border-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-display text-xl leading-snug text-stone">
                        {f.title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-stone">{f.count}</span>
                    </div>
                    <p className="mt-1 text-sm text-stone">{f.note}</p>
                  </li>
                ))}
              </ul>
              {soFar.forming.some((f) => f.needs === 0) && (
                <p className="mt-5 text-sm">
                  <Link href={`/subjects/${child.id}/clusters`} className="text-ochre hover:underline">
                    Look at what we think are threads
                  </Link>
                </p>
              )}
            </div>
          )}

          {/* ------------------------------------------------- the holes */}

          {soFar.quiet.length > 0 && (
            <div className="mt-12 max-w-[34rem]">
              <h2 className="text-xs uppercase tracking-[0.18em] text-clay">
                Nothing from
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-stone">
                {soFar.quiet.map((q) => q.label).join(" · ")}
              </p>
              {/* Said kindly, because the usual cause is a phone that never
                  got emptied rather than a month that did not happen. */}
              <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-stone">
                Usually that means the photographs are still on a phone. If
                nothing much happened, that&rsquo;s a true thing about the year
                too &mdash; leave it.
              </p>
              <Link
                href={`/subjects/${child.id}/upload`}
                className="btn-secondary mt-4 inline-block !px-4 !py-2 text-xs"
              >
                Add to those months
              </Link>
            </div>
          )}
        </>
      )}

      <p className="mt-14 text-sm text-stone">
        <Link className="text-ochre" href={`/subjects/${child.id}`}>
          Back to {first}&rsquo;s year
        </Link>
      </p>
    </div>
  );
}
