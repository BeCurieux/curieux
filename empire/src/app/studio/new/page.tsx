import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/studio/onboarding-form";
import { Card, PageHeader } from "@/components/ui/card";
import { loadAccess } from "@/lib/generation/run";
import { studio } from "@/lib/studio/context";

export const metadata: Metadata = { title: "Tell us about your business" };

export default async function NewProfile() {
  const { repo } = await studio();
  const [profiles, { access }] = await Promise.all([repo.listProfiles(), loadAccess(repo)]);
  if (profiles.length >= access.profiles && profiles[0]) redirect(`/studio/${profiles[0].id}`);
  return (
    <main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <PageHeader eyebrow="Ten minutes, tops" title="Tell us about your business.">
        Plain answers are perfect. Everything Empire Studio makes is built from what you say here — and nothing
        you don't.
      </PageHeader>
      <Card>
        <OnboardingForm />
      </Card>
    </main>
  );
}
