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
        <p className="mb-6 rounded-lg bg-rule/50 p-4 text-sm">
          Add some memories — photos are the fastest way to start.
        </p>
      )}
      <h1 className="text-3xl">Add their moments</h1>

      <section className="mt-8">
        <h2 className="text-lg">Upload photos</h2>
        <p className="mt-1 text-sm text-stone">
          Drag in 50–150 photos at once. We&rsquo;ll spot duplicates and start making sense of them —
          you don&rsquo;t need to wait around.
        </p>
        <div className="mt-4">
          <Uploader subjectId={params.subjectId} />
        </div>
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-lg">Add a quote</h2>
          <form action={addTextMemory} className="mt-3 space-y-3">
            <input type="hidden" name="subject_id" value={params.subjectId} />
            <input type="hidden" name="type" value="quote" />
            <textarea className="input h-24" name="text" placeholder={"Something they said, exactly how they said it.\n“I do it!”"} />
            <input className="input" type="date" name="memory_date" />
            <button className="btn-secondary">Keep this quote</button>
          </form>
        </div>
        <div>
          <h2 className="text-lg">Tell us something</h2>
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
        <h2 className="text-lg">Record their voice</h2>
        <p className="mt-1 text-sm text-stone">
          The thing you forget first. If it makes the book, the printed page
          carries a small code — scan it and you hear them say it again.
        </p>
        <div className="mt-4 max-w-lg">
          <Recorder subjectId={params.subjectId} />
        </div>
      </section>

      <p className="mt-12 text-sm text-stone">
        Done for now? <Link className="text-boot" href={`/subjects/${params.subjectId}`}>Back to their year</Link>
      </p>
    </div>
  );
}
