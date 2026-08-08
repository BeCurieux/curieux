import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import * as repo from "@/lib/db/repository";
import { Card, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

const SHAPE_LABEL: Record<string, string> = {
  SOLO: "Just me",
  COUPLE: "Me and my partner",
  FAMILY: "Family",
  FRIENDS: "Friends, or it varies",
};

/**
 * Household (§26, §52).
 *
 * Shows exactly what we hold about the people in the household — which for
 * children is an age and, if they gave one, a nickname. Seeing how little that
 * is does more for trust than a paragraph in the privacy policy.
 */
export default async function HouseholdPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app/household");

  const db = userClient();
  const household = await repo.getHouseholdForUser(db, user.id);
  if (!household) redirect("/onboarding");

  const members = await repo.getMembers(db, household.id);
  const adults = members.filter((m) => m.member_type === "ADULT");
  const children = members.filter((m) => m.member_type === "CHILD");

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Household</SectionLabel>
        <h1 className="mt-2 text-[28px] leading-tight text-ink">
          {SHAPE_LABEL[household.shape] ?? household.shape}
        </h1>
        <p className="mt-2 text-[16px] leading-relaxed text-graphite">
          Every plan is built for everyone here, not averaged across them.
        </p>
      </div>

      <Card className="p-6">
        <SectionLabel>Where you start from</SectionLabel>
        <p className="mt-2 text-[17px] text-ink">{household.home_label ?? "Not set"}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-mist">
          Stored to about a hundred metres — enough to work out a travel time, not enough to be
          a location history.
        </p>
      </Card>

      <Card className="p-6">
        <SectionLabel>Who’s here</SectionLabel>
        <ul className="mt-3 space-y-3">
          {adults.map((member) => (
            <li key={member.id} className="flex items-baseline justify-between gap-4">
              <span className="text-[16px] text-ink">{member.nickname ?? "Adult"}</span>
              <span className="text-[14px] text-mist">Adult</span>
            </li>
          ))}
          {children.map((member) => (
            <li key={member.id} className="flex items-baseline justify-between gap-4">
              <span className="text-[16px] text-ink">{member.nickname ?? "Child"}</span>
              <span className="text-[14px] text-mist">
                {member.age !== null ? `${member.age} years old` : "Age not set"}
                {member.mobility_notes ? ` · ${member.mobility_notes}` : ""}
              </span>
            </li>
          ))}
        </ul>

        {children.length > 0 ? (
          <p className="mt-5 text-[14px] leading-relaxed text-mist">
            We keep an age because a plan that works for a seven-year-old doesn’t work for a
            two-year-old. We hold nothing else about them.
          </p>
        ) : null}
      </Card>

      <Card className="p-6">
        <SectionLabel>Changing this</SectionLabel>
        <p className="mt-2 text-[15px] leading-relaxed text-graphite">
          Household changes — a new baby, a partner joining, moving suburb — are worth getting
          right, so we do them by hand for now. Email us and we’ll sort it the same day.
        </p>
      </Card>
    </div>
  );
}
