// A story I found in your year.
//
// The first five minutes. Somebody has dragged in a few hundred photographs
// and typed nothing, and this page has to be worth the upload before it asks
// for anything — which rules out almost everything a product would normally
// do here.
//
// What it does instead is arithmetic, out loud. "Twenty-three photographs
// from one Saturday in March, over six hours." Nobody has forgotten what
// their child looks like; everybody has forgotten which Saturday. Then one
// question, and the answer becomes both an ordinary dated memory and the
// title of the sequence below it.
//
// Nothing on this page is generated prose. The title is the family's own
// sentence or a plain date; every other line is a number they can check.
// See lib/onboarding/story.ts for why that is a hard rule rather than a
// stylistic preference.

import Link from "next/link";
import { redirect } from "next/navigation";
import { adminClient, currentUser, userClient } from "@/lib/supabase/server";
import { answerDiscovery, revokeShare, shareStory } from "@/app/actions";
import { discoveries, type Shot } from "@/lib/onboarding/discover";
import { storyFrom } from "@/lib/onboarding/story";
import { note } from "@/lib/analytics/record";
import { resolvePhotoUrls } from "@/lib/book/photos";
import { SERVABLE_VERDICT } from "@/lib/media/verify";
import { countOf, dateRange, friendlyDate } from "@/lib/words";
import { homeUrl } from "@/lib/brand";

export const dynamic = "force-dynamic";

const dayOf = (iso: string) => iso.slice(0, 10);

export default async function FoundPage(
  props: {
    params: Promise<{ subjectId: string }>;
    searchParams: Promise<{ shared?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await userClient();

  const { data: subject } = await db
    .from("subjects")
    .select("id, family_id, display_name")
    .eq("id", params.subjectId)
    .maybeSingle();
  if (!subject?.family_id) redirect("/home");
  const first = subject.display_name?.split(" ")[0] ?? subject.display_name;

  // Two queries rather than one with a filter on an embedded resource.
  // Filtering a join through PostgREST works until it quietly does not, and
  // the same shortcut had already been backed out of the succession sweep
  // for the same reason.
  const { data: memories } = await db
    .from("memories")
    .select("id, memory_date")
    .eq("family_id", subject.family_id)
    .eq("type", "photo")
    .limit(2000);

  const dateOf = new Map<string, string | null>(
    (memories ?? []).map((m: any) => [m.id as string, (m.memory_date as string) ?? null])
  );

  // Only photographs that have been read server-side and found to be what
  // they claimed. The same gate as everywhere else — a first-run page is not
  // a reason to show a file nothing has checked.
  const { data: assets } = dateOf.size
    ? await db
        .from("media_assets")
        .select("id, memory_id, capture_timestamp")
        .in("memory_id", [...dateOf.keys()])
        .eq("scan_verdict", SERVABLE_VERDICT)
        .limit(2000)
    : { data: [] };

  // Prefer the camera's own timestamp; fall back to the date the memory
  // carries. A photograph with neither cannot contribute to a shape and is
  // dropped rather than guessed at.
  const shots: Shot[] = (assets ?? [])
    .map((a: any) => {
      const fallback = dateOf.get(a.memory_id as string);
      return {
        id: a.memory_id as string,
        at: (a.capture_timestamp as string) ?? (fallback ? `${fallback}T00:00:00.000Z` : ""),
      };
    })
    .filter((s) => s.at);

  const found = discoveries(shots);
  const lead = found[0] ?? null;

  // The story comes from the strongest finding; the question comes from the
  // strongest finding that *has* one. Those are usually the same and were
  // assumed to be — but the span, which is the shape a thinly-spread first
  // year produces, deliberately asks nothing. So the page rendered with no
  // question at all while having three things it could have asked about,
  // which is the one thing this page exists to do.
  const asking = found.find((d) => d.ask) ?? null;

  // Has this day already been written about? If so it titles the story, and
  // the question is not asked again. Read back from the archive rather than
  // held in a session — the answer is an ordinary memory now.
  let alreadySaid: string | null = null;
  if (lead) {
    const { data: written } = await db
      .from("memories")
      .select("raw_text")
      .eq("family_id", subject.family_id)
      .eq("memory_date", dayOf(lead.from))
      .eq("type", "text")
      .not("raw_text", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    alreadySaid = (written as any)?.raw_text ?? null;
  }

  const story = lead ? storyFrom({ discovery: lead, answer: alreadySaid }) : null;
  // The moment the product becomes itself, and the step in the funnel that
  // everything before it exists to reach.
  if (story) void note(adminClient(), user.id, { name: "story_made" });

  // Links already out there for this family, so the page can show what has
  // been sent and let it be stopped.
  const { data: shares } = await db
    .from("shared_stories")
    .select("id, created_at, expires_at, revoked_at, view_count")
    .eq("family_id", subject.family_id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  // Read once, here, rather than at each use. This is a server component:
  // it renders once per request, so the clock is a fact about the request
  // rather than an impurity — but the rule cannot tell, so it is named and
  // suppressed in exactly one place instead of scattered.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const live = (shares ?? []).filter(
    (sh: any) => Date.parse(sh.expires_at) > now
  );

  const sent = searchParams.shared
    ? `${homeUrl()}/m/${searchParams.shared}`
    : null;
  const photos = story ? await resolvePhotoUrls(db, story.shotIds) : new Map();

  if (!lead) {
    return (
      <div className="py-16">
        <h1 className="text-title font-display lowercase">nothing to show yet</h1>
        <p className="mt-5 max-w-[50ch] leading-relaxed text-stone">
          There isn&rsquo;t enough in {first}&rsquo;s archive yet for us to find
          anything in it &mdash; or the photographs arrived without the dates
          their camera would normally carry.
        </p>
        <p className="mt-4 max-w-[50ch] leading-relaxed text-stone">
          Drag in a few hundred and come back. We look at when things were
          taken, never at what is in them.
        </p>
        <Link href={`/subjects/${subject.id}/upload`} className="btn mt-8 inline-block">
          Add photographs
        </Link>
      </div>
    );
  }

  return (
    <div className="py-12">
      <p className="text-xs uppercase tracking-[0.18em] text-clay">A story we found</p>

      {/* ------------------------------------------------------- the story */}
      {story && (
        <>
          <h1 className="mt-5 max-w-[18ch] font-display text-5xl leading-[1.1] md:text-6xl">
            {story.title}
          </h1>
          <p className="mt-4 max-w-[46ch] leading-relaxed text-stone">{story.subtitle}</p>

          {photos.size > 0 && (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {story.shotIds
                .filter((id) => photos.has(id))
                .map((id) => (
                  <img
                    key={id}
                    src={photos.get(id)}
                    alt=""
                    className="aspect-[4/5] w-full rounded-lg object-cover"
                  />
                ))}
            </div>
          )}

          <p className="mt-5 text-sm text-stone">
            {dateRange(story.from, story.to)}
            {story.titleFrom === "the calendar" && (
              <>
                {" "}&middot; we haven&rsquo;t called it anything, because you
                haven&rsquo;t
              </>
            )}
          </p>
        </>
      )}

      {/* ------------------------------------------------------ the question
          Only when the day has not already been written about. One question,
          and the answer is an ordinary memory that titles this page from
          then on. */}
      {asking?.ask && !alreadySaid && (
        <section className="mt-12 border-t border-rule pt-8">
          {asking !== lead && (
            <p className="max-w-[54ch] text-sm leading-relaxed text-stone">
              {asking.because}
            </p>
          )}
          {/* The visible question labels the box. An sr-only <label> here
              read the question out a second time, because the paragraph is
              announced too. */}
          <p id="the-question" className="mt-1 max-w-[46ch] font-display text-2xl leading-snug">
            {asking.ask}
          </p>
          <form action={answerDiscovery} className="mt-5 max-w-xl">
            <input type="hidden" name="subject_id" value={subject.id} />
            <input type="hidden" name="day" value={dayOf(asking.from)} />
            <textarea
              id="answer"
              name="answer"
              aria-labelledby="the-question"
              rows={2}
              className="input w-full"
              placeholder="A few words is plenty"
            />
            <button className="btn mt-4">Keep this</button>
          </form>
          <p className="mt-4 max-w-[50ch] text-sm leading-relaxed text-stone">
            Whatever you write becomes the name of this, and goes into
            {" "}{first}&rsquo;s book as an ordinary note on that day.
          </p>
        </section>
      )}

      {/* ------------------------------------------------------- send it
          Only once the family has named it. A link titled "One Saturday in
          February" is a link to a date; the reason to send it to a
          grandmother is that somebody called it something. */}
      {story && alreadySaid && (
        <section className="mt-14 border-t border-rule pt-8">
          <h2 className="font-display text-2xl">Send it to someone</h2>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-stone">
            One link, to this one story. It stops working after a month, you can
            stop it sooner, and whoever opens it can tell you what they remember
            without making an account.
          </p>

          {sent && (
            <div className="mt-5 rounded-2xl bg-card p-5">
              <p className="text-sm text-stone">Ready to send:</p>
              <p className="mt-1 break-all font-display text-lg">{sent}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <form action={shareStory}>
              <input type="hidden" name="subject_id" value={subject.id} />
              <input type="hidden" name="kind" value="found" />
              <input
                type="hidden"
                name="payload"
                value={JSON.stringify({
                  title: story.title,
                  subtitle: story.subtitle,
                  shotIds: story.shotIds,
                  from: story.from,
                  to: story.to,
                })}
              />
              <button className="btn">Make a link</button>
            </form>
          </div>

          {live.length > 0 && (
            <ul className="mt-6 space-y-2 text-sm">
              {live.map((sh: any) => (
                <li key={sh.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-stone">
                    Sent {friendlyDate(sh.created_at)} &middot; opened{" "}
                    {countOf(sh.view_count ?? 0, "time")} &middot; stops{" "}
                    {friendlyDate(sh.expires_at)}
                  </span>
                  <form action={revokeShare}>
                    <input type="hidden" name="share_id" value={sh.id} />
                    <input type="hidden" name="subject_id" value={subject.id} />
                    <button className="text-ochre underline underline-offset-2">Stop it</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* --------------------------------------------------- the other finds
          Shown after the story, not before it. The point of this page is the
          one thing, and a list of five observations at the top turns it into
          a report. */}
      {found.length > 1 && (
        <section className="mt-14 border-t border-rule pt-8">
          <h2 className="text-xs uppercase tracking-[0.18em] text-clay">
            Else we noticed
          </h2>
          <ul className="mt-5 space-y-3">
            {found.slice(1, 5).map((d) => (
              <li key={`${d.finding}-${d.from}`} className="max-w-[54ch] leading-relaxed">
                {d.because}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-[52ch] text-sm leading-relaxed text-stone">
            All of that is counted from when the photographs were taken. We
            don&rsquo;t look at what&rsquo;s in them.
          </p>
        </section>
      )}

      <p className="mt-14 text-sm">
        <Link href={`/subjects/${subject.id}`} className="text-ochre">
          Back to {first}&rsquo;s year
        </Link>
      </p>
    </div>
  );
}
