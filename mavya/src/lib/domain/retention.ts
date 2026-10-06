import { formatMoney } from "./accounts";
import { explain, type Db } from "./db";

// Families who might leave (docs/M8_NETWORK.md, M8e): warning signs counted
// by the database from the school's own records. Fixed rules, no AI.

export type RiskReason =
  | { kind: "absences"; child: string; count: number }
  | { kind: "credits_expired"; child: string; count: number }
  | { kind: "leaving"; child: string; term: string }
  | { kind: "not_answered"; child: string; term: string }
  | { kind: "paused"; child: string; class: string }
  | { kind: "overdue"; cents: number };

export type FamilyAtRisk = {
  familyId: string;
  familyName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  reasons: RiskReason[];
};

export async function familiesAtRisk(db: Db, organisationId: string): Promise<FamilyAtRisk[]> {
  const { data, error } = await db.rpc("families_at_risk", { p_org: organisationId });
  if (error) throw explain(error);
  return (data ?? []).map((f) => ({
    familyId: f.family_id,
    familyName: f.family_name,
    contactName: f.contact_name,
    phone: f.phone,
    email: f.email,
    reasons: f.reasons as unknown as RiskReason[],
  }));
}

// A warning sign in plain words, for the owner.
export function reasonText(r: RiskReason): string {
  switch (r.kind) {
    case "absences":
      return `${r.child} has missed ${r.count} lessons in the last 6 weeks.`;
    case "credits_expired":
      return `${r.child}’s ${r.count === 1 ? "make-up credit" : `${r.count} make-up credits`} ran out unused.`;
    case "leaving":
      return `${r.child} isn’t coming back for ${r.term}.`;
    case "not_answered":
      return `No answer yet about ${r.term} for ${r.child}, and the reply-by date has passed.`;
    case "paused":
      return `${r.child}’s place in ${r.class} is paused.`;
    case "overdue":
      return `${formatMoney(r.cents)} overdue by more than 2 weeks.`;
  }
}

export async function followUpFamily(db: Db, familyId: string, note: string) {
  const { error } = await db.rpc("follow_up_family", { p_family: familyId, p_note: note });
  if (error) throw explain(error);
}
