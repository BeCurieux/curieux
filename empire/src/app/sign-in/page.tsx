import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { serverEnv } from "@/env";
import { currentUser } from "@/lib/auth/session";
import { SiteHeader } from "@/components/shell/site-header";
import { Card } from "@/components/ui/card";
import { ViewBeacon } from "@/components/beacon";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ start?: string; error?: string }> }) {
  if (await currentUser()) redirect("/studio");
  const { start, error } = await searchParams;
  return (
    <>
      {start ? <ViewBeacon name="preview_started" /> : null}
      <SiteHeader />
      <main id="main" className="mx-auto max-w-lg px-5 py-10 sm:px-8">
        <Card>
          <p className="eyebrow">{start ? "Start free" : "Welcome back"}</p>
          <h1 className="mt-3 text-4xl">{start ? "Let's build your launch." : "Sign in to your studio"}</h1>
          <p className="mt-3 mb-6 text-ink-soft">
            {start
              ? "Free to start, no card. One email address is all we need."
              : "Use the email you signed up (or bought) with."}
          </p>
          {error ? (
            <p role="alert" className="mb-4 text-sm font-medium text-danger">
              That sign-in link didn't work — it may have expired. Ask for a new one below.
            </p>
          ) : null}
          <SignInForm local={serverEnv().EMPIRE_BACKEND === "local"} />
        </Card>
      </main>
    </>
  );
}
