// Who you keep.
//
// This screen used to be a heading and a row of beige rectangles: every
// subject rendered through one template that printed "Born {date}" straight
// from the column, so a household — which has no date of birth — read as a
// child born on no day at all. It also spent the whole page on three names
// and told you nothing else, while the strongest thing the brand owns sat
// unused two files away.
//
// So each archive now shows its shelf. The annual colours are the product;
// a parent should recognise this screen as the same object as the book on
// the table, and should be able to see at a glance which years exist and
// which are still a gap.
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { ageInYears } from "@/lib/book/format";
import { countOf, fullDate } from "@/lib/words";
import { countStoryMemories } from "@/lib/memories/scope";
import { yearWord } from "@/lib/book/structure";
import { colourForBook } from "@/lib/book/colours";
import { PALETTE } from "@/lib/palette";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const db = await userClient();
  const { data: subjects } = await db
    .from("subjects")
    .select("id, display_name, date_of_birth, subject_type, cover_colour")
    .order("created_at");

  if (!subjects || subjects.length === 0) redirect("/onboarding");
  if (subjects.length === 1) redirect(`/subjects/${subjects[0].id}`);

  // How many volumes each archive has actually produced. Stated as a fact
  // under the cover rather than drawn as a row of empty outlines: a family
  // in its first year would otherwise open this screen to six dashed boxes,
  // which is a picture of what they have not done.
  const { data: books } = await db.from("books").select("subject_id");
  const volumesFor = (subjectId: string) =>
    (books ?? []).filter((b) => b.subject_id === subjectId).length;

  const kept = await Promise.all(subjects.map((s) => countStoryMemories(db, s.id)));

  return (
    <div className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Everyone you keep</h1>
          <p className="mt-1 text-stone">Each one becomes a book a year.</p>
        </div>
        <Link href="/books/new" className="btn">
          Make a book
        </Link>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        {subjects.map((s, i) => {
          const isChild = s.subject_type === "child";
          const age = s.date_of_birth ? ageInYears(s.date_of_birth) : null;
          const yearNumber = age === null ? null : age + 1;
          const volumes = volumesFor(s.id);
          // A child's cover is their year's colour. A household is not in the
          // age spectrum at all — it has no age — so it takes ink instead of
          // borrowing age zero, which came out a shade off the six-year-old
          // beside it and made the two kinds of archive look like one thing.
          const colour = isChild
            ? colourForBook({ subjectColour: s.cover_colour, age: age ?? 0 })
            : { hex: PALETTE.ink, inkHex: PALETTE.paper };

          return (
            <Link
              key={s.id}
              href={`/subjects/${s.id}`}
              className="group block rounded-3xl border border-rule/70 bg-card p-5 transition hover:border-clay"
            >
              {/* The cover, not a thumbnail of one. This is the object the
                  family will have on a table in eighteen months, in the
                  colour it will actually be printed in — so the screen and
                  the shelf are recognisably the same product. */}
              <div
                className="flex h-44 flex-col justify-between rounded-2xl px-6 py-5"
                style={{ backgroundColor: colour.hex, color: colour.inkHex }}
              >
                <span className="font-display text-2xl leading-tight">
                  {s.display_name}
                </span>
                <span className="text-xs uppercase tracking-[0.18em] opacity-80">
                  {isChild && yearNumber ? yearWord(yearNumber) : "the household"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                {/* A household has no birthday, and printing "Born" with
                    nothing after it was the bug this screen shipped with. */}
                <span className="text-sm text-stone">
                  {isChild && s.date_of_birth ? (
                    <>born {fullDate(s.date_of_birth)}</>
                  ) : isChild ? (
                    <>the year starts whenever you do</>
                  ) : (
                    <>the whole family, not one child</>
                  )}
                </span>
                <span className="text-sm text-stone">
                  {kept[i] === 0 ? "nothing kept yet" : `${countOf(kept[i], "thing")} kept`}
                  {volumes > 0 ? ` · ${countOf(volumes, "volume")}` : null}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
