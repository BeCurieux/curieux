import { explain, type Db } from "./db";

// Government activity vouchers (docs/M7_PAYMENTS.md, M7d part 1). Parents
// hand a voucher's code over in Ovyko; the school redeems it in the
// government's portal and Ovyko adds the credit. The database checks who
// may do what; values match private.voucher_scheme_cents.

export const SCHEMES = {
  nsw_active_creative_kids: { name: "Active and Creative Kids (NSW)", maxCents: 5000 },
  qld_fairplay: { name: "FairPlay (QLD)", maxCents: 20000 },
  sa_sports_vouchers: { name: "Sports Voucher (SA)", maxCents: 10000 },
  wa_kidsport: { name: "KidSport (WA)", maxCents: 30000 },
} as const;

export type Scheme = keyof typeof SCHEMES;
export const SCHEME_IDS = Object.keys(SCHEMES) as Scheme[];
export const isScheme = (s: string): s is Scheme => s in SCHEMES;

export type VoucherStatus = "submitted" | "redeemed" | "declined";

export const STATUS_LABELS: Record<VoucherStatus, string> = {
  submitted: "Handed over: waiting for the school",
  redeemed: "Redeemed",
  declined: "Not accepted",
};

export type Voucher = {
  id: string;
  familyId: string;
  familyName: string;
  childName: string | null;
  scheme: Scheme;
  code: string;
  status: VoucherStatus;
  amountCents: number | null;
  declineReason: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  family_id: string;
  scheme: string;
  code: string;
  status: string;
  amount_cents: number | null;
  decline_reason: string | null;
  created_at: string;
  families: { display_name: string } | null;
  children: { first_name: string } | null;
};

const toVoucher = (r: Row): Voucher => ({
  id: r.id,
  familyId: r.family_id,
  familyName: r.families?.display_name ?? "",
  childName: r.children?.first_name ?? null,
  scheme: r.scheme as Scheme,
  code: r.code,
  status: r.status as VoucherStatus,
  amountCents: r.amount_cents,
  declineReason: r.decline_reason,
  createdAt: r.created_at,
});

const COLUMNS =
  "id, family_id, scheme, code, status, amount_cents, decline_reason, created_at, families (display_name), children (first_name)";

// For the owner: vouchers waiting to be redeemed, oldest first.
export async function vouchersToRedeem(db: Db, organisationId: string): Promise<Voucher[]> {
  const { data, error } = await db
    .from("voucher_claims")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .eq("status", "submitted")
    .order("created_at");
  if (error) throw explain(error);
  return (data as unknown as Row[]).map(toVoucher);
}

export async function familyVouchers(db: Db, familyId: string): Promise<Voucher[]> {
  const { data, error } = await db
    .from("voucher_claims")
    .select(COLUMNS)
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) throw explain(error);
  return (data as unknown as Row[]).map(toVoucher);
}

export async function voucherSchemes(db: Db, organisationId: string): Promise<Scheme[]> {
  const { data, error } = await db.rpc("my_voucher_schemes", { p_org: organisationId });
  if (error) throw explain(error);
  return (data ?? []).filter(isScheme);
}

export async function setVoucherSchemes(db: Db, organisationId: string, schemes: Scheme[]) {
  const { error } = await db.rpc("set_voucher_schemes", {
    p_org: organisationId,
    p_schemes: schemes,
  });
  if (error) throw explain(error);
}

export async function submitVoucher(
  db: Db,
  input: { childId: string; scheme: Scheme; code: string },
) {
  const { error } = await db.rpc("submit_voucher", {
    p_child: input.childId,
    p_scheme: input.scheme,
    p_code: input.code,
  });
  if (error) throw explain(error);
}

export async function redeemVoucher(db: Db, claimId: string, amountCents: number) {
  const { error } = await db.rpc("redeem_voucher", {
    p_claim: claimId,
    p_amount_cents: amountCents,
  });
  if (error) throw explain(error);
}

export async function declineVoucher(db: Db, claimId: string, reason: string) {
  const { error } = await db.rpc("decline_voucher", { p_claim: claimId, p_reason: reason });
  if (error) throw explain(error);
}

// For the owner: vouchers dealt with in the last week, newest first.
export async function recentlyDecided(db: Db, organisationId: string): Promise<Voucher[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("voucher_claims")
    .select(COLUMNS)
    .eq("organisation_id", organisationId)
    .neq("status", "submitted")
    .gte("decided_at", since)
    .order("decided_at", { ascending: false })
    .limit(10);
  if (error) throw explain(error);
  return (data as unknown as Row[]).map(toVoucher);
}
