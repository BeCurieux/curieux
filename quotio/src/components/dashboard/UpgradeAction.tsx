// The way out of a paused account (brief §35, §41, §44).
//
// A server component, because whether there is a payment rail at all is a
// server fact — §44 keeps Stripe optional, so this has to be honest in a
// deployment with no keys as well as one with them. Three cases, three
// different true things:
//
//   • cards on          → a real checkout for the next plan up
//   • cards off         → the thing that does work, which is asking us
//   • already the top   → nothing to sell, so it doesn't pretend
//
// What it must never be is an "Upgrade" button that goes nowhere, which is
// exactly the sort of button §41 is about.

import Link from "next/link";
import { brand } from "@/config/brand";
import { billingEnabled } from "@/lib/billing/stripe";
import { nextPlanUp, PLANS, type PlanId } from "@/lib/plans";

export function UpgradeAction({ plan }: { plan: PlanId }) {
  const current = PLANS[plan];
  const next = nextPlanUp(plan);

  if (!next) {
    return (
      <div className="mt-4">
        <a href={mailto(`Higher limit on ${current.name}`)} className="btn-secondary">
          Ask us about a higher limit
        </a>
        <p className="mt-2 text-xs text-muted">
          {current.name} is our largest plan, so this one isn&rsquo;t self-serve — tell us roughly
          how much you need and we&rsquo;ll sort it.
        </p>
      </div>
    );
  }

  if (billingEnabled()) {
    return (
      <div className="mt-4">
        <form action="/api/billing/checkout" method="post">
          <input type="hidden" name="plan" value={next.id} />
          <button type="submit" className="btn">
            Move to {next.name} — ${next.price}/yr
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          {next.limits.interactions.toLocaleString()} interactions a month. Your widgets start
          working again as soon as the payment goes through — there&rsquo;s nothing to re-publish.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <a href={mailto(`Moving to ${next.name}`)} className="btn">
          Ask us to move you to {next.name}
        </a>
        <Link href="/pricing" className="btn-secondary">
          Compare plans
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted">
        Card payments aren&rsquo;t switched on in this deployment, so upgrades go through us.{" "}
        {next.name} is {next.limits.interactions.toLocaleString()} interactions a month.
      </p>
    </div>
  );
}

function mailto(subject: string): string {
  return `mailto:${brand.supportEmail}?subject=${encodeURIComponent(subject)}`;
}
