import type { Metadata } from "next";
import { BackLink } from "@/components/demo/back-link";
import {
  ManagePlanButton,
  StartPlanButton,
  UpdateLocationsButton,
} from "@/components/payments/plan-buttons";
import { requireOwner } from "@/lib/business/owner";
import { formatMoney } from "@/lib/domain/accounts";
import { PLAN_PRICE_CENTS, schoolPlan, TRIAL_DAYS } from "@/lib/domain/plan";
import { refreshSchoolPlan } from "@/lib/payments/accounts";

export const metadata: Metadata = { title: "Ovyko plan" };

const day = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    timeZone: "Australia/Sydney",
  }).format(new Date(iso));

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

// What the school pays Ovyko (docs/SUBSCRIPTIONS.md).
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ started?: string }>;
}) {
  const { db, organisationId } = await requireOwner();
  if ((await searchParams).started) await refreshSchoolPlan(organisationId);
  const plan = await schoolPlan(db, organisationId);
  const sub = plan.subscription;
  const price = sub?.priceCents ?? PLAN_PRICE_CENTS;
  const billed = sub?.locations ?? null;
  const daysLeft = daysUntil(plan.trialEnds);

  return (
    <div className="rise flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Ovyko plan</h1>
        <p className="mt-1 text-muted">
          {formatMoney(PLAN_PRICE_CENTS)} a month for each location, paid by card or direct debit.
          The first {TRIAL_DAYS} days are free. Lessons, families and payments never stop because of
          a billing problem.
        </p>
      </div>

      <section
        aria-labelledby="plan-status"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <h2 id="plan-status" className="font-display text-2xl font-semibold">
          {plan.state === "demo"
            ? "Demo school"
            : plan.state === "ok"
              ? sub?.status === "trialing"
                ? "Your plan starts after the trial"
                : "Your plan is active"
              : plan.state === "attention"
                ? "Your last payment didn't go through"
                : plan.state === "trial"
                  ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left of your free trial`
                  : "Your free trial has ended"}
        </h2>
        {plan.state === "demo" ? (
          <p className="text-muted">Demo schools aren&apos;t billed.</p>
        ) : plan.state === "ok" ? (
          <>
            <p>
              {billed} {billed === 1 ? "location" : "locations"} at {formatMoney(price)} a month
              {sub?.status === "trialing" && sub.trialEnd
                ? `, from ${day(sub.trialEnd)}.`
                : sub?.periodEnd
                  ? `. Next payment ${day(sub.periodEnd)}.`
                  : "."}
              {sub?.cancelAtPeriodEnd ? " It's set to end then." : ""}
            </p>
            {billed !== null && billed !== Math.max(1, plan.locationsNow) ? (
              <UpdateLocationsButton
                label={`You have ${plan.locationsNow} locations now: update your plan`}
              />
            ) : null}
            <ManagePlanButton />
          </>
        ) : plan.state === "attention" ? (
          <>
            <p>Update your card or bank details and Stripe will try again.</p>
            <ManagePlanButton />
          </>
        ) : (
          <>
            <p>
              {plan.state === "trial"
                ? `Add your payment details now and you won't be charged until ${day(plan.trialEnds)}.`
                : "Add your payment details to keep using Ovyko."}{" "}
              {Math.max(1, plan.locationsNow)}{" "}
              {Math.max(1, plan.locationsNow) === 1 ? "location" : "locations"}:{" "}
              {formatMoney(price * Math.max(1, plan.locationsNow))} a month.
            </p>
            <StartPlanButton label="Set up your plan" />
          </>
        )}
      </section>
    </div>
  );
}
