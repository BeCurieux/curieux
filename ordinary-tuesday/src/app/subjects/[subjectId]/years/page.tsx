// The archive itself — their years, month by month.
//
// Until now the app could only be written to: you added things and the next
// sight of them was the finished book. That makes it a chore with a reward
// twelve months away. This is the room the family actually comes back to,
// which is the difference between an annual purchase and a place people live.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { addComment } from "@/app/actions";
import { roleForSubject, membersOfFamily, memberLabel } from "@/lib/family/membership";
import { resolvePhotoUrls } from "@/lib/book/photos";
import { friendlyDate, monthName } from "@/lib/words";
import { ageInYears } from "@/lib/book/format";
import { yearWord } from "@/lib/book/structure";

export const dynamic = "force-dynamic";

export default async function YearsPage({
  params,
  searchParams,
}: {
  params: { subjectId: string };
  searchParams: { year?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: subject } = await db
    .from("subjects")
    .select("id, display_name, date_of_birth, family_id")
    .eq("id", params.subjectId)
    .single();
  if (!subject) redirect("/home");

  const membership = await roleForSubject(db, params.subjectId, user.id);
  if (!membership) redirect("/home");

  const { data: memories } = await db
    .from("memories")
    .select("id, type, raw_text, memory_date, created_at, created_by, contribution_status")
    .eq("subject_id", subject.id)
    .order("memory_date", { ascending: false })
    .limit(400);

  const rows = memories ?? [];

  // Group by the calendar year the thing happened in, then by month within
  // it — the way anyone actually looks back at a life.
  const byYear = new Map<number, typeof rows>();
  for (const m of rows) {
    const when = m.memory_date ?? m.created_at;
    const y = new Date(when).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(m);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const shown = searchParams.year ? Number(searchParams.year) : years[0];
  const inYear = byYear.get(shown) ?? [];

  const photos = await resolvePhotoUrls(db, inYear.filter((m) => m.type === "photo").map((m) => m.id));

  const { data: comments } = await db
    .from("memory_comments")
    .select("id, memory_id, body, author_user_id, created_at")
    .in("memory_id", inYear.map((m) => m.id).slice(0, 200))
    .order("created_at");

  const members = await membersOfFamily(db, subject.family_id);
  const nameOf = (userId: string) => {
    const m = members.find((x) => x.userId === userId);
    return m ? memberLabel(m) : "Someone";
  };

  const commentsFor = (memoryId: string) =>
    (comments ?? []).filter((c) => c.memory_id === memoryId);

  const first = subject.display_name?.split(" ")[0] ?? subject.display_name;

  // A calendar year always straddles two ages, so "the year she was three" is
  // wrong for half of it. Their birthday falls inside every year they live
  // through, so what is always true is the year they *turned* it.
  const birthYear = subject.date_of_birth ? new Date(subject.date_of_birth).getFullYear() : null;
  const turned = subject.date_of_birth
    ? ageInYears(subject.date_of_birth, new Date(`${shown}-12-31T12:00:00Z`))
    : null;
  const yearLabel =
    birthYear === null ? null
    : shown === birthYear ? `The year ${first} was born`
    : turned !== null ? `The year ${first} turned ${yearWord(turned).toLowerCase()}`
    : null;

  // Group the chosen year by month.
  const byMonth = new Map<string, typeof inYear>();
  for (const m of inYear) {
    const key = monthName(m.memory_date ?? m.created_at);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(m);
  }

  return (
    <div className="py-10">
      <Link href={`/subjects/${subject.id}`} className="text-sm text-ochre">&larr; {first}</Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title">{shown}</h1>
          <p className="mt-1 text-stone">
            {yearLabel && <>{yearLabel} &middot; </>}
            {inYear.length} {inYear.length === 1 ? "thing" : "things"} kept
          </p>
        </div>
        {years.length > 1 && (
          <nav className="flex flex-wrap gap-2">
            {years.map((y) => (
              <Link
                key={y}
                href={`/subjects/${subject.id}/years?year=${y}`}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  y === shown ? "border-ink bg-ink text-paper" : "border-rule bg-white hover:border-ink"
                }`}
              >
                {y}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {inYear.length === 0 ? (
        <p className="mt-12 max-w-[46ch] text-sm leading-relaxed text-stone">
          Nothing kept from this year yet.{" "}
          <Link className="text-ochre" href={`/subjects/${subject.id}/upload`}>
            Add something
          </Link>
          .
        </p>
      ) : (
        <div className="mt-12 space-y-14">
          {[...byMonth.entries()].map(([month, entries]) => (
            <section key={month}>
              <h2 className="border-b border-rule pb-2 text-xl">{month}</h2>
              <ul className="mt-6 space-y-4">
                {entries.map((m) => {
                  const mine = m.created_by === user.id;
                  const waiting = m.contribution_status === "pending";
                  return (
                    <li key={m.id} className="card">
                      {waiting && (
                        <p className="mb-3 text-xs text-ochre">
                          {mine ? "Waiting for approval" : "Waiting on you"}
                        </p>
                      )}
                      <div className="flex gap-4">
                        {photos.has(m.id) && (
                          <img
                            src={photos.get(m.id)}
                            alt=""
                            className="h-28 w-28 flex-none rounded object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          {m.type === "quote" && m.raw_text ? (
                            <p className="font-display text-lg leading-snug">
                              &ldquo;{m.raw_text}&rdquo;
                            </p>
                          ) : m.raw_text ? (
                            <p className="leading-relaxed">{m.raw_text}</p>
                          ) : (
                            <p className="text-stone">A photograph</p>
                          )}
                          <p className="mt-2 text-xs text-stone">
                            {friendlyDate(m.memory_date ?? m.created_at)}
                            {!mine && <> &middot; kept by {nameOf(m.created_by)}</>}
                          </p>
                        </div>
                      </div>

                      {commentsFor(m.id).length > 0 && (
                        <ul className="mt-4 space-y-2 border-t border-rule pt-4">
                          {commentsFor(m.id).map((c) => (
                            <li key={c.id} className="text-sm">
                              <span className="text-stone">{nameOf(c.author_user_id)}:</span>{" "}
                              {c.body}
                            </li>
                          ))}
                        </ul>
                      )}

                      <form action={addComment} className="mt-3 flex gap-2">
                        <input type="hidden" name="memory_id" value={m.id} />
                        <input type="hidden" name="subject_id" value={subject.id} />
                        <input
                          className="input flex-1 !py-1.5 text-xs"
                          name="body"
                          placeholder="Say something about this…"
                        />
                        <button className="btn-secondary !px-4 !py-1.5 text-xs">Add</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
