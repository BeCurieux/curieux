// Onboarding screen 2 (brief §6): "Who's in their world?"
// Free-text lines support any family structure.
import Link from "next/link";
import { addFamilyMembers } from "../../actions";

export default function OnboardingPeoplePage({ searchParams }: { searchParams: { child?: string } }) {
  const subjectId = searchParams.child ?? "";
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="text-3xl">Who&rsquo;s in their world?</h1>
      <p className="mt-2 text-sm text-ink/60">
        Parents, grandparents, siblings, anyone important. One per line:
        <span className="mt-1 block font-mono text-xs">Name | relationship | what they call them (optional)</span>
      </p>
      <form action={addFamilyMembers} className="mt-8 space-y-4">
        <input type="hidden" name="subject_id" value={subjectId} />
        <textarea
          className="input h-40 font-mono text-xs"
          name="members"
          placeholder={"Sarah | Mum\nJames | Dad\nMargaret | Grandma | Nana\nTom | Grandpa"}
        />
        <button className="btn w-full">Continue</button>
        <Link
          href={`/subjects/${subjectId}/upload?welcome=1`}
          className="block text-center text-sm text-ink/50 hover:text-clay"
        >
          Skip for now
        </Link>
      </form>
    </div>
  );
}
