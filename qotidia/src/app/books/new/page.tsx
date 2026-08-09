// What story would you like to tell?
//
// One archive, and this is where a family decides what to make of it. The
// whole screen is one question and a short list, because the moment a book
// chooser becomes a configuration form it stops being the pleasant part of
// the year and starts being admin.
//
// Two kinds at launch, which between them cover almost every household —
// including twins, siblings, and couples without children:
//
//   One person   Florence at two
//   Our family   The Wilsons in 2026
//
// And a third that only exists once an archive is deep enough to have one:
//
//   Two people   Nanna & Me
//
// That one is not offered on a schedule. It appears when a relationship has
// crossed years and somebody has told us who the person is — which is why it
// is at the foot of the page rather than beside the annual books. A family in
// their first year should not be shown a book they cannot have.
//
// Each option says how much is in it, because that is the honest thing to
// lead with and because it is also the persuasive one: a family looking at
// "142 things" understands what they have without being told.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { roleInFamily } from "@/lib/family/membership";
import { canEdit } from "@/lib/family/roles";
import { buildStories, EVERYTHING_UNDER_WAY, nothingReadyYet, type StoryInput } from "@/lib/book/stories";
import { countStoryMemories } from "@/lib/memories/scope";
import { periodFor } from "@/lib/book/period";
import { startHousehold, startPersonBook, startStory } from "@/app/actions";
import { peopleBooksFor } from "@/lib/book/people-books";
import { countOf } from "@/lib/words";

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: subjects } = await db
    .from("subjects")
    .select("id, family_id, display_name, subject_type, date_of_birth")
    .order("created_at");

  const rows = (subjects ?? []) as any[];
  if (rows.length === 0) redirect("/onboarding");

  const familyId = rows[0].family_id;
  const role = await roleInFamily(db, familyId, user.id);
  if (!role || !canEdit(role)) redirect("/home");

  const { data: books } = await db
    .from("books")
    .select("id, subject_id, start_date")
    .in("subject_id", rows.map((s) => s.id));

  // How much each story has to work with, counted through the same scope the
  // book generator uses — so the number on this screen is the number the
  // book will actually be made from.
  const inputs: StoryInput[] = [];
  for (const s of rows) {
    const period = periodFor(s);
    const started = ((books ?? []) as any[]).find(
      (b) => b.subject_id === s.id && b.start_date === period.start
    );
    inputs.push({
      subjectId: s.id,
      displayName: s.display_name,
      subjectType: s.subject_type,
      dateOfBirth: s.date_of_birth,
      material: await countStoryMemories(db, s.id, {
        approvedOnly: true,
        familyVisibleOnly: true,
        from: period.start,
        to: period.end,
      }),
      alreadyStarted: !!started,
      bookId: started?.id ?? null,
    });
  }

  const { options, suggested, because, allStarted } = buildStories(inputs);

  // People who are, or are nearly, a book. Computed for the children only —
  // "Nanna & The Wilsons" is not a book anybody wants.
  const children = rows.filter((s) => s.subject_type === "child");
  const peopleBooks = (
    await Promise.all(
      children.map(async (child) => ({
        child,
        stories: await peopleBooksFor(db, child.id),
      }))
    )
  ).filter((p) => p.stories.length > 0);
  const household = options.find((o) => o.kind === "household");
  const fullest = [...options].sort((a, b) => b.material - a.material)[0];

  return (
    <div className="py-12">
      <Link href="/home" className="text-sm text-ochre">&larr; Home</Link>

      <h1 className="mt-3 max-w-[16ch] text-5xl leading-[1.05]">
        What story would you like to tell?
      </h1>
      <p className="mt-5 max-w-[54ch] text-sm leading-relaxed text-stone">
        Everything you&rsquo;ve kept is in one archive, and a book is a
        question asked of it. Nothing has to be added twice &mdash; the same
        morning can be in more than one book.
      </p>

      {suggested && (
        <div className="mt-10 rounded-lg border border-clay bg-card p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-clay">
            If you&rsquo;d like us to choose
          </p>
          <p className="mt-3 font-display text-2xl leading-snug">{suggested.label}</p>
          {/* Why, in plain arithmetic. A recommendation without a reason is
              a product asserting taste it has not earned. */}
          <p className="mt-1.5 max-w-[48ch] text-sm leading-relaxed text-stone">{because}</p>
          <form action={startStory} className="mt-4">
            <input type="hidden" name="subject_id" value={suggested.subjectId} />
            {suggested.period.calendarYear && (
              <input type="hidden" name="calendar_year" value={suggested.period.calendarYear} />
            )}
            <button className="btn">Make {suggested.title}</button>
          </form>
        </div>
      )}

      {!suggested && (
        <p className="mt-10 max-w-[52ch] rounded-lg border border-rule bg-card p-5 text-sm leading-relaxed">
          {allStarted ? EVERYTHING_UNDER_WAY : nothingReadyYet(fullest)}
        </p>
      )}

      <h2 className="mt-14 text-xs uppercase tracking-[0.18em] text-clay">
        Or choose for yourself
      </h2>

      <ul className="mt-5 max-w-[38rem] space-y-3">
        {options.map((o) => (
          <li key={`${o.subjectId}-${o.period.start}`} className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl leading-snug">{o.label}</p>
              <p className="mt-0.5 text-sm text-stone">
                {o.kind === "household" ? "Everyone" : "One person"} &middot;{" "}
                {countOf(o.material, "thing")}
                {!o.ready && !o.alreadyStarted && " so far"}
              </p>
            </div>

            {o.alreadyStarted && o.bookId ? (
              <Link href={`/books/${o.bookId}`} className="btn-secondary !px-4 !py-2 text-xs">
                Already started
              </Link>
            ) : (
              <form action={startStory}>
                <input type="hidden" name="subject_id" value={o.subjectId} />
                {o.period.calendarYear && (
                  <input type="hidden" name="calendar_year" value={o.period.calendarYear} />
                )}
                {/* Offered even when it isn't ready. A family that wants to
                    start a thin year should be allowed to — they can keep
                    adding right up until they read it through, and refusing
                    would be the product deciding it knows better. */}
                <button className={o.ready ? "btn !px-4 !py-2 text-xs" : "btn-secondary !px-4 !py-2 text-xs"}>
                  {o.ready ? "Make this one" : "Start it anyway"}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {!household && (
        <div className="mt-8 max-w-[38rem]">
          <form action={startHousehold}>
            <input type="hidden" name="family_id" value={familyId} />
            <button className="card w-full text-left transition hover:border-clay">
              <p className="font-display text-xl leading-snug">A book about all of you</p>
              <p className="mt-0.5 max-w-[44ch] text-sm leading-relaxed text-stone">
                The year as it happened in this house &mdash; holidays,
                birthdays, ordinary weekends, everyone in it. Made from the
                same archive, including the days nobody was tagged in.
              </p>
            </button>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────── two people
          The first book that is not a year, and the only one on this page
          that has to be earned rather than scheduled. It appears when a
          relationship has crossed years and somebody has told us who the
          person is — see lib/book/person-story.ts for the three refusals.

          The nearly-ready ones are shown with their reason rather than
          hidden. "One more year and this is a book" is a reason to keep
          going; hiding it is how a feature stays invisible. */}
      {peopleBooks.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xs uppercase tracking-[0.18em] text-clay">
            Two people
          </h2>
          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-stone">
            One person and one child, across every year they have been in
            together. Made from memories that are already in the annual books
            &mdash; the same Thursday can be a page in both.
          </p>

          {peopleBooks.map(({ child, stories }) => (
            <ul key={child.id} className="mt-6 max-w-[38rem] space-y-3">
              {stories.map((story) => (
                <li key={story.entityId} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-display text-xl leading-snug">
                        {story.title}
                      </p>
                      <p className="mt-0.5 text-sm text-stone">
                        {child.display_name} &middot; {story.subtitle}
                      </p>
                    </div>

                    {story.ready ? (
                      <form action={startPersonBook}>
                        <input type="hidden" name="subject_id" value={child.id} />
                        <input type="hidden" name="entity_id" value={story.entityId} />
                        <button className="btn !px-4 !py-2 text-xs">
                          Make {story.title}
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {story.notYet && (
                    <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-stone">
                      {story.notYet}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </section>
      )}

      {/* Said plainly rather than shown as greyed-out options nobody can
          click. A menu of things you cannot have is a worse first impression
          than a short menu. */}
      <p className="mt-14 max-w-[52ch] text-sm leading-relaxed text-stone">
        Books about one chapter of a life &mdash; a house you left, a year
        abroad &mdash; are coming. They&rsquo;ll be made from this same
        archive, so nothing you keep now is wasted on them.
      </p>
    </div>
  );
}
