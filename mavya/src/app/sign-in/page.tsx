import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/shell/wordmark";
import { getViewer } from "@/lib/auth/viewer";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ idle?: string }>;
}) {
  if (await getViewer()) redirect("/");
  const { idle } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 px-6 py-12">
      <div className="flex flex-col gap-4">
        <Wordmark />
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          Welcome back.
        </h1>
        <p className="text-lg text-muted">Everything they do, together.</p>
      </div>
      {idle ? (
        <p role="status" className="rounded-md bg-surface-soft px-4 py-3 font-semibold">
          You were signed out after 30 minutes without activity.
        </p>
      ) : null}
      <SignInForm />
      <footer className="text-sm text-muted">
        Ovyko is made by Sounding Labs · ABN 38 813 430 864 ·{" "}
        <a href="mailto:hello@ovyko.com.au" className="underline underline-offset-2">
          hello@ovyko.com.au
        </a>
      </footer>
    </main>
  );
}
