import { signUp } from "../actions";
import { PLAN_PRICES } from "@/lib/billing/plans";

export default async function SignupPage(
  props: {
    searchParams: Promise<{ error?: string; plan?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const monthly = searchParams.plan === "monthly";
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-3xl">Let&rsquo;s keep this year.</h1>
      {/* The old copy said "you only pay when you've read the book" for
          everyone. That is true of the one-off and false of a membership,
          and a payment claim that is true for half of arrivals is a claim
          that will be quoted back at us. */}
      <p className="mt-2 text-sm leading-relaxed text-stone">
        It&rsquo;s already happening, and most of it is already on your phone.{" "}
        {monthly ? (
          <>
            You&rsquo;ll set up A${PLAN_PRICES.monthlyAud() / 100} a month after
            you&rsquo;ve told us about them &mdash; not before, and never
            before you&rsquo;ve seen what it does.
          </>
        ) : (
          <>
            Free to start &mdash; you only pay when you&rsquo;ve read the book
            and you want it printed.
          </>
        )}
      </p>
      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      <form action={signUp} className="mt-8 space-y-4">
        <input type="hidden" name="plan" value={monthly ? "monthly" : "one_off"} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" minLength={8} required />
        </div>
        <button className="btn w-full">Start</button>
        <p className="text-center text-xs leading-relaxed text-stone">
          Everything you add stays private. Your photographs are never made
          public, never sold, and never used to train anything.
        </p>
      </form>
    </div>
  );
}
