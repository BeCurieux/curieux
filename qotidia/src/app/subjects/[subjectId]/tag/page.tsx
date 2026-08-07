// Who's in these?
//
// The screen the whole one-archive-many-books idea rests on. Nothing in this
// product infers who is in a photograph, so the only way a Cornwall morning
// reaches both children's books is if somebody says so — and if saying so is
// slow, nobody will. The archive then quietly becomes one book's worth of
// material with two hundred untagged photographs beside it, which looks
// exactly like a working archive until the day a family wants a second book.
//
// So this is built around one number: how many taps to tag forty
// photographs. Select the ones that are Theo, tap Theo, done. Not a form per
// photograph, not a modal, not a save button per row.
//
// It shows untagged photographs first and by default, because those are the
// ones where a tap changes something. A screen that opens on everything ever
// kept is a screen that opens on work already done.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { roleForSubject } from "@/lib/family/membership";
import { canEdit } from "@/lib/family/roles";
import { peopleInFamily, whoIsIn } from "@/lib/memories/who";
import { resolvePhotoUrls } from "@/lib/book/photos";
import { friendlyDate } from "@/lib/words";
import { tagManyAction } from "@/app/actions";
import { TagSheet } from "./sheet";

export const dynamic = "force-dynamic";

/** How many to work through at once. Enough to be worth it, few enough to end. */
const BATCH = 60;

export default async function TagPage({
  params,
  searchParams,
}: {
  params: { subjectId: string };
  searchParams: { all?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: child } = await db
    .from("subjects")
    .select("id, display_name, family_id")
    .eq("id", params.subjectId)
    .single();
  if (!child) redirect("/home");

  const first = child.display_name?.split(" ")[0] ?? child.display_name;
  const role = (await roleForSubject(db, child.id, user.id))?.role ?? null;
  if (!canEdit(role)) redirect(`/subjects/${child.id}`);

  const people = await peopleInFamily(db, child.family_id);

  // The whole archive, because tagging is a family-level job: the photographs
  // that most need somebody's name on them are precisely the ones no child is
  // linked to yet, and those are invisible from inside one child's story.
  const { data: rows } = await db
    .from("memories")
    .select("id, type, raw_text, memory_date, created_at")
    .eq("family_id", child.family_id)
    .eq("contribution_status", "approved")
    .eq("visibility", "family")
    .order("memory_date", { ascending: false })
    .limit(400);

  const all = (rows ?? []) as any[];
  const tagged = await whoIsIn(db, all.map((m) => m.id));

  const showAll = searchParams.all === "1";
  const untagged = all.filter((m) => !tagged.has(m.id) || tagged.get(m.id)!.size === 0);
  const working = (showAll ? all : untagged).slice(0, BATCH);

  const photos = await resolvePhotoUrls(
    db,
    working.filter((m) => m.type === "photo").map((m) => m.id)
  );

  return (
    <div className="py-10">
      <Link href={`/subjects/${child.id}`} className="text-sm text-ochre">
        &larr; {first}
      </Link>

      <h1 className="mt-2 max-w-[20ch] text-4xl leading-tight">Who&rsquo;s in these?</h1>

      {untagged.length === 0 && !showAll ? (
        <>
          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-stone">
            Everything has a name on it. Anything you add from now on can be
            tagged as it arrives &mdash; and anything you leave untagged still
            belongs to the family&rsquo;s year, it just won&rsquo;t appear in
            anybody&rsquo;s own book.
          </p>
          <Link href={`/subjects/${child.id}/tag?all=1`} className="btn-secondary mt-6 inline-block">
            Go back over everything
          </Link>
        </>
      ) : (
        <>
          <p className="mt-4 max-w-[54ch] text-sm leading-relaxed text-stone">
            Tick the ones somebody is in, then tap their name. A photograph can
            be about more than one person &mdash; a morning with both of them in
            it belongs in both their books, and it only has to be kept once.
          </p>
          {/* The rule, said where it is acted on rather than buried in a
              settings page. Untagged is a real answer and not a failure. */}
          <p className="mt-2 max-w-[54ch] text-xs leading-relaxed text-stone">
            {showAll
              ? `Everything kept, newest first.`
              : `${untagged.length} without a name on ${untagged.length === 1 ? "it" : "them"}. Anything you skip stays in the family's year.`}
          </p>

          <TagSheet
            subjectId={child.id}
            people={people}
            memories={working.map((m) => ({
              id: m.id,
              type: m.type,
              text: m.raw_text ?? null,
              when: friendlyDate(m.memory_date ?? m.created_at),
              photo: photos.get(m.id) ?? null,
              who: [...(tagged.get(m.id) ?? [])],
            }))}
            action={tagManyAction}
          />

          <p className="mt-10 text-sm">
            <Link
              href={`/subjects/${child.id}/tag${showAll ? "" : "?all=1"}`}
              className="text-ochre hover:underline"
            >
              {showAll ? "Only the ones without a name" : "Show everything, including tagged"}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
