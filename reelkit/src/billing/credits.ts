/**
 * The credit balance, as the handlers see it. The real one is Postgres
 * (`supabase/migrations`, wrapped in `src/server/supabase.ts`); the memory one
 * here mirrors its rules for tests, and `tests/db.test.ts` holds the SQL to
 * the same behaviour.
 */

export type Credits = {
  balance(user: string): Promise<number>;
  /** Takes one credit. The new balance, or null when there was none. */
  spend(user: string, ref: string): Promise<number | null>;
  /** Gives back the credit a spend took, once. */
  refund(user: string, ref: string): Promise<number | null>;
  /** Adds a paid pack once per Checkout session. False for a repeat. */
  grantPurchase(user: string, session: string, credits: number, amountCents: number, currency: string): Promise<boolean>;
};

export function memoryCredits(start: Record<string, number> = {}): Credits & { ledger: { user: string; delta: number; reason: string; ref: string }[] } {
  const balances = new Map(Object.entries(start));
  const ledger: { user: string; delta: number; reason: string; ref: string }[] = [];
  const has = (reason: string, ref: string, user?: string) =>
    ledger.some((l) => l.reason === reason && l.ref === ref && (user === undefined || l.user === user));
  return {
    ledger,
    async balance(user) {
      return balances.get(user) ?? 0;
    },
    async spend(user, ref) {
      const b = balances.get(user) ?? 0;
      if (b < 1 || has("spend", ref)) return null;
      balances.set(user, b - 1);
      ledger.push({ user, delta: -1, reason: "spend", ref });
      return b - 1;
    },
    async refund(user, ref) {
      if (!has("spend", ref, user) || has("refund", ref)) return null;
      const b = (balances.get(user) ?? 0) + 1;
      balances.set(user, b);
      ledger.push({ user, delta: 1, reason: "refund", ref });
      return b;
    },
    async grantPurchase(user, session, credits) {
      if (has("purchase", session)) return false;
      balances.set(user, (balances.get(user) ?? 0) + credits);
      ledger.push({ user, delta: credits, reason: "purchase", ref: session });
      return true;
    },
  };
}
