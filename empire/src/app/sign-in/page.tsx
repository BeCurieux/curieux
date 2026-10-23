import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { serverEnv } from "@/env";
import { currentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/next-path";
import { SiteHeader } from "@/components/shell/site-header";
import { Card } from "@/components/ui/card";
import { ViewBeacon } from "@/components/beacon";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; error?: string; next?: string }>;
}) {
  const { start, error, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (await currentUser()) redirect(next);
  return (
    <>
      {start ? <ViewBeacon name="preview_started" /> : null}
      <SiteHeader />
      <main id="main" className="mx-auto max-w-lg px-5 py-10 sm:px-8">
        <Card>
          <p className="eyebrow">{start ? "Start free" : "Welcome back"}</p>
          <h1 className="mt-3 text-4xl">
            {start ? "Let's build your launch." : "Sign in to your studio"}
          </h1>
          <p className="text-mute mt-3 mb-6">
            {start
              ? "Free to start, no card. One email address is all we need."
              : "Use the email you signed up (or bought) with."}
          </p>
          {error ? (
            <p role="alert" className="text-danger mb-4 text-sm font-medium">
              That sign-in link didn't work — it may have expired. Ask for a new one below.
            </p>
          ) : null}
          <SignInForm local={serverEnv().EMPIRE_BACKEND === "local"} next={next} />
        </Card>
      </main>
    </>
  );
}
