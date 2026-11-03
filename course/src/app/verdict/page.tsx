import type { Metadata } from "next";
import Link from "next/link";
import { ColourBadge } from "@/components/calc/result";
import { Markdown } from "@/components/markdown";
import { formatMoney } from "@/lib/calc/format";
import { latestRun, myCurrency } from "@/lib/calc/runs";
import type { Colour } from "@/lib/calc/types";
import { requireUser } from "@/lib/auth/session";
import { loadAccess } from "@/lib/course/queries";
import { reaches } from "@/lib/course/tiers";
import { userClient } from "@/lib/supabase/server";
import { sendForReview } from "./actions";
import { VerdictForm } from "./verdict-form";

export const metadata: Metadata = { title: "Product Verdict" };

interface SavedVerdict {
  id: string;
  product_name: string;
  verdict: Colour;
  reasons_json: { reasons?: string[]; to_green?: string[] };
  submitted_at: string | null;
  reviewed_at: string | null;
  review_md: string | null;
  created_at: string;
}

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

// /verdict: Module 0 and above (SPEC.md → Pages and routes). Pulls her
// latest runs, asks the three yes/no questions, saves the verdict; founding
// members can send one for the founder's written review and see its status.
export default async function VerdictPage() {
  await requireUser("/verdict");
  const supabase = await userClient();
  const access = await loadAccess(supabase);

  if (!reaches(access.tier, "module0")) {
    return (
      <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
        <h1 className="text-4xl">Product Verdict</h1>
        <div
          className="border-line bg-paper mt-8 rounded-2xl border p-6"
          data-testid="verdict-locked"
        >
          <h2 className="text-2xl">The verdict opens with Module 0</h2>
          <p className="mt-3">
            It brings your Landed Cost, Unit Economics, Price Ladder and Cash Cycle together into
            one green, amber or red call.
          </p>
          <p className="mt-4">
            <Link href="/pricing">See what's included</Link>
          </p>
        </div>
      </main>
    );
  }

  const [unit, ladder, cash, currency, saved] = await Promise.all([
    latestRun(supabase, "unit-economics"),
    latestRun(supabase, "price-ladder"),
    latestRun(supabase, "cash-cycle"),
    myCurrency(supabase),
    supabase
      .from("verdicts")
      .select(
        "id, product_name, verdict, reasons_json, submitted_at, reviewed_at, review_md, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<SavedVerdict[]>(),
  ]);
  if (saved.error) throw new Error(`verdicts: ${saved.error.message}`);
  const founding = access.tier === "founding";
  const money = (n: unknown) => (typeof n === "number" ? formatMoney(n, currency) : "—");
  const margin = unit ? Number(unit.outputs_json.margin_pct) : null;
  const breakEven =
    unit && typeof unit.outputs_json.break_even_units === "number"
      ? unit.outputs_json.break_even_units
      : null;

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="text-mute">
        <Link href="/tools">Tools</Link>
      </p>
      <h1 className="mt-3 text-4xl">Product Verdict</h1>
      <p className="mt-3 text-lg">
        Green, amber or red for one product, with the reasons and what would turn it green.
      </p>

      <section
        className="border-line bg-paper mt-8 rounded-2xl border p-5"
        aria-labelledby="from-runs"
      >
        <h2 id="from-runs" className="text-2xl">
          From your latest runs
        </h2>
        <dl className="mt-3 space-y-2" data-testid="verdict-inputs">
          <div className="flex justify-between gap-4">
            <dt>
              Margin <Link href="/tools/unit-economics">(Unit Economics)</Link>
            </dt>
            <dd className="font-semibold">
              {margin === null ? "Not run yet" : `${Math.round(margin * 10) / 10}%`}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Break-even sales a month</dt>
            <dd className="font-semibold">
              {unit ? (breakEven ?? "Each sale loses money") : "Not run yet"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>
              Recommended price <Link href="/tools/price-ladder">(Price Ladder)</Link>
            </dt>
            <dd className="font-semibold">
              {ladder ? money(ladder.outputs_json.recommended_price) : "Not run yet"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>
              Cash the first order ties up <Link href="/tools/cash-cycle">(Cash Cycle)</Link>
            </dt>
            <dd className="font-semibold">
              {cash ? money(cash.outputs_json.cash_tied_up) : "Not run yet"}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-8">
        {unit && margin !== null ? (
          <VerdictForm margin={margin} breakEven={breakEven} />
        ) : (
          <p
            className="bg-danger-soft text-danger rounded-2xl p-4"
            data-testid="verdict-needs-runs"
          >
            The verdict starts from your numbers. Run{" "}
            <Link href="/tools/landed-cost">Landed Cost</Link>, then{" "}
            <Link href="/tools/unit-economics">Unit Economics</Link>, and come back.
          </p>
        )}
      </div>

      <section className="mt-12" aria-labelledby="saved">
        <h2 id="saved" className="text-2xl">
          Your verdicts
        </h2>
        {!founding ? (
          <p className="text-mute mt-2">
            Founding members can send a verdict for a written review.
          </p>
        ) : null}
        {saved.data.length === 0 ? <p className="mt-3">None saved yet.</p> : null}
        <ul className="mt-4 space-y-4">
          {saved.data.map((v) => (
            <li
              key={v.id}
              className="border-line bg-paper rounded-2xl border p-5"
              data-testid="saved-verdict"
            >
              <p className="flex flex-wrap items-center gap-3">
                <span className="text-xl font-semibold">{v.product_name}</span>
                <ColourBadge colour={v.verdict} />
              </p>
              <p className="text-mute mt-1">Saved {date(v.created_at)}</p>
              {v.reasons_json.reasons?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  {v.reasons_json.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              {v.reviewed_at && v.review_md ? (
                <div className="border-line mt-4 border-t pt-4">
                  <h3 className="text-xl">Review, {date(v.reviewed_at)}</h3>
                  <div className="mt-2">
                    <Markdown>{v.review_md}</Markdown>
                  </div>
                </div>
              ) : v.submitted_at ? (
                <p className="mt-4 font-semibold" data-testid="review-status">
                  Sent for review on {date(v.submitted_at)}. The review will appear here.
                </p>
              ) : founding ? (
                <form action={sendForReview} className="mt-4">
                  <input type="hidden" name="verdictId" value={v.id} />
                  <button
                    type="submit"
                    className="border-accent text-accent rounded-full border px-5 py-3 font-semibold"
                  >
                    Send for review
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
