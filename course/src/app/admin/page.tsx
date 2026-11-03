import type { Metadata } from "next";
import Link from "next/link";
import { ColourBadge } from "@/components/calc/result";
import { Markdown } from "@/components/markdown";
import { requireAdmin } from "@/lib/admin/guard";
import { computeNumbers, TIME_ZONE, type WindowNumbers } from "@/lib/admin/numbers";
import { tierFromEntitlements } from "@/lib/admin/tier";
import { formatMoney, type Currency } from "@/lib/calc/format";
import type { Colour } from "@/lib/calc/types";
import { userClient } from "@/lib/supabase/server";
import { adminRefund, sendReview } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// /admin (SPEC.md → Admin): one page, five tabs. Every read goes through
// row level security as the admin (admins read all); the two writes,
// refunds and reviews, are server actions that check again.

const TABS = [
  ["buyers", "Buyers"],
  ["leads", "Leads"],
  ["cohort", "Cohort"],
  ["verdicts", "Verdicts"],
  ["numbers", "Numbers"],
] as const;
type Tab = (typeof TABS)[number][0];

type Search = { tab?: string; q?: string; refund?: string; review?: string };

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-AU", {
        timeZone: TIME_ZONE,
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const TIER_LABEL: Record<string, string> = {
  free: "Free",
  module0: "Module 0",
  course: "Course",
  founding: "Founding",
};

interface OrderRow {
  id: string;
  user_id: string | null;
  created_at: string;
  refunded_at: string | null;
  status: "paid" | "refunded";
  amount_cents: number;
  currency: string;
  bump_product_id: string | null;
  products: { name: string; tier: "module0" | "course" | "founding" | "benchmark_pack" } | null;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const params = await searchParams;
  const tab: Tab = TABS.some(([key]) => key === params.tab) ? (params.tab as Tab) : "buyers";

  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-5 py-10">
      <p className="text-mute">
        <Link href="/learn">Your course</Link>
      </p>
      <h1 className="mt-3 text-4xl">Admin</h1>
      <nav aria-label="Admin" className="border-line mt-6 flex flex-wrap gap-2 border-b pb-3">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={`rounded-full px-4 py-2 font-semibold no-underline ${tab === key ? "bg-accent text-on-accent" : "text-accent"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">
        {tab === "buyers" ? <Buyers params={params} /> : null}
        {tab === "leads" ? <Leads /> : null}
        {tab === "cohort" ? <Cohort params={params} /> : null}
        {tab === "verdicts" ? <Verdicts /> : null}
        {tab === "numbers" ? <Numbers /> : null}
      </div>
    </main>
  );
}

async function loadOrders() {
  const db = await userClient();
  const { data, error } = await db
    .from("orders")
    .select(
      "id, user_id, created_at, refunded_at, status, amount_cents, currency, bump_product_id, products!orders_product_id_fkey(name, tier)",
    )
    .order("created_at", { ascending: false })
    .limit(2000)
    .returns<OrderRow[]>();
  if (error) throw new Error(`orders: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------

async function Buyers({ params }: { params: Search }) {
  const db = await userClient();
  const q = (params.q ?? "").trim().toLowerCase().slice(0, 100);
  const orders = await loadOrders();
  const userIds = [
    ...new Set(orders.map((o) => o.user_id).filter((id): id is string => Boolean(id))),
  ];
  const [profiles, entitlements] = await Promise.all([
    userIds.length
      ? db.from("profiles").select("user_id, email, country").in("user_id", userIds)
      : { data: [] },
    userIds.length
      ? db.from("entitlements").select("user_id, tier, revoked_at").in("user_id", userIds)
      : { data: [] },
  ]);
  const buyers = (profiles.data ?? [])
    .map((p) => ({
      ...p,
      orders: orders.filter((o) => o.user_id === p.user_id),
      access: tierFromEntitlements(
        (entitlements.data ?? []).filter((e) => e.user_id === p.user_id),
      ),
    }))
    .filter((b) => !q || b.email.toLowerCase().includes(q))
    .sort((a, b) => (a.orders[0]!.created_at < b.orders[0]!.created_at ? 1 : -1));

  return (
    <section aria-labelledby="buyers">
      <h2 id="buyers" className="text-2xl">
        Buyers
      </h2>
      {params.refund === "done" ? (
        <p role="status" className="mt-3 font-semibold">
          Refunded. Access is revoked and the confirmation email is on its way.
        </p>
      ) : params.refund === "error" ? (
        <p role="alert" className="text-danger mt-3">
          That refund didn't go through. Check the Stripe dashboard.
        </p>
      ) : null}
      <form className="mt-4 flex max-w-md gap-2" role="search">
        <input type="hidden" name="tab" value="buyers" />
        <label htmlFor="q" className="sr-only">
          Search buyers by email
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search by email"
          className="border-line bg-paper w-full rounded-xl border px-4 py-2"
        />
        <button
          type="submit"
          className="bg-accent text-on-accent rounded-full px-5 py-2 font-semibold"
        >
          Search
        </button>
      </form>
      <p className="text-mute mt-3">{buyers.length} buyer(s)</p>
      <ul className="mt-4 space-y-4">
        {buyers.map((b) => (
          <li
            key={b.user_id}
            className="border-line bg-paper rounded-2xl border p-5"
            data-testid="buyer"
          >
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{b.email}</span>
              <span className="text-mute">
                {TIER_LABEL[b.access.tier]}
                {b.access.benchmarkPack &&
                b.access.tier !== "course" &&
                b.access.tier !== "founding"
                  ? " + pack"
                  : ""}
                {" · "}
                {b.country ?? "country unknown"}
              </span>
            </p>
            <table className="mt-3 w-full text-left text-base">
              <thead className="text-mute">
                <tr>
                  <th className="py-1 font-medium">Purchase</th>
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Paid</th>
                  <th className="py-1 font-medium">
                    <span className="sr-only">Refund</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {b.orders.map((o) => {
                  const amount = formatMoney(
                    o.amount_cents / 100,
                    o.currency.toUpperCase() as Currency,
                  );
                  return (
                    <tr key={o.id} className="border-line border-t">
                      <td className="py-2">
                        {o.products?.name}
                        {o.bump_product_id ? " + benchmark pack" : ""}
                      </td>
                      <td className="py-2">{date(o.created_at)}</td>
                      <td className="py-2">{amount}</td>
                      <td className="py-2 text-right">
                        {o.status === "refunded" ? (
                          <span className="text-mute">Refunded {date(o.refunded_at)}</span>
                        ) : (
                          <details>
                            <summary className="text-accent cursor-pointer font-semibold underline underline-offset-4">
                              Refund
                            </summary>
                            <form action={adminRefund} className="mt-2">
                              <input type="hidden" name="orderId" value={o.id} />
                              <input type="hidden" name="q" value={q} />
                              <button
                                type="submit"
                                className="bg-accent text-on-accent rounded-full px-4 py-2 font-semibold"
                              >
                                Refund {amount} to {b.email}
                              </button>
                            </form>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

async function Leads() {
  const db = await userClient();
  const [{ data: leads }, orders] = await Promise.all([
    db
      .from("leads")
      .select("email, source, first_seen, interests, converted_user_id")
      .order("first_seen", { ascending: false })
      .limit(500),
    loadOrders(),
  ]);
  const buyers = new Set(
    orders
      .filter((o) => o.user_id && o.products && o.products.tier !== "benchmark_pack")
      .map((o) => o.user_id!),
  );

  return (
    <section aria-labelledby="leads">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="leads" className="text-2xl">
          Leads
        </h2>
        <a
          href="/admin/leads.csv"
          className="border-accent text-accent rounded-full border px-5 py-2 font-semibold no-underline"
          download
        >
          Export CSV
        </a>
      </div>
      <p className="text-mute mt-2">The newest 500; the CSV has them all.</p>
      <div
        role="region"
        aria-label="Leads table"
        tabIndex={0}
        className="border-line bg-paper mt-4 overflow-x-auto rounded-2xl border"
      >
        <table className="w-full text-left text-base">
          <thead className="text-mute">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">First seen</th>
              <th className="px-4 py-2 font-medium">Converted</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((l) => (
              <tr key={l.email} className="border-line border-t" data-testid="lead-row">
                <td className="px-4 py-2">{l.email}</td>
                <td className="px-4 py-2">
                  {l.source.replace("_", " ")}
                  {(l.interests as string[]).length
                    ? ` (${(l.interests as string[]).join(", ").replace("_", " ")})`
                    : ""}
                </td>
                <td className="px-4 py-2">{date(l.first_seen)}</td>
                <td className="px-4 py-2">
                  {l.converted_user_id && buyers.has(l.converted_user_id)
                    ? "Bought"
                    : l.converted_user_id
                      ? "Signed in"
                      : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

interface VerdictRow {
  id: string;
  user_id: string;
  product_name: string;
  verdict: Colour;
  reasons_json: { reasons?: string[] };
  submitted_at: string | null;
  reviewed_at: string | null;
  review_md: string | null;
  created_at: string;
}

async function loadVerdicts(userIds?: string[]) {
  const db = await userClient();
  let query = db
    .from("verdicts")
    .select(
      "id, user_id, product_name, verdict, reasons_json, submitted_at, reviewed_at, review_md, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if (userIds)
    query = query.in(
      "user_id",
      userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"],
    );
  const { data, error } = await query.returns<VerdictRow[]>();
  if (error) throw new Error(`verdicts: ${error.message}`);
  return data;
}

async function emailsFor(userIds: string[]) {
  if (!userIds.length) return new Map<string, string>();
  const { data } = await (
    await userClient()
  )
    .from("profiles")
    .select("user_id, email")
    .in("user_id", userIds);
  return new Map((data ?? []).map((p) => [p.user_id as string, p.email as string]));
}

async function Cohort({ params }: { params: Search }) {
  const db = await userClient();
  const [{ data: founding }, orders] = await Promise.all([
    db.from("products").select("places_total, places_sold").eq("tier", "founding").maybeSingle(),
    loadOrders(),
  ]);
  const members = orders.filter(
    (o) => o.products?.tier === "founding" && o.status === "paid" && o.user_id,
  );
  const ids = [...new Set(members.map((o) => o.user_id!))];
  const [emails, verdicts] = await Promise.all([emailsFor(ids), loadVerdicts(ids)]);

  return (
    <section aria-labelledby="cohort">
      <h2 id="cohort" className="text-2xl">
        Founding cohort
      </h2>
      <p className="mt-2 text-xl font-semibold" data-testid="places">
        {founding?.places_sold ?? 0} of {founding?.places_total ?? 30} places sold
      </p>
      {params.review === "sent" ? (
        <p role="status" className="mt-3 font-semibold">
          Review saved and emailed.
        </p>
      ) : params.review === "empty" ? (
        <p role="alert" className="text-danger mt-3">
          Write the review before sending it.
        </p>
      ) : params.review === "error" ? (
        <p role="alert" className="text-danger mt-3">
          That review couldn't be saved. It may already have been sent.
        </p>
      ) : null}
      <ul className="mt-6 space-y-5">
        {ids.map((id) => {
          const mine = verdicts.filter((v) => v.user_id === id && v.submitted_at);
          const joined = members.find((o) => o.user_id === id)!.created_at;
          return (
            <li
              key={id}
              className="border-line bg-paper rounded-2xl border p-5"
              data-testid="member"
            >
              <p className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{emails.get(id)}</span>
                <span className="text-mute">Joined {date(joined)}</span>
              </p>
              {mine.length === 0 ? (
                <p className="text-mute mt-3">No verdict sent for review yet.</p>
              ) : null}
              {mine.map((v) => (
                <div
                  key={v.id}
                  className="border-line mt-4 border-t pt-4"
                  data-testid="cohort-verdict"
                >
                  <p className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-semibold">{v.product_name}</span>
                    <ColourBadge colour={v.verdict} />
                    <span className="text-mute">Sent {date(v.submitted_at)}</span>
                  </p>
                  {v.reasons_json.reasons?.length ? (
                    <ul className="mt-2 list-disc pl-5 text-base">
                      {v.reasons_json.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  {v.reviewed_at && v.review_md ? (
                    <div className="mt-3">
                      <p className="font-semibold">Reviewed {date(v.reviewed_at)}</p>
                      <div className="mt-2 text-base">
                        <Markdown>{v.review_md}</Markdown>
                      </div>
                    </div>
                  ) : (
                    <form action={sendReview} className="mt-3">
                      <input type="hidden" name="verdictId" value={v.id} />
                      <label htmlFor={`review-${v.id}`} className="block font-semibold">
                        Your review of {v.product_name}
                      </label>
                      <textarea
                        id={`review-${v.id}`}
                        name="review"
                        rows={6}
                        className="border-line bg-ivory mt-2 block w-full rounded-xl border px-4 py-3"
                      />
                      <p className="text-mute mt-1 text-base">
                        Markdown works. She sees it on her verdict page and gets an email.
                      </p>
                      <button
                        type="submit"
                        className="bg-accent text-on-accent mt-3 rounded-full px-5 py-3 font-semibold"
                      >
                        Send review
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </li>
          );
        })}
      </ul>
      {ids.length === 0 ? <p className="mt-4">No founding members yet.</p> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------

async function Verdicts() {
  const verdicts = await loadVerdicts();
  const emails = await emailsFor([...new Set(verdicts.map((v) => v.user_id))]);
  return (
    <section aria-labelledby="verdicts">
      <h2 id="verdicts" className="text-2xl">
        Verdicts
      </h2>
      <p className="text-mute mt-2">Every saved verdict, newest first.</p>
      <div
        role="region"
        aria-label="Verdicts table"
        tabIndex={0}
        className="border-line bg-paper mt-4 overflow-x-auto rounded-2xl border"
      >
        <table className="w-full text-left text-base">
          <thead className="text-mute">
            <tr>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Verdict</th>
              <th className="px-4 py-2 font-medium">Who</th>
              <th className="px-4 py-2 font-medium">Saved</th>
              <th className="px-4 py-2 font-medium">Review</th>
            </tr>
          </thead>
          <tbody>
            {verdicts.map((v) => (
              <tr key={v.id} className="border-line border-t" data-testid="verdict-row">
                <td className="px-4 py-2 font-semibold">{v.product_name}</td>
                <td className="px-4 py-2">
                  <ColourBadge colour={v.verdict} />
                </td>
                <td className="px-4 py-2">{emails.get(v.user_id)}</td>
                <td className="px-4 py-2">{date(v.created_at)}</td>
                <td className="px-4 py-2">
                  {v.reviewed_at ? (
                    "Reviewed"
                  ) : v.submitted_at ? (
                    <Link href="/admin?tab=cohort">Waiting</Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

// The clock is read here, outside the component, so the page itself stays pure.
async function loadNumbers() {
  const db = await userClient();
  const now = new Date();
  const since = new Date(now.getTime() - 9 * 86_400_000).toISOString();
  const [{ data: leads }, orders] = await Promise.all([
    db.from("leads").select("first_seen, converted_user_id").gte("first_seen", since),
    loadOrders(),
  ]);
  return computeNumbers(
    (leads ?? []).map((l) => ({ firstSeen: l.first_seen, convertedUserId: l.converted_user_id })),
    orders
      .filter((o) => o.products)
      .map((o) => ({
        userId: o.user_id,
        tier: o.products!.tier,
        createdAt: o.created_at,
        refundedAt: o.refunded_at,
      })),
    now,
  );
}

async function Numbers() {
  const numbers = await loadNumbers();
  const rows: [string, (n: WindowNumbers) => string][] = [
    ["Leads", (n) => String(n.leads)],
    ["Module 0 sales", (n) => String(n.module0Sales)],
    ["Course sales", (n) => String(n.courseSales)],
    ["Founding sales", (n) => String(n.foundingSales)],
    ["Refunds", (n) => String(n.refunds)],
    [
      "Lead → buyer",
      (n) =>
        n.conversionPct === null ? "—" : `${n.converted} of ${n.leads} (${n.conversionPct}%)`,
    ],
  ];
  return (
    <section aria-labelledby="numbers">
      <h2 id="numbers" className="text-2xl">
        Numbers
      </h2>
      <p className="text-mute mt-2">Today and the last 7 days, Sydney time.</p>
      <div
        role="region"
        aria-label="Numbers table"
        tabIndex={0}
        className="border-line bg-paper mt-4 overflow-x-auto rounded-2xl border"
      >
        <table className="w-full text-left text-lg" data-testid="numbers">
          <thead className="text-mute">
            <tr>
              <th className="px-4 py-2 font-medium">
                <span className="sr-only">Measure</span>
              </th>
              <th className="px-4 py-2 font-medium">Today</th>
              <th className="px-4 py-2 font-medium">7 days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-line border-t">
                <th scope="row" className="px-4 py-3 font-semibold">
                  {label}
                </th>
                <td className="px-4 py-3">{value(numbers.today)}</td>
                <td className="px-4 py-3">{value(numbers.week)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
