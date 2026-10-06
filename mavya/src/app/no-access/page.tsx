import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Wordmark } from "@/components/shell/wordmark";
import { homePath } from "@/lib/auth/roles";
import { ownerTwoStepNeeded, requireViewer } from "@/lib/auth/viewer";
import { amPlatformAdmin } from "@/lib/domain/platform";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Not connected yet" };

// A signed-in person with no family and no staff role. People who run
// Ovyko go on to its totals, after two-step sign-in.
export default async function NoAccessPage() {
  const viewer = await requireViewer();
  if (viewer.shells.length > 0) redirect(homePath(viewer.shells));
  if (await ownerTwoStepNeeded()) redirect("/two-step");
  if (await amPlatformAdmin(await createClient())) redirect("/platform");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <Wordmark />
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Your account isn&apos;t connected yet.
      </h1>
      <p className="text-lg text-muted">
        Ask your activity provider to add you. Once they have, sign in again and everything will be
        here.
      </p>
      <SignOutButton />
    </main>
  );
}
