import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import * as repo from "@/lib/db/repository";
import { brand } from "@/config/brand";
import { Card, SectionLabel } from "@/components/ui";
import { AccountActions } from "@/components/app/account-actions";

export const dynamic = "force-dynamic";

/** Settings, including the data controls the brief requires (§52). */
export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app/settings");

  const db = userClient();
  const household = await repo.getHouseholdForUser(db, user.id);
  if (!household) redirect("/onboarding");

  const { data: notificationPreferences } = await db
    .from("notification_preferences")
    .select("weekly_plan, feedback_request")
    .eq("household_id", household.id)
    .maybeSingle();

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Settings</SectionLabel>
        <h1 className="mt-2 text-[28px] leading-tight text-ink">{user.email}</h1>
      </div>

      <Card className="p-6">
        <SectionLabel>Emails</SectionLabel>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-graphite">
          <li>
            Thursday plan —{" "}
            <span className="text-ink">
              {notificationPreferences?.weekly_plan === false ? "off" : "on"}
            </span>
          </li>
          <li>
            Sunday “did you do it?” —{" "}
            <span className="text-ink">
              {notificationPreferences?.feedback_request === false ? "off" : "on"}
            </span>
          </li>
        </ul>
        <p className="mt-3 text-[14px] leading-relaxed text-mist">
          Every email has an unsubscribe link, and turning off the Thursday email stops the
          product doing anything useful — so we’d rather you paused than switched it off.
        </p>
      </Card>

      <Card className="p-6">
        <SectionLabel>Your household</SectionLabel>
        <div className="mt-3 flex flex-col gap-2 text-[15px]">
          <Link href="/app/preferences" className="text-forest underline-offset-4 hover:underline">
            Preferences
          </Link>
          <Link href="/app/household" className="text-forest underline-offset-4 hover:underline">
            Who your weekends are for
          </Link>
          <Link href="/app/billing" className="text-forest underline-offset-4 hover:underline">
            Billing
          </Link>
        </div>
      </Card>

      <AccountActions />

      <p className="text-[14px] leading-relaxed text-mist">
        Anything else, write to{" "}
        <a href={`mailto:${brand.supportEmail}`} className="underline-offset-4 hover:underline">
          {brand.supportEmail}
        </a>
        . A person reads it.
      </p>
    </div>
  );
}
