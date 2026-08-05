// Child dashboard (brief §23).
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { createBook } from "@/app/actions";
import { yearWord } from "@/lib/book/structure";
import { ageInYears } from "@/lib/book/format";
import { countOf, friendlyDate } from "@/lib/words";
import { resolvePhotoUrls } from "@/lib/book/photos";
import { Shelf } from "@/app/shelf";

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

  const [{ count: memoryCount }, { data: recent }, { data: clusters }, { count: questionCount }, { data: littleThings }, { data: book }] =
    await Promise.all([
      db.from("memories").select("id", { count: "exact", head: true }).eq("subject_id", child.id),
      db.from("memories").select("id, type, raw_text, memory_date").eq("subject_id", child.id).order("created_at", { ascending: false }).limit(5),
      db.from("memory_clusters").select("id, title, status").eq("subject_id", child.id).eq("status", "suggested").limit(5),
      db.from("follow_up_questions").select("id", { count: "exact", head: true }).eq("subject_id", child.id).eq("status", "pending"),
      db.from("little_things").select("id, category, value").eq("subject_id", child.id).order("recorded_date", { ascending: false }).limit(3),
      db.from("books").select("id, title, status, year_number").eq("subject_id", child.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

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

  const recentPhotos = await resolvePhotoUrls(
    db,
    (recent ?? []).filter((m) => m.type === "photo").map((m) => m.id)
  );

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

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Link href={`/subjects/${child.id}/upload`} className="card hover:border-boot">
          <h2 className="text-lg">Add to {first}&rsquo;s year</h2>
          <p className="mt-1 text-sm text-stone">
            Photos, something {subject} said, a day you don&rsquo;t want to lose.
          </p>
        </Link>
        <Link href={`/subjects/${child.id}/little-things`} className="card hover:border-boot">
          <h2 className="text-lg">The little things</h2>
          <p className="mt-1 text-sm text-stone">
            {littleThings && littleThings.length > 0
              ? littleThings.map((lt) => lt.value).join(" · ")
              : `Right now — what ${verb} ${subject} obsessed with?`}
          </p>
        </Link>
        <Link href={`/subjects/${child.id}/questions`} className="card hover:border-boot">
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
      </section>

      <section className="mt-12">
        <h2 className="text-xl">Lately</h2>
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
