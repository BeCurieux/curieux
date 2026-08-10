// Child dashboard (brief §23).
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { cancelRenewal } from "@/app/actions";
import { yearWord } from "@/lib/book/structure";
import { ageInYears } from "@/lib/book/format";
import { countOf, friendlyDate } from "@/lib/words";
import { countAwaitingCheck, resolvePhotoUrls } from "@/lib/book/photos";
import { loadLookBack } from "@/lib/lookback/load";
import { bookPriceFor } from "@/lib/billing/price";
import { LookBackPanel } from "./look-back";
import { Weekly } from "./weekly";
import { weeklyNoteFor } from "@/lib/weekly/build";
import { adminClient } from "@/lib/supabase/server";
import { Shelf } from "@/app/shelf";
import { roleForSubject } from "@/lib/family/membership";
import { canEdit, canModerate } from "@/lib/family/roles";
import { bestPrompt } from "@/lib/prompts/engine";
import { countStoryMemories, countUnfiled, recentStoryMemories } from "@/lib/memories/scope";
import { countUntagged } from "@/lib/memories/who";
import { todayIso } from "@/lib/time";
import { loadEntities } from "@/lib/graph/extract";
import { settledFor } from "@/lib/graph/identity-store";
import { knownContext, settledContext } from "@/lib/graph/context-store";
import { whatToAsk } from "@/lib/home/asking";
import { evidenceFor, worthShowing, type Evidence } from "@/lib/graph/evidence";
import { Why } from "@/app/why";

export const dynamic = "force-dynamic";

export default async function ChildDashboard(props: { params: Promise<{ subjectId: string }> }) {
  const params = await props.params;
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await userClient();

  const { data: child } = await db.from("subjects").select("*").eq("id", params.subjectId).single();
  if (!child) redirect("/home");

  const age = child.date_of_birth ? ageInYears(child.date_of_birth) : 0;

  // Warmth here is mostly grammar: use the child's name and the right pronoun
  // rather than "them" and "their". Absent a stated pronoun, they/them — and
  // the verb has to follow it, or every sentence reads as a mail merge.
  const first = child.display_name?.split(" ")[0] ?? child.display_name;
  const subject = child.pronouns?.startsWith("he")
    ? "he"
    : child.pronouns?.startsWith("she")
      ? "she"
      : "they";
  const verb = subject === "they" ? "are" : "is";

  const [memoryCount, recent, { data: clusters }, { count: questionCount }, { data: littleThings }, { data: book }, pending] =
    await Promise.all([
      countStoryMemories(db, child.id),
      recentStoryMemories(db, child.id),
      db.from("memory_clusters").select("id, title, status").eq("subject_id", child.id).eq("status", "suggested").limit(5),
      db.from("follow_up_questions").select("id", { count: "exact", head: true }).eq("subject_id", child.id).eq("status", "pending"),
      db.from("little_things").select("id, category, value, recorded_date").eq("subject_id", child.id).order("recorded_date", { ascending: false }).limit(3),
      db.from("books").select("id, title, status, year_number").eq("subject_id", child.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      countStoryMemories(db, child.id, { pendingOnly: true }),
    ]);

  const role = (await roleForSubject(db, child.id, user.id))?.role ?? null;
  const pendingCount = pending;

  // One question, built from this archive rather than from a template.
  const lastMemoryAt = recent?.[0]?.created_at ?? null;
  // Read once, here, rather than at each use. This is a server component:
  // it renders once per request, so the clock is a fact about the request
  // rather than an impurity — but the rule cannot tell, so it is named and
  // suppressed in exactly one place instead of scattered.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const daysSince = (from: string | null) =>
    from ? Math.floor((now - new Date(from).getTime()) / 86_400_000) : null;
  const lastQuote = (recent ?? []).find((m) => m.type === "quote");
  const prompt = bestPrompt({
    childName: first,
    daysSinceLastMemory: daysSince(lastMemoryAt),
    recentThreads: (clusters ?? []).map((c: any) => c.title).filter(Boolean),
    littleThings: (littleThings ?? []).map((lt: any) => ({
      category: lt.category,
      value: lt.value,
      daysOld: daysSince(lt.recorded_date) ?? 0,
    })),
    emptyMonths: [],
    hasVoiceRecording: (recent ?? []).some((m) => m.type === "voice"),
    daysSinceLastQuote: daysSince(lastQuote?.memory_date ?? lastQuote?.created_at ?? null),
    yearProgress: (new Date().getMonth() + new Date().getDate() / 31) / 12,
  });

  const { data: renewal } = await db
    .from("renewals")
    .select("id, scheduled_for, amount_aud")
    .eq("subject_id", child.id)
    .eq("status", "scheduled")
    .maybeSingle();

  const kept = memoryCount;

  // The year on the dashboard has to be the year in the book, or the two
  // disagree the moment a birthday passes: she turns three while the book
  // being made is still about the year she was two. The book is authoritative
  // when there is one; otherwise fall back to the year now underway.
  const yearNumber = book?.year_number ?? Math.max(1, age);

  // And the tense has to follow: once the birthday has passed, the book is
  // about the year she *was* two, not the year she is.
  const yearVerb =
    yearNumber < age
      ? subject === "they" ? "were" : "was"
      : verb;

  // Today's look-back. Loaded here rather than in a client component so the
  // privacy filtering happens server-side, where the viewer's role is known.
  const look = await loadLookBack(db, child.id, { userId: user.id, role });
  const renewalPrice = await bookPriceFor(db, child.family_id);

  // How much is sitting in the inbox. Almost always zero — arrivals file
  // themselves — so the link reads as an offer rather than a chore queue.
  const waitingToFile = await countUnfiled(db, child.id);

  // How much of the archive has nobody's name on it. Untagged is a real
  // answer — those memories are in the household's year — but it is also the
  // one thing standing between this family and a second book, so it is worth
  // a line rather than a settings page.
  const untagged = await countUntagged(db, child.family_id);

  // This week's noticing. Written the first time somebody who can answer it
  // opens the page, and read from then on — so the sentence holds still for
  // the week and the Keep/Ignore buttons have a row to point at.
  const weekly = await weeklyNoteFor(db, child.id, {
    write: canEdit(role) ? adminClient() : null,
  });

  // What the archive can see and cannot explain. Both of these pages were
  // reachable only by typing the URL until now — /who shipped with no inbound
  // link at all — and a question nobody is offered is a question nobody
  // answers.
  const entities = await loadEntities(db, child.id);
  const asks = whatToAsk({
    subjectId: child.id,
    entities,
    today: todayIso(),
    settledContext: await settledContext(db, child.family_id),
    settledIdentity: await settledFor(db, child.family_id),
    prompt,
    followUps: questionCount ?? 0,
  });

  // The people this year has in it, most-present first. Read from the graph
  // rather than from the family list, because the graph knows who actually
  // turns up — a membership row is an intention and a mention is a fact.
  const people = entities
    .filter((e) => e.kind === "person")
    .sort((a, b) => b.mentions.length - a.mentions.length)
    .slice(0, 8);

  // What the family has explained about their own archive. The only place in
  // the product that shows the thing they are actually building: not
  // photographs, but what the photographs were of.
  const told = (await knownContext(db, child.family_id)).slice(0, 3);

  // The memories behind each thing this page says, so every line can be
  // opened and checked. Bounded and concurrent: the note is three
  // observations at most and the list three questions, so this is six small
  // queries at worst — but six *sequential* round trips on the page a parent
  // opens most often is the kind of thing that quietly makes a product feel
  // slow, and there is no reason for them to wait on each other.
  const receipts = async (of: { key: string; memoryIds: string[] }[]) =>
    Object.fromEntries(
      await Promise.all(
        of
          .filter((x) => worthShowing(x.memoryIds))
          .map(async (x) => [x.key, await evidenceFor(db, x.memoryIds)] as const)
      )
    ) as Record<string, Evidence[]>;

  const [weeklyEvidence, askEvidence] = await Promise.all([
    receipts(weekly.observations.map((o) => ({ key: o.entityId, memoryIds: o.memoryIds }))),
    receipts(asks.map((a) => ({ key: a.id, memoryIds: a.memoryIds }))),
  ]);

  const recentPhotoIds = (recent ?? []).filter((m) => m.type === "photo").map((m) => m.id);
  const recentPhotos = await resolvePhotoUrls(db, recentPhotoIds);
  // Photographs are withheld until they have been read server-side. That is
  // right, but silent — and a parent who has just uploaded and sees nothing
  // would reasonably think it failed.
  const awaitingCheck = await countAwaitingCheck(db, recentPhotoIds);

  return (
    <div className="py-10">
      {/* ------------------------------------------------------------ who */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{child.display_name}</h1>
          {/* Not a count. "You've kept 63 things" is a progress bar with the
              numbers spelled out, and this is not a productivity product —
              a parent should not be able to be behind on their child's
              childhood. */}
          <p className="mt-1 text-stone">
            {kept === 0 ? (
              <>
                The year {subject} {yearVerb} {yearWord(yearNumber).toLowerCase()}.
                It starts whenever you do.
              </>
            ) : (
              <>
                The year {subject} {yearVerb} {yearWord(yearNumber).toLowerCase()} &middot;
                taking shape
              </>
            )}
          </p>
        </div>
        {book ? (
          <Link href={`/books/${book.id}`} className="btn">
            {book.status === "review"
              ? "Read it through"
              : book.status === "print_ready" || book.status === "approved"
                ? "Ready to print"
                : `${first}\u2019s book`}
          </Link>
        ) : (
          <Link href="/books/new" className="btn">
            Make a book
          </Link>
        )}
      </div>

      {/* ------------------------------------------------------- I noticed
          The top of the page, and the only part of it that gives without
          wanting. It used to sit in a beige panel identical to the seven
          below it, which made the one genuinely alive thing on the screen
          look like another module. Now it is the page's opening sentence. */}
      <div className="mt-12">
        <Weekly note={weekly} subjectId={child.id} evidence={weeklyEvidence} />
      </div>

      <div className="mt-8">
        <LookBackPanel look={look} subjectId={child.id} first={first} />
      </div>

      {/* --------------------------------------------- worth answering
          One list, three at most, from every source that has a question.
          There were four separate places asking for something; a parent
          cannot tell the difference between four thoughtful questions and
          a queue, and a queue is homework. */}
      {asks.length > 0 && (
        <section className="mt-14 border-t border-rule pt-8">
          <h2 className="text-xs uppercase tracking-[0.18em] text-clay">
            {asks.length === 1 ? "Worth answering" : "Worth answering"}
          </h2>
          <ul className="mt-5 space-y-6">
            {asks.map((ask) => (
              <li key={ask.id}>
                <Link href={ask.href} className="group block">
                  {ask.because && (
                    <p className="max-w-[54ch] text-sm leading-relaxed text-stone">
                      {ask.because}
                    </p>
                  )}
                  <p className="mt-1 max-w-[46ch] font-display text-xl leading-snug group-hover:text-ochre">
                    {ask.question}
                  </p>
                </Link>
                <Why
                  evidence={askEvidence[ask.id] ?? []}
                  total={ask.memoryIds.length}
                  what="we asked"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------------- the input
          One primary action rather than a row of three equal cards. Adding
          is the only thing on this page the product actually needs. */}
      <section className="mt-14 border-t border-rule pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">Add to {first}&rsquo;s year</h2>
            <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-stone">
              Photos, something {subject} said, a day you don&rsquo;t want to lose.
            </p>
          </div>
          <Link href={`/subjects/${child.id}/upload`} className="btn">
            Add something
          </Link>
        </div>

        {littleThings && littleThings.length > 0 && (
          <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-stone">
            <Link href={`/subjects/${child.id}/little-things`} className="text-ochre">
              Right now
            </Link>{" "}
            &middot; {littleThings.map((lt) => lt.value).join(" \u00b7 ")}
          </p>
        )}
      </section>

      {/* --------------------------------------------------- what we found
          Offered rather than automatic. The first-run story is the strongest
          thing the product does before a family has typed anything, and it
          stays worth opening afterwards — the day it picks changes as more
          goes in. */}
      {kept > 0 && (
        <section className="mt-14 border-t border-rule pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl">A story we found</h2>
              <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-stone">
                One day out of everything you&rsquo;ve added, picked by how much
                of it there is. Counted from when the photographs were taken.
              </p>
            </div>
            <Link href={`/subjects/${child.id}/found`} className="btn-secondary">
              Show me
            </Link>
          </div>
          <p className="mt-5 text-sm">
            <Link href={`/subjects/${child.id}/film`} className="text-ochre">
              Or the whole year, in a minute
            </Link>
          </p>
        </section>
      )}

      {/* ------------------------------------------------- the people in it
          From the graph rather than the family list, because a membership
          row is an intention and a mention is a fact. */}
      {people.length > 0 && (
        <section className="mt-14 border-t border-rule pt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Who&rsquo;s in it</h2>
            <Link href={`/subjects/${child.id}/tag`} className="text-sm text-ochre">
              {untagged > 0 ? `Say who\u2019s in ${countOf(untagged, "thing")}` : "Say who's in things"}
            </Link>
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            {people.map((person) => (
              <li key={person.id}>
                <span className="font-display text-lg">{person.label}</span>{" "}
                <span className="text-sm text-stone">
                  {countOf(person.mentions.length, "time")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------ what you've told us
          The compounding asset, made visible. Nothing else in the product
          shows a family what they are actually building — which is not the
          photographs, it is what the photographs were of. */}
      {told.length > 0 && (
        <section className="mt-14 border-t border-rule pt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl">What you&rsquo;ve told us</h2>
            <Link href={`/subjects/${child.id}/about`} className="text-sm text-ochre">
              All of it
            </Link>
          </div>
          <ul className="mt-5 space-y-5">
            {told.map((t) => (
              <li key={`${t.entityKey}-${t.wondering}`} className="max-w-[54ch]">
                <p className="text-sm leading-relaxed text-stone">{t.because}</p>
                <p className="mt-1 font-display text-lg leading-snug">{t.answer}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {clusters && clusters.length > 0 && (
        <section className="mt-14 border-t border-rule pt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Things that keep coming up</h2>
            <Link href={`/subjects/${child.id}/clusters`} className="text-sm text-ochre">See them all</Link>
          </div>
          <p className="mt-1 text-sm text-stone">
            We noticed these in {first}&rsquo;s year. Tell us which ones matter.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {clusters.map((c) => (
              <span key={c.id} className="rounded-full border border-rule bg-white px-4 py-1.5 text-sm">
                {c.title}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Their own shelf. The years already made are in their colours; the
          ones still to come are drawn as the space they will take. */}
      <section className="mt-14 border-t border-rule pt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">{first}&rsquo;s shelf</h2>
          <span className="text-sm text-stone">
            {countOf(yearNumber, "volume")} of eighteen
          </span>
        </div>
        <Shelf
          from={1}
          count={8}
          owned={Array.from({ length: yearNumber }, (_, i) => i + 1)}
          current={yearNumber}
          className="mt-4"
        />
        <p className="mt-4 text-sm text-stone">
          {first}&rsquo;s year is better with the people who were there.{" "}
          <Link href={`/family/${child.family_id}`} className="text-ochre">
            Who can see this
          </Link>
        </p>
      </section>

      {/* A charge nobody can find except in an inbox is exactly what turns
          into a dispute. It sits on the dashboard, with the date, the amount
          and the way out, for everyone in the family to see. */}
      {renewal && (
        <div className="card mt-12 border-clay">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg">
                Printing on {friendlyDate(renewal.scheduled_for)}
              </h2>
              {/* The amount comes from the family's plan, not from the
                  renewal row. This card quoted renewal.amount_aud, which is
                  the full price — so a monthly member whose book is already
                  included was told on their own dashboard that we would
                  charge them A$199 for it. */}
              <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-stone">
                {renewalPrice.amountAud === 0 ? (
                  <>
                    We&rsquo;ll send {first}&rsquo;s book to print that day.
                    Nothing to pay &mdash; it&rsquo;s included in your
                    membership. Read it through before then and change
                    anything you like.
                  </>
                ) : (
                  <>
                    We&rsquo;ll charge A${Math.round(renewalPrice.amountAud / 100)} that day and
                    send {first}&rsquo;s book to print. Read it through before then and change
                    anything you like.
                  </>
                )}
              </p>
            </div>
            <form action={cancelRenewal}>
              <input type="hidden" name="renewal_id" value={renewal.id} />
              <input type="hidden" name="subject_id" value={child.id} />
              <button className="text-sm text-stone hover:text-ink">Not this year</button>
            </form>
          </div>
        </div>
      )}

      {pendingCount > 0 && canModerate(role) && (
        <Link
          href={`/subjects/${child.id}/review`}
          className="card mt-12 flex items-center justify-between border-clay hover:border-ink"
        >
          <div>
            <h2 className="text-lg">{countOf(pendingCount, "thing")} waiting on you</h2>
            <p className="mt-1 text-sm text-stone">
              {first}&rsquo;s family have added something. Nothing reaches the
              book until you&rsquo;ve seen it.
            </p>
          </div>
          <span className="text-ochre" aria-hidden>&rarr;</span>
        </Link>
      )}

      <section className="mt-14 border-t border-rule pt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Lately</h2>
          <Link href={`/subjects/${child.id}/years`} className="text-sm text-ochre">
            All of {first}&rsquo;s years
          </Link>
        </div>
        {awaitingCheck > 0 && (
          <p className="mt-2 text-sm text-stone">
            {countOf(awaitingCheck, "photograph", "photographs")} still being
            checked &mdash; they&rsquo;ll appear here on their own. We read
            every file before showing it to anyone.
          </p>
        )}
        {recent && recent.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {/* No type badges. A quote is shown as a quote and a photo says so
                quietly — the parent should see the things they kept, not the
                rows of a table with a column for what kind each one is. */}
            {recent.map((m) => (
              <li key={m.id} className="card flex items-center gap-3 !p-3 text-sm">
                {/* Show the photograph, not the word "photograph". */}
                {recentPhotos.has(m.id) && (
                  <img
                    src={recentPhotos.get(m.id)}
                    alt=""
                    className="h-12 w-12 flex-none rounded object-cover"
                  />
                )}
                <span className="flex-1">
                  {m.type === "quote" && m.raw_text ? (
                    <span className="font-display text-base">&ldquo;{m.raw_text}&rdquo;</span>
                  ) : m.raw_text ? (
                    <span className="reading">{m.raw_text}</span>
                  ) : (
                    <span className="text-stone">A photograph</span>
                  )}
                </span>
                {m.memory_date && (
                  <span className="flex-none text-xs text-stone">{friendlyDate(m.memory_date)}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 max-w-[46ch] text-sm text-stone">
            Nothing here yet. Photos are the easiest way in &mdash; drag in a
            few hundred and we&rsquo;ll take it from there.
          </p>
        )}
      </section>
    </div>
  );
}
