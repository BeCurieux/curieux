import { signUp } from "../actions";

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-3xl">Let&rsquo;s keep this year.</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone">
        It&rsquo;s already happening, and most of it is already on your phone.
        Free to start &mdash; you only pay when you&rsquo;ve read the book and
        you want it printed.
      </p>
      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      <form action={signUp} className="mt-8 space-y-4">
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
