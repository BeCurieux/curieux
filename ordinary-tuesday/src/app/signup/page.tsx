import { signUp } from "../actions";

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-3xl">Create your account</h1>
      <p className="mt-2 text-sm text-stone">Their year is already happening. Let&rsquo;s keep it.</p>
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
        <button className="btn w-full">Sign up</button>
      </form>
    </div>
  );
}
