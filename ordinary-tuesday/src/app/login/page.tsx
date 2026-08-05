import { signIn } from "../actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-3xl">Welcome back</h1>
      {searchParams.message && (
        <p className="mt-4 rounded-lg bg-rule/50 p-3 text-sm">{searchParams.message}</p>
      )}
      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>
      )}
      <form action={signIn} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required />
        </div>
        <button className="btn w-full">Log in</button>
      </form>
    </div>
  );
}
