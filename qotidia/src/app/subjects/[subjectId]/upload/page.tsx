import Link from "next/link";
import { Uploader } from "./uploader";
import { Recorder } from "./recorder";
import { addTextMemory } from "@/app/actions";
import { PRIVATE_BLURB } from "@/lib/family/roles";
import { QuickAdd } from "./quick-add";
import { userClient } from "@/lib/supabase/server";
import { createBook } from "@/app/actions";
import { backfillProgress } from "@/lib/onboarding/start";
import { MIN_MEMORIES_FOR_A_BOOK } from "@/lib/renewal/policy";

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: { subjectId: string };
  searchParams: { welcome?: string; backfill?: string };
}) {
  const backfill = searchParams.backfill === "1";

  // How far a backfill has got, and whether there is a book to make. Only
  // fetched in backfill mode — the ordinary upload page is a form and should
  // not become a dashboard.
  let kept = 0;
  let first = "them";
  let hasBook = false;
  if (backfill) {
    const db = userClient();
    const { count } = await db
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", params.subjectId);
    kept = count ?? 0;
    const { data: subject } = await db
      .from("subjects")
      .select("display_name")
      .eq("id", params.subjectId)
      .maybeSingle();
    first = subject?.display_name?.split(" ")[0] ?? "them";
    const { data: book } = await db
      .from("books")
      .select("id")
      .eq("subject_id", params.subjectId)
      .maybeSingle();
    hasBook = !!book;
  }

  return (
    <div className="py-10">
      {searchParams.welcome && !backfill && (
        <p className="mb-6 max-w-[52ch] rounded-lg bg-rule/50 p-4 text-sm leading-relaxed">
          Start with photos &mdash; they do most of the work. Everything else
          on this page can wait until something occurs to you.
        </p>
      )}
      {/* A backfill is a different job from keeping a year as it happens, and
          the page should ask for it differently. "Add a memory" invites one
          thing; this invites an afternoon. */}
      {backfill && (
        <p className="mb-6 max-w-[54ch] rounded-lg border border-clay bg-card p-5 text-sm leading-relaxed">
          Open your photos, select the whole year, and drop them in. Hundreds
          at a time is fine &mdash; the blurry ones and the near duplicates
          too. Sorting them is our job. You can close this and come back;
          nothing needs watching.
        </p>
      )}
      <h1 className="text-title">
        {backfill ? "Empty the year in here." : "Whatever you\u2019ve got."}
      </h1>

      {/* Order follows the job. Emptying a year is one action — the
          dropzone — and everything else on this page is a distraction from
          it. On an ordinary day it is the reverse: one small thing, quickly,
          and the dropzone can wait. Same components, opposite priority. */}
      {backfill ? (
        <section className="mt-8">
          <Uploader subjectId={params.subjectId} />
          <p className="mt-4 max-w-[54ch] text-sm leading-relaxed text-stone">
            Photographs do most of the work. The words can come later &mdash;
            we&rsquo;ll ask you about the things a photo can&rsquo;t answer
            once we&rsquo;ve read the year.
          </p>
        </section>
      ) : (
        <>
          {/* One thing, quickly — the 360 days that aren't the big upload day. */}
          <section className="mt-8">
            <QuickAdd subjectId={params.subjectId} />
          </section>

          <section className="mt-12">
            <h2 className="text-lg">Photographs</h2>
            <p className="mt-1 max-w-[54ch] text-sm leading-relaxed text-stone">
              Drag in a few hundred at once &mdash; the blurry ones and the near
              duplicates too. Sorting them is our job, not yours. You can close
              this and come back; nothing needs watching.
            </p>
            <div className="mt-4">
              <Uploader subjectId={params.subjectId} />
            </div>
          </section>
        </>
      )}

      {backfill && (
        <h2 className="mt-14 text-lg">Anything you already remember</h2>
      )}

      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-lg">Something they said</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            Word for word, mistakes and all. The mistakes are the part
            you&rsquo;ll miss.
          </p>
          <form action={addTextMemory} className="mt-3 space-y-3">
            <input type="hidden" name="subject_id" value={params.subjectId} />
            <input type="hidden" name="type" value="quote" />
            <textarea className="input h-24" name="text" placeholder={"Something they said, exactly how they said it.\n“I do it!”"} />
            <input className="input" type="date" name="memory_date" />
            <button className="btn-secondary">Keep this quote</button>
          </form>
        </div>
        <div>
          <h2 className="text-lg">Something that happened</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            No need to write it well. One sentence, and it&rsquo;s kept.
          </p>
          <form action={addTextMemory} className="mt-3 space-y-3">
            <input type="hidden" name="subject_id" value={params.subjectId} />
            <input type="hidden" name="type" value="text" />
            <textarea className="input h-24" name="text" placeholder="A moment you don't want to lose. A sentence is plenty." />
            <input className="input" type="date" name="memory_date" />
            {/* Some things belong in a childhood record and not in the
                conversation with your mother-in-law. */}
            <label className="flex gap-2.5 text-sm">
              <input type="checkbox" name="private" className="mt-1" />
              <span>
                Keep this to myself
                <span className="mt-0.5 block text-xs leading-relaxed text-stone">
                  {PRIVATE_BLURB}
                </span>
              </span>
            </label>
            <button className="btn-secondary">Keep this memory</button>
          </form>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg">Their voice</h2>
        <p className="mt-1 max-w-[54ch] text-sm leading-relaxed text-stone">
          This is the thing that goes first. You will remember the face for
          years and lose the voice inside one. Thirty seconds of them talking
          about nothing is enough &mdash; and if it makes the book, the printed
          page carries a small mark. Scan it and you hear them say it again,
          at any age you like.
        </p>
        <div className="mt-4 max-w-lg">
          <Recorder subjectId={params.subjectId} />
        </div>
      </section>

      {/* The finish line. Without it a backfill has no end — someone empties
          a year into a form and is left on the same form, with the thing
          they came for still hypothetical. */}
      {backfill && !hasBook && (
        <section className="mt-14 rounded-lg border border-clay bg-card p-6">
          <p className="text-sm leading-relaxed">{backfillProgress(kept, first)}</p>
          {kept >= MIN_MEMORIES_FOR_A_BOOK && (
            <form action={createBook} className="mt-5">
              <input type="hidden" name="subject_id" value={params.subjectId} />
              <button className="btn">Make {first}&rsquo;s book</button>
              <p className="mt-3 max-w-[48ch] text-xs leading-relaxed text-stone">
                You&rsquo;ll read it through before anything prints, and you can
                keep adding to the year until you do.
              </p>
            </form>
          )}
        </section>
      )}

      <p className="mt-12 text-sm text-stone">
        That&rsquo;s plenty for now.{" "}
        <Link className="text-ochre" href={`/subjects/${params.subjectId}`}>
          Back to their year
        </Link>
        {" · "}
        {/* Not orphaned. The people step no longer blocks the way in, so it
            has to be reachable from the place people actually land. */}
        <Link className="text-ochre" href={`/onboarding/people?child=${params.subjectId}`}>
          Who&rsquo;s in their life
        </Link>
      </p>
    </div>
  );
}
