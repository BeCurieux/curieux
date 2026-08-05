// Child dashboard (brief §23).
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { createBook } from "@/app/actions";
import { yearWord } from "@/lib/book/structure";
import { ageInYears } from "@/lib/book/format";

export const dynamic = "force-dynamic";

export default async function ChildDashboard({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: child } = await db.from("subjects").select("*").eq("id", params.subjectId).single();
  if (!child) redirect("/home");

  const age = child.date_of_birth ? ageInYears(child.date_of_birth) : 0;

  const [{ count: memoryCount }, { data: recent }, { data: clusters }, { count: questionCount }, { data: littleThings }, { data: book }] =
    await Promise.all([
      db.from("memories").select("id", { count: "exact", head: true }).eq("subject_id", child.id),
      db.from("memories").select("id, type, raw_text, memory_date").eq("subject_id", child.id).order("created_at", { ascending: false }).limit(5),
      db.from("memory_clusters").select("id, title, status").eq("subject_id", child.id).eq("status", "suggested").limit(5),
      db.from("follow_up_questions").select("id", { count: "exact", head: true }).eq("subject_id", child.id).eq("status", "pending"),
      db.from("little_things").select("id, category, value").eq("subject_id", child.id).order("recorded_date", { ascending: false }).limit(3),
      db.from("books").select("id, title, status").eq("subject_id", child.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{child.display_name}</h1>
          <p className="mt-1 text-stone">
            The year {child.pronouns?.startsWith("he") ? "he is" : child.pronouns?.startsWith("she") ? "she is" : "they are"}{" "}
            {yearWord(Math.max(1, age)).toLowerCase()} · {memoryCount ?? 0} memories kept
          </p>
        </div>
        {book ? (
          <Link href={`/books/${book.id}`} className="btn">
            {book.status === "review" ? "Continue editing" : book.status === "print_ready" || book.status === "approved" ? "Ready to print" : "Their book"}
          </Link>
        ) : (
          <form action={createBook}>
            <input type="hidden" name="subject_id" value={child.id} />
            <button className="btn">Create their book</button>
          </form>
        )}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Link href={`/subjects/${child.id}/upload`} className="card hover:border-boot">
          <h2 className="text-lg">Add memories</h2>
          <p className="mt-1 text-sm text-stone">Photos, quotes, moments — straight from your camera roll.</p>
        </Link>
        <Link href={`/subjects/${child.id}/little-things`} className="card hover:border-boot">
          <h2 className="text-lg">The little things</h2>
          <p className="mt-1 text-sm text-stone">
            {littleThings && littleThings.length > 0
              ? littleThings.map((lt) => lt.value).join(" · ")
              : "Right now… what are they obsessed with?"}
          </p>
        </Link>
        <Link href={`/subjects/${child.id}/questions`} className="card hover:border-boot">
          <h2 className="text-lg">Questions waiting {questionCount ? <span className="text-boot">({questionCount})</span> : null}</h2>
          <p className="mt-1 text-sm text-stone">Only the ones the photos can&rsquo;t answer.</p>
        </Link>
      </div>

      {clusters && clusters.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Suggested stories</h2>
            <Link href={`/subjects/${child.id}/clusters`} className="text-sm text-boot">Review all</Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {clusters.map((c) => (
              <span key={c.id} className="rounded-full border border-rule bg-white px-4 py-1.5 text-sm">
                {c.title}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl">Recent memories</h2>
        <ul className="mt-4 space-y-2">
          {(recent ?? []).map((m) => (
            <li key={m.id} className="card !p-4 text-sm">
              <span className="mr-2 rounded bg-rule px-2 py-0.5 text-xs uppercase tracking-wide">{m.type}</span>
              {m.raw_text ?? (m.type === "photo" ? "Photo" : m.type)}
              {m.memory_date && <span className="ml-2 text-stone">{m.memory_date}</span>}
            </li>
          ))}
          {(!recent || recent.length === 0) && (
            <li className="text-sm text-stone">Nothing yet — start with a few photos.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
