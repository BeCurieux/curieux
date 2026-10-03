import { explain, must, type Db } from "./db";

// Family accounts (docs/M7_PAYMENTS.md, M7a). Every amount is a line that is
// never changed; the balance is their sum. The database decides who may add
// which line and works out term fees from the timetable.

export type LineKind = "term_fee" | "charge" | "payment" | "credit" | "refund" | "cancellation";
export type PaymentMethod = "bank_transfer" | "card" | "cash" | "other" | "direct_debit";

export type AccountLine = {
  id: string;
  kind: LineKind;
  // Positive adds to what's owed; negative reduces it.
  amountCents: number;
  description: string;
  childId: string | null;
  lessons: number | null;
  unitCents: number | null;
  method: PaymentMethod | null;
  paidOn: string | null;
  cancelsId: string | null;
  cancelled: boolean;
  // Paid or refunded online: changed only by a refund in Stripe.
  online: boolean;
  createdAt: string;
};

export const KIND_LABELS: Record<LineKind, string> = {
  term_fee: "Term fee",
  charge: "Charge",
  payment: "Payment",
  credit: "Credit",
  refund: "Refund",
  cancellation: "Cancelled",
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  other: "Other",
  direct_debit: "Direct debit",
};

// A family's lines, newest first, each marked if it has been cancelled.
export async function familyLines(db: Db, familyId: string): Promise<AccountLine[]> {
  const { data, error } = await db
    .from("ledger_entries")
    .select(
      "id, kind, amount_cents, description, child_id, lessons, unit_cents, method, paid_on, cancels_id, online_payment_id, created_at",
    )
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) throw explain(error);
  const cancelled = new Set((data ?? []).map((l) => l.cancels_id).filter(Boolean));
  return (data ?? []).map((l) => ({
    id: l.id,
    kind: l.kind as LineKind,
    amountCents: l.amount_cents,
    description: l.description,
    childId: l.child_id,
    lessons: l.lessons,
    unitCents: l.unit_cents,
    method: l.method as PaymentMethod | null,
    paidOn: l.paid_on,
    cancelsId: l.cancels_id,
    cancelled: cancelled.has(l.id),
    online: l.online_payment_id !== null,
    createdAt: l.created_at,
  }));
}

export const balanceOf = (lines: AccountLine[]) => lines.reduce((sum, l) => sum + l.amountCents, 0);

export type FamilyBalance = { familyId: string; name: string; balanceCents: number };

export async function familyBalances(db: Db, organisationId: string): Promise<FamilyBalance[]> {
  const { data, error } = await db.rpc("family_balances", { p_org: organisationId });
  if (error) throw explain(error);
  return (data ?? []).map((r) => ({
    familyId: r.family_id,
    name: r.display_name,
    balanceCents: r.balance_cents,
  }));
}

export async function createTermFees(db: Db, termId: string): Promise<number> {
  const { data, error } = await db.rpc("create_term_fees", { p_term: termId });
  if (error) throw explain(error);
  return data ?? 0;
}

export async function recordPayment(
  db: Db,
  familyId: string,
  input: { amountCents: number; method: PaymentMethod; paidOn: string; note: string | null },
) {
  must(
    await db.rpc("record_payment", {
      p_family: familyId,
      p_amount_cents: input.amountCents,
      p_method: input.method,
      p_paid_on: input.paidOn,
      p_note: input.note ?? undefined,
    }),
  );
}

export async function addLine(
  db: Db,
  familyId: string,
  input: { kind: "credit" | "charge"; amountCents: number; reason: string },
) {
  must(
    await db.rpc("add_account_line", {
      p_family: familyId,
      p_kind: input.kind,
      p_amount_cents: input.amountCents,
      p_reason: input.reason,
    }),
  );
}

export async function cancelLine(db: Db, lineId: string, reason: string) {
  must(await db.rpc("cancel_ledger_entry", { p_entry: lineId, p_reason: reason }));
}

// 123456 → "$1,234.56"; whole dollars without cents.
export function formatMoney(cents: number): string {
  const abs = Math.abs(cents);
  const text = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: abs % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(abs / 100);
  return cents < 0 ? `-${text}` : text;
}

// What a balance means, in plain words.
export function balanceWords(cents: number): string {
  if (cents > 0) return `${formatMoney(cents)} owing`;
  if (cents < 0) return `${formatMoney(-cents)} in credit`;
  return "Paid up";
}
