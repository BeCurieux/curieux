// Onboarding screen 1 (brief §6): "Whose childhood are we keeping?"
import { createChild } from "../actions";

export default function OnboardingPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="text-3xl">Whose childhood are we keeping?</h1>
      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      <form action={createChild} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="first_name">Their first name</label>
          <input className="input" id="first_name" name="first_name" required />
        </div>
        <div>
          <label className="label" htmlFor="date_of_birth">Their birthday</label>
          <input className="input" id="date_of_birth" name="date_of_birth" type="date" required />
        </div>
        <div>
          <label className="label" htmlFor="pronouns">Pronouns (optional)</label>
          <input className="input" id="pronouns" name="pronouns" placeholder="she/her" />
        </div>
        <button className="btn w-full">Continue</button>
      </form>
    </div>
  );
}
