import Link from "next/link";
import { Uploader } from "./uploader";
import { Recorder } from "./recorder";
import { addTextMemory } from "@/app/actions";

export default function UploadPage({
  params,
  searchParams,
}: {
  params: { subjectId: string };
  searchParams: { welcome?: string };
}) {
  return (
    <div className="py-10">
      {searchParams.welcome && (
        <p className="mb-6 max-w-[52ch] rounded-lg bg-rule/50 p-4 text-sm leading-relaxed">
          Start with photos &mdash; they do most of the work. Everything else
          on this page can wait until something occurs to you.
        </p>
      )}
      <h1 className="text-3xl">Whatever you&rsquo;ve got.</h1>

      <section className="mt-8">
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

      <p className="mt-12 text-sm text-stone">
        That&rsquo;s plenty for now.{" "}
        <Link className="text-ochre" href={`/subjects/${params.subjectId}`}>
          Back to their year
        </Link>
      </p>
    </div>
  );
}
