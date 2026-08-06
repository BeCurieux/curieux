// Child dashboard (brief §23).
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { cancelRenewal, createBook } from "@/app/actions";
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

export const dynamic = "force-dynamic";

export default async function ChildDashboard({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

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

  const [{ count: memoryCount }, { data: recent }, { data: clusters }, { count: questionCount }, { data: littleThings }, { data: book }, { count: pending }] =
    await Promise.all([
      db.from("memories").select("id", { count: "exact", head: true }).eq("subject_id", child.id),
      db.from("memories").select("id, type, raw_text, memory_date, created_at").eq("subject_id", child.id).order("created_at", { ascending: false }).limit(5),
      db.from("memory_clusters").select("id, title, status").eq("subject_id", child.id).eq("status", "suggested").limit(5),
      db.from("follow_up_questions").select("id", { count: "exact", head: true }).eq("subject_id", child.id).eq("status", "pending"),
      db.from("little_things").select("id, category, value, recorded_date").eq("subject_id", child.id).order("recorded_date", { ascending: false }).limit(3),
      db.from("books").select("id, title, status, year_number").eq("subject_id", child.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("memories").select("id", { count: "exact", head: true })
        .eq("subject_id", child.id).eq("contribution_status", "pending"),
    ]);

  const role = (await roleForSubject(db, child.id, user.id))?.role ?? null;
  const pendingCount = pending ?? 0;

  // One question, built from this archive rather than from a template.
  const lastMemoryAt = recent?.[0]?.created_at ?? null;
  const daysSince = (from: string | null) =>
    from ? Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000) : null;
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

  const kept = memoryCount ?? 0;

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

  // This week's noticing. Written the first time somebody who can answer it
  // opens the page, and read from then on — so the sentence holds still for
  // the week and the Keep/Ignore buttons have a row to point at.
  const weekly = await weeklyNoteFor(db, child.id, {
    write: canEdit(role) ? adminClient() : null,
  });

  const recentPhotoIds = (recent ?? []).filter((m) => m.type === "photo").map((m) => m.id);
  const recentPhotos = await resolvePhotoUrls(db, recentPhotoIds);
  // Photographs are withheld until they have been read server-side. That is
  // right, but silent — and a parent who has just uploaded and sees nothing
  // would reasonably think it failed.
  const awaitingCheck = await countAwaitingCheck(db, recentPhotoIds);

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{child.display_name}</h1>
          <p className="mt-1 text-stone">
            {kept === 0 ? (
              <>
                The year {subject} {yearVerb} {yearWord(yearNumber).toLowerCase()}.
                It starts whenever you do.
              </>
            ) : (
              <>
                The year {subject} {yearVerb} {yearWord(yearNumber).toLowerCase()} &middot;
                you&rsquo;ve kept {countOf(kept, "thing")} of it so far
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
                : `${first}’s book`}
          </Link>
        ) : (
          <form action={createBook}>
            <input type="hidden" name="subject_id" value={child.id} />
            <button className="btn">Make {first}&rsquo;s book</button>
          </form>
        )}
      </div>

      {/* Above everything that asks the parent to do something. This is the
          only part of the page that gives without wanting, and it is the
          reason to open the app on the days when there is no book to make. */}
      <div className="mt-8 space-y-4">
        <Weekly note={weekly} subjectId={child.id} />
        <LookBackPanel look={look} subjectId={child.id} first={first} />
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Link href={`/subjects/${child.id}/upload`} className="card hover:border-clay">
          <h2 className="text-lg">Add to {first}&rsquo;s year</h2>
          <p className="mt-1 text-sm text-stone">
            Photos, something {subject} said, a day you don&rsquo;t want to lose.
          </p>
        </Link>
        <Link href={`/subjects/${child.id}/little-things`} className="card hover:border-clay">
          <h2 className="text-lg">The little things</h2>
          <p className="mt-1 text-sm text-stone">
            {littleThings && littleThings.length > 0
              ? littleThings.map((lt) => lt.value).join(" · ")
              : `Right now — what ${verb} ${subject} obsessed with?`}
          </p>
        </Link>
        <Link href={`/subjects/${child.id}/questions`} className="card hover:border-clay">
          <h2 className="text-lg">
            {questionCount
              ? <>We wondered {countOf(questionCount, "thing")}</>
              : <>Nothing to ask, yet</>}
          </h2>
          <p className="mt-1 text-sm text-stone">
            {questionCount
              ? `Only what ${first}’s photos couldn’t tell us.`
              : "When the photos leave something out, we'll ask you here."}
          </p>
        </Link>
      </div>

      {prompt && (
        <Link
          href={`/subjects/${child.id}/upload`}
          className="card mt-10 block hover:border-clay"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-ochre">A small question</p>
          <p className="mt-2 max-w-[46ch] font-display text-xl leading-snug">
            {prompt.question}
          </p>
          {/* Why this one, so it reads as somebody having looked rather than
              a reminder on a timer. */}
          <p className="mt-2 max-w-[48ch] text-sm text-stone">{prompt.because}</p>
        </Link>
      )}

      {clusters && clusters.length > 0 && (
        <section className="mt-10">
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
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">{first}&rsquo;s shelf</h2>
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

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">Lately</h2>
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
                    <span>{m.raw_text}</span>
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
