import type { Metadata } from "next";
import { isAdmin, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Your course" };

// Placeholder course home. Modules, lessons and progress arrive with the
// content pipeline (SPEC.md → Build order, step 3). The access check is
// here, on the server, not only in the proxy.
export default async function LearnPage() {
  const user = await requireUser("/learn");
  const admin = await isAdmin();

  return (
    <main id="main" className="mx-auto w-full max-w-xl px-5 py-12">
      <h1 className="text-4xl">Your course</h1>
      <p className="mt-4">
        Signed in as <strong data-testid="signed-in-email">{user.email}</strong>.
      </p>
      {admin ? <p className="text-mute mt-2">You're an admin.</p> : null}
      <p className="text-mute mt-6">The modules will appear here.</p>
      <form action="/auth/sign-out" method="post" className="mt-10">
        <button
          type="submit"
          className="border-accent text-accent rounded-full border px-5 py-3 font-semibold"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
