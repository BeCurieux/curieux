import { explain, type Db } from "./db";

// Ovyko's own totals (docs/PLATFORM_TOTALS.md): numbers across every real
// school, never a name. The database lets only platform admins, after
// two-step sign-in, read them.

export type PlatformTotals = {
  schools: number;
  schoolsTeaching: number;
  schoolsTakingPayments: number;
  families: number;
  childrenEnrolled: number;
  feesCharged365dCents: number;
  paidOnline30dCents: number;
  paidOnline365dCents: number;
  ovykoFees30dCents: number;
  ovykoFees365dCents: number;
  recordedPayments365dCents: number;
};

export type PlatformMonth = {
  month: string;
  newSchools: number;
  paidOnlineCents: number;
  ovykoFeesCents: number;
};

export async function amPlatformAdmin(db: Db): Promise<boolean> {
  const { data, error } = await db.rpc("am_platform_admin");
  if (error) throw explain(error);
  return data === true;
}

export async function platformTotals(db: Db): Promise<PlatformTotals> {
  const { data, error } = await db.rpc("platform_totals");
  if (error) throw explain(error);
  const r = data![0]!;
  return {
    schools: r.schools,
    schoolsTeaching: r.schools_teaching,
    schoolsTakingPayments: r.schools_taking_payments,
    families: r.families,
    childrenEnrolled: r.children_enrolled,
    feesCharged365dCents: r.fees_charged_365d_cents,
    paidOnline30dCents: r.paid_online_30d_cents,
    paidOnline365dCents: r.paid_online_365d_cents,
    ovykoFees30dCents: r.ovyko_fees_30d_cents,
    ovykoFees365dCents: r.ovyko_fees_365d_cents,
    recordedPayments365dCents: r.recorded_payments_365d_cents,
  };
}

export async function platformMonths(db: Db): Promise<PlatformMonth[]> {
  const { data, error } = await db.rpc("platform_months");
  if (error) throw explain(error);
  return (data ?? []).map((m) => ({
    month: m.month,
    newSchools: m.new_schools,
    paidOnlineCents: m.paid_online_cents,
    ovykoFeesCents: m.ovyko_fees_cents,
  }));
}
