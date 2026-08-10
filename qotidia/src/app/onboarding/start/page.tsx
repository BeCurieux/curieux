// Where a family actually begins.
//
// This screen exists to change the shape of the product for a new customer.
// Before it, the first thing anyone did was start collecting a year that
// ends in twelve months — which meant twelve months of effort before any
// object, and nothing for the look-back to show, in exactly the window where
// people decide whether this was worth it.
//
// For a parent whose child is over one, the year is already photographed.
// Emptying it in here is an afternoon's work that produces a printed book in
// a fortnight, gives the archive history on day one, and turns the wait into
// something that happens in the background of a product already working.
//
// The other path is always offered and never buried. A family who would
// rather start from today is not doing it wrong.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { startCopy, startingYear } from "@/lib/onboarding/start";
import { yearWord } from "@/lib/book/structure";

export const dynamic = "force-dynamic";

export default async function StartPage({
  searchParams,
}: {
  searchParams: { child?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: child } = await db
    .from("subjects")
    .select("id, display_name, date_of_birth")
    .eq("id", searchParams.child ?? "")
    .maybeSingle();
  if (!child) redirect("/home");

  const year = startingYear(child.date_of_birth);
  const first = child.display_name?.split(" ")[0] ?? child.display_name;
  const ageWord = yearWord(year.yearNumber).toLowerCase();
  const copy = startCopy({ childName: first, year, ageWord });

  return (
    <div className="mx-auto !max-w-xl py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-clay">
        {year.complete ? "Where to start" : "First year"}
      </p>
      <h1 className="mt-4 font-display lowercase leading-[1.05]" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
        {copy.headline}
      </h1>
      <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-stone">{copy.body}</p>

      {year.complete && (
        <ul className="mt-8 space-y-2.5 text-sm">
          {[
            "Drop in a few hundred at once — blurry ones and near duplicates too",
            "We find the shape of the year and ask you the few things a photo can't answer",
            "Read it through, change anything, then print",
          ].map((line) => (
            <li key={line} className="flex gap-3">
              <span className="text-clay">&mdash;</span>
              <span className="leading-relaxed">{line}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-5">
        <Link
          href={`/subjects/${child.id}/upload?${year.complete ? "backfill=1" : "welcome=1"}`}
          className="btn !px-7 !py-3.5"
        >
          {copy.action}
        </Link>
        {/* The alternative is a link beside the button, not a greyed-out
            option underneath it. A family who would rather start from today
            is not doing it wrong. */}
        <Link
          href={`/subjects/${child.id}/upload?welcome=1`}
          className="text-sm text-ink/70 underline underline-offset-4 hover:text-clay"
        >
          {copy.alternative}
        </Link>
      </div>

      {year.complete && (
        <p className="mt-10 max-w-[46ch] text-sm leading-relaxed text-stone">
          Nothing prints until you&rsquo;ve read it and said so, and you can
          stop at any point &mdash; everything you put in stays yours either
          way.
        </p>
      )}
    </div>
  );
}
