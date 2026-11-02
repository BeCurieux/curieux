"use client";

import { useActionState } from "react";
import { requestMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestMagicLink, initial);

  if (state.status === "sent") {
    return (
      <div role="status" className="border-line bg-paper rounded-2xl border p-6">
        <h2 className="text-2xl">Check your email</h2>
        <p className="mt-3">
          We sent a sign-in link to <strong>{state.email}</strong>. Tap it on this device or any
          other. It works once and expires in an hour.
        </p>
        <p className="text-mute mt-3">Nothing there after a minute? Check spam, then try again.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="block font-semibold">
          Your email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.email}
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={state.status === "error" ? "email-error" : undefined}
          className="border-line bg-paper focus:border-accent focus:outline-accent mt-2 block w-full rounded-xl border px-4 py-3 text-lg focus:outline-2"
        />
        {state.status === "error" ? (
          <p id="email-error" role="alert" className="text-danger mt-2">
            {state.message}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-on-accent w-full rounded-full px-6 py-4 text-lg font-semibold disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="text-mute">No password. We email you a link each time you sign in.</p>
    </form>
  );
}
