import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/next-path";
import { currentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentUser()) redirect(next);

  return (
    <main id="main" className="mx-auto w-full max-w-md px-5 py-12">
      <h1 className="text-4xl">Sign in</h1>
      {params.error ? (
        <p role="alert" className="bg-danger-soft text-danger mt-4 rounded-xl p-4">
          That link has expired or has already been used. Ask for a new one below.
        </p>
      ) : null}
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
