// Onboarding screen 1 (brief §6): "Whose childhood are we keeping?"
import { createChild } from "../actions";

export default function OnboardingPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="text-3xl">Whose childhood are we keeping?</h1>
      <p className="mt-3 text-sm leading-relaxed text-stone">
        Three things, and then we can get out of your way.
      </p>
      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      <form action={createChild} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="display_name">What do you call them?</label>
          <input className="input" id="display_name" name="display_name" required />
          <p className="mt-1 text-xs text-stone">
            Whatever you actually say out loud &mdash; that&rsquo;s what goes in the book.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="date_of_birth">The day they arrived</label>
          <input className="input" id="date_of_birth" name="date_of_birth" type="date" required />
          <p className="mt-1 text-xs text-stone">
            So we know which year we&rsquo;re keeping, and what to call it.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="pronouns">Pronouns (optional)</label>
          <input className="input" id="pronouns" name="pronouns" placeholder="she/her" />
          <p className="mt-1 text-xs text-stone">
            We&rsquo;ll say &ldquo;they&rdquo; until you tell us otherwise.
          </p>
        </div>
        <button className="btn w-full">Begin</button>
      </form>
    </div>
  );
}
