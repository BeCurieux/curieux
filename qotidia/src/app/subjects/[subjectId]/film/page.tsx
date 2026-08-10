// The year, as a film.
//
// The same material as the book and the same rules: chronological, the
// family's own words or none, nothing narrated. Sixty seconds is a different
// shape from two hundred pages, and a year read as a film shows something a
// year read as a book does not — how fast it went.
//
// It is not a file yet. A film you cannot send to a grandmother is half a
// film, and the encode is the obvious next piece of work; it will render
// this same cut rather than deciding anything of its own. Saying so on the
// page is better than implying a download that does not exist.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { cutFilm, ENOUGH_FOR_A_FILM, type Moment } from "@/lib/film/cut";
import { resolvePhotoUrls } from "@/lib/book/photos";
import { SERVABLE_VERDICT } from "@/lib/media/verify";
import { countOf } from "@/lib/words";
import { FilmPlayer } from "./player";

export const dynamic = "force-dynamic";

export default async function FilmPage({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: subject } = await db
    .from("subjects")
    .select("id, family_id, display_name, date_of_birth, subject_type, pronouns")
    .eq("id", params.subjectId)
    .maybeSingle();
  if (!subject?.family_id) redirect("/home");
  const first = subject.display_name?.split(" ")[0] ?? subject.display_name;

  // Everything approved. Which twelve months the film covers is the cut's
  // decision, not this page's — it takes the densest year rather than the
  // most recent one, because a single photograph with a wrong date drags a
  // "last twelve months" window right off the material.
  const { data: memories } = await db
    .from("memories")
    .select("id, memory_date, raw_text, type")
    .eq("family_id", subject.family_id)
    .eq("contribution_status", "approved")
    .order("memory_date")
    .limit(3000);

  // Which of them have a photograph that has actually been read and cleared.
  const ids = (memories ?? []).map((m: any) => m.id as string);
  const { data: assets } = ids.length
    ? await db
        .from("media_assets")
        .select("memory_id")
        .in("memory_id", ids)
        .eq("scan_verdict", SERVABLE_VERDICT)
    : { data: [] };
  const withPhoto = new Set((assets ?? []).map((a: any) => a.memory_id as string));

  const moments: Moment[] = (memories ?? []).map((m: any) => ({
    id: m.id,
    date: m.memory_date ?? "",
    hasPhoto: withPhoto.has(m.id),
    text: m.raw_text ?? null,
  }));

  const cut = cutFilm({ name: first, moments });

  if (!cut) {
    const so_far = moments.filter((m) => m.hasPhoto).length;
    return (
      <div className="py-16">
        <h1 className="text-title font-display lowercase">not yet a film</h1>
        <p className="mt-5 max-w-[52ch] leading-relaxed text-stone">
          {first}&rsquo;s year has {countOf(so_far, "photograph", "photographs")} in it so
          far. A film wants at least {ENOUGH_FOR_A_FILM} &mdash; below that it is a few
          pictures in a row, and calling it a film about somebody&rsquo;s year would be
          overstating what is there.
        </p>
        <Link href={`/subjects/${subject.id}/upload`} className="btn mt-8 inline-block">
          Add photographs
        </Link>
      </div>
    );
  }

  const span = (cut.frames[0] as any).sub as string;
  const shown = cut.frames.filter((f) => f.kind === "photo").map((f: any) => f.id as string);
  const urls = await resolvePhotoUrls(db, shown);
  const photos = Object.fromEntries(urls);

  return (
    <div className="py-12">
      <p className="text-xs uppercase tracking-[0.18em] text-clay">The year, in a minute</p>
      {/* The dates the cut actually chose, not "the last twelve months" —
          it picks the densest year, and those are frequently not the same
          twelve months. A heading that names the wrong span is the kind of
          small lie this product cannot afford. */}
      <h1 className="mt-4 font-display text-5xl leading-[1.1]">{first}</h1>
      <p className="mt-2 text-stone">{span}</p>

      <div className="mt-8 max-w-4xl">
        <FilmPlayer cut={cut} photos={photos} />
      </div>

      <p className="mt-8 max-w-[54ch] leading-relaxed text-stone">
        The twelve months with the most in them, in order. Anything written
        on screen is something someone in the family typed &mdash; there is no
        narration, and nothing here was written by us.
      </p>

      <p className="mt-4 max-w-[54ch] text-sm leading-relaxed text-stone">
        No music, on purpose. A family&rsquo;s own photographs under library
        piano is an advertisement for itself, and choosing a soundtrack for
        somebody else&rsquo;s year is not ours to do.
      </p>

      <p className="mt-8 max-w-[54ch] text-sm leading-relaxed text-stone">
        It plays here and cannot yet be downloaded or sent. That is the next
        piece of work, and it will be this same film rather than a different
        one.
      </p>

      <p className="mt-10 text-sm">
        <Link href={`/subjects/${subject.id}`} className="text-ochre">
          Back to {first}&rsquo;s year
        </Link>
      </p>
    </div>
  );
}
