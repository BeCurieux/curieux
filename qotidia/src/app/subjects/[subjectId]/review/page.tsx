// What the family has added, waiting on you.
//
// The moderation queue. This is not a spam filter — the people here were
// invited by the parent and are the child's grandparents. It exists because
// the parent is answerable for every word and photograph printed about their
// child, and because a book assembled from things they never saw would break
// the one promise the whole product rests on.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { judgeContribution, reviewContribution } from "@/app/actions";
import { memberLabel, membersOfFamily, roleForSubject } from "@/lib/family/membership";
import { canModerate } from "@/lib/family/roles";
import { resolvePhotoUrls } from "@/lib/book/photos";
import { storyMemoryQuery } from "@/lib/memories/scope";
import { countOf, friendlyDate } from "@/lib/words";

export const dynamic = "force-dynamic";

export default async function ReviewPage(props: { params: Promise<{ subjectId: string }> }) {
  const params = await props.params;
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await userClient();

  const { data: subject } = await db
    .from("subjects")
    .select("id, display_name, family_id")
    .eq("id", params.subjectId)
    .single();
  if (!subject) redirect("/home");

  const membership = await roleForSubject(db, params.subjectId, user.id);
  if (!canModerate(membership?.role ?? null)) redirect(`/subjects/${params.subjectId}`);

  const scoped = await storyMemoryQuery(
    db,
    params.subjectId,
    "id, type, raw_text, memory_date, created_at, created_by"
  );
  const { data: pending } = scoped
    ? await scoped.query.eq("contribution_status", "pending").order("created_at", { ascending: false })
    : { data: [] };

  const rows = (pending ?? []) as any[];
  const photos = await resolvePhotoUrls(db, rows.filter((m) => m.type === "photo").map((m) => m.id));

  const members = await membersOfFamily(db, subject.family_id);
  const nameOf = (userId: string) => {
    const m = members.find((x) => x.userId === userId);
    return m ? memberLabel(m) : "Someone";
  };

  const first = subject.display_name?.split(" ")[0] ?? subject.display_name;

  // What came back from links the family sent. These arrive from people
  // with no account, so they are not memories yet and cannot be — there is
  // no created_by to point at. They wait here alongside everything else
  // waiting, which is the right place: the decision is identical.
  const { data: fromLinks } = await db
    .from("story_contributions")
    .select("id, said_by, body, created_at")
    .eq("family_id", subject.family_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const contributions = (fromLinks ?? []) as any[];

  return (
    <div className="mx-auto !max-w-2xl py-10">
      <Link href={`/subjects/${subject.id}`} className="text-sm text-ochre">
        &larr; {first}
      </Link>
      <h1 className="mt-2 text-3xl">Waiting on you</h1>
      <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-stone">
        Things {first}&rsquo;s family have added. Nothing here can reach the
        book until you say so. Keep what&rsquo;s right, leave out what
        isn&rsquo;t &mdash; no one is told what you declined.
      </p>

      {/* ------------------------------------------- sent back through a link
          Above the ordinary queue. Somebody without an account went to the
          trouble of typing this, and they are the least likely person to be
          asked again if it is missed. */}
      {contributions.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl">
            {countOf(contributions.length, "person", "people")} answered a story you sent
          </h2>
          <ul className="mt-5 space-y-4">
            {contributions.map((c) => (
              <li key={c.id} className="panel md:!p-7">
                <p className="reading text-lg">{c.body}</p>
                <p className="mt-3 text-sm text-stone">
                  {c.said_by} &middot; {friendlyDate(c.created_at)}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {[
                    ["keep", "Keep this"],
                    ["decline", "Leave it out"],
                  ].map(([verdict, label]) => (
                    <form action={judgeContribution} key={verdict}>
                      <input type="hidden" name="contribution_id" value={c.id} />
                      <input type="hidden" name="subject_id" value={subject.id} />
                      <input type="hidden" name="verdict" value={verdict} />
                      <button className={verdict === "keep" ? "btn !px-5 !py-2 text-sm" : "btn-secondary !px-5 !py-2 text-sm"}>
                        {label}
                      </button>
                    </form>
                  ))}
                </div>
                <p className="mt-4 max-w-[48ch] text-xs leading-relaxed text-stone">
                  Kept, it goes into the archive with {c.said_by}&rsquo;s name on it.
                  They are not told either way.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 && contributions.length === 0 ? (
        <p className="mt-10 max-w-[46ch] text-sm leading-relaxed text-stone">
          Nothing waiting. When a grandparent adds a photograph or something
          they remember, it will appear here first.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((m) => (
            <li key={m.id} className="card">
              <div className="flex gap-4">
                {photos.has(m.id) && (
                  <img
                    src={photos.get(m.id)}
                    alt=""
                    className="h-24 w-24 flex-none rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  {m.type === "quote" && m.raw_text ? (
                    <p className="font-display text-lg">&ldquo;{m.raw_text}&rdquo;</p>
                  ) : m.raw_text ? (
                    <p className="reading">{m.raw_text}</p>
                  ) : (
                    <p className="text-stone">A photograph</p>
                  )}
                  {/* Who added it is most of the judgement: the same
                      photograph means something different from Grandpa than
                      from a godparent who met them twice. */}
                  <p className="mt-2 text-xs text-stone">
                    {nameOf(m.created_by)} &middot; added {friendlyDate(m.created_at)}
                    {m.memory_date ? ` · from ${friendlyDate(m.memory_date)}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2 border-t border-rule pt-4">
                <form action={reviewContribution}>
                  <input type="hidden" name="memory_id" value={m.id} />
                  <input type="hidden" name="subject_id" value={subject.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button className="btn !px-5 !py-2 text-xs">Keep this</button>
                </form>
                <form action={reviewContribution}>
                  <input type="hidden" name="memory_id" value={m.id} />
                  <input type="hidden" name="subject_id" value={subject.id} />
                  <input type="hidden" name="decision" value="decline" />
                  <button className="btn-secondary !px-5 !py-2 text-xs">Leave out</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
