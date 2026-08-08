import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import * as repo from "@/lib/db/repository";
import { SectionLabel } from "@/components/ui";
import { PreferencesEditor } from "@/components/app/preferences-editor";

export const dynamic = "force-dynamic";

/**
 * Preferences (§52: users must be able to see and change everything we hold
 * about their taste). The learned signals are shown alongside the stated ones,
 * because a system that quietly overrides what you told it should at least
 * tell you it has done so.
 */
export default async function PreferencesPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app/preferences");

  const db = userClient();
  const household = await repo.getHouseholdForUser(db, user.id);
  if (!household) redirect("/onboarding");

  const [preferences, taste] = await Promise.all([
    repo.getPreferences(db, household.id),
    repo.getTasteSignals(db, household.id),
  ]);
  if (!preferences) redirect("/onboarding");

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Preferences</SectionLabel>
        <h1 className="mt-2 text-[28px] leading-tight text-ink">What we plan around</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-graphite">
          Change anything here and it applies from your next weekend.
        </p>
      </div>

      <PreferencesEditor preferences={preferences} learned={taste} />
    </div>
  );
}
