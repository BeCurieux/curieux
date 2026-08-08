import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { getHouseholdForUser, getPreferences } from "@/lib/db/repository";
import { OnboardingFlow } from "@/components/onboarding/flow";

export const metadata: Metadata = { title: "Set up your weekends" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/onboarding");

  // Someone who has already finished should not be walked through it again.
  const db = userClient();
  const household = await getHouseholdForUser(db, user.id);
  if (household) {
    const preferences = await getPreferences(db, household.id);
    if (preferences && household.home_lat !== null) redirect("/app");
  }

  return <OnboardingFlow />;
}
