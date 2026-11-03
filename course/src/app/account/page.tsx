import type { Metadata } from "next";
import Link from "next/link";
import { serverEnv } from "@/env";
import { formatMoney, type Currency } from "@/lib/calc/format";
import { requireUser } from "@/lib/auth/session";
import { refundable, REFUND_DAYS } from "@/lib/commerce/plan";
import { loadAccess } from "@/lib/course/queries";
import { userClient } from "@/lib/supabase/server";
import { requestRefund } from "./actions";

export const metadata: Metadata = { title: "Your account" };

interface OrderRow {
  id: string;
  created_at: string;
  amount_cents: number;
  currency: string;
  status: "paid" | "refunded";
  refunded_at: string | null;
  bump_product_id: string | null;
  products: { name: string } | null;
}

const ACCESS: Record<string, string> = {
  free: "The free Product Check",
  module0: "Module 0",
  course: "The full course",
  founding: "The founding cohort (the full course and a written verdict review)",
};

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ refund?: string }>;
}) {
  const user = await requireUser("/account");
  const { refund } = await searchParams;
  const supabase = await userClient();
  const [access, orders] = await Promise.all([
    loadAccess(supabase),
    supabase
      .from("orders")
      .select(
        "id, created_at, amount_cents, currency, status, refunded_at, bump_product_id, products!orders_product_id_fkey(name)",
      )
      .order("created_at", { ascending: false })
      .returns<OrderRow[]>(),
  ]);
  if (orders.error) throw new Error(`orders: ${orders.error.message}`);
  const support = serverEnv().SUPPORT_EMAIL;

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="text-mute">
        <Link href="/learn">Your course</Link>
      </p>
      <h1 className="mt-3 text-4xl">Your account</h1>
      <p className="text-mute mt-3">{user.email}</p>

      {refund === "done" ? (
        <p role="status" className="border-line bg-paper mt-6 rounded-xl border p-4 font-semibold">
          Refunded. The money reaches your card in a few days, and that purchase's access has ended.
        </p>
      ) : refund === "error" ? (
        <p role="alert" className="bg-danger-soft text-danger mt-6 rounded-xl p-4">
          That refund didn't go through.{" "}
          {support ? `Email ${support} and we'll sort it out.` : "Please try again."}
        </p>
      ) : null}

      <section className="mt-8" aria-labelledby="access">
        <h2 id="access" className="text-2xl">
          Your access
        </h2>
        <p className="mt-2" data-testid="access">
          {ACCESS[access.tier ?? "free"]}
          {access.benchmarkPack && access.tier !== "course" && access.tier !== "founding"
            ? ", plus the benchmark pack"
            : ""}
        </p>
      </section>

      <section className="mt-10" aria-labelledby="purchases">
        <h2 id="purchases" className="text-2xl">
          Purchases
        </h2>
        {orders.data.length === 0 ? <p className="mt-2">Nothing yet.</p> : null}
        <ul className="mt-4 space-y-4">
          {orders.data.map((order) => {
            const amount = formatMoney(
              order.amount_cents / 100,
              order.currency.toUpperCase() as Currency,
            );
            const name = `${order.products?.name ?? "Purchase"}${order.bump_product_id ? " + benchmark pack" : ""}`;
            return (
              <li
                key={order.id}
                className="border-line bg-paper rounded-2xl border p-5"
                data-testid="order"
              >
                <p className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{name}</span>
                  <span>{amount}</span>
                </p>
                <p className="text-mute mt-1">
                  Bought {date(order.created_at)}
                  {order.status === "refunded" && order.refunded_at
                    ? ` · Refunded ${date(order.refunded_at)}`
                    : ""}
                </p>
                {refundable(order) ? (
                  <details className="mt-4">
                    <summary className="text-accent cursor-pointer font-semibold underline underline-offset-4">
                      Refund this purchase
                    </summary>
                    <form action={requestRefund} className="mt-3">
                      <input type="hidden" name="orderId" value={order.id} />
                      <p>
                        You'll get {amount} back and lose access to what it unlocked. No reason
                        needed.
                      </p>
                      <button
                        type="submit"
                        className="bg-accent text-on-accent mt-3 rounded-full px-5 py-3 font-semibold"
                      >
                        Refund {amount}
                      </button>
                    </form>
                  </details>
                ) : order.status === "paid" ? (
                  <p className="text-mute mt-4">
                    The {REFUND_DAYS}-day self-serve refund has passed.{" "}
                    {support ? (
                      <a
                        href={`mailto:${support}?subject=${encodeURIComponent(`Refund request: ${name}, ${date(order.created_at)}`)}`}
                      >
                        Email us about a refund
                      </a>
                    ) : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
