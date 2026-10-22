import type { Metadata } from "next";
import Link from "next/link";
import { FitQuiz } from "@/components/fit/quiz";
import { Card, PageHeader } from "@/components/ui/card";
import { PROMISE, PROMISE_SUPPORT } from "@/content/brand";
import { OPPORTUNITIES } from "@/lib/fit/data";
import { studio } from "@/lib/studio/context";

export const metadata: Metadata = { title: "Fit Finder" };

export default async function FitFinder() {
  const { repo } = await studio();
  const past = await repo.listFitResults();
  return (
    <main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <PageHeader eyebrow="The Income Fit Test · Fit Finder" title={PROMISE}>
        <p>{PROMISE_SUPPORT}</p>
        <p className="mt-3 text-base">
          Twenty questions about your time, budget, skills and limits, scored against{" "}
          {OPPORTUNITIES.length} researched ideas. You get your top three, with why each fits. With
          The Income Fit Test, the full report adds the rules where you live, a calculator, a dated
          14-day test and your Day 14 decision lines.
        </p>
      </PageHeader>
      {past.length > 0 ? (
        <Card className="mb-6">
          <h2 className="text-xl">Your reports</h2>
          <ul className="mt-3 space-y-1">
            {past.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/studio/fit/${r.id}`}
                  className="text-aubergine font-semibold underline"
                >
                  Report from{" "}
                  {new Date(r.createdAt).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card>
        <FitQuiz />
      </Card>
      <p className="text-mute mt-6 text-sm">
        No income promises: this matches your circumstances to ideas and helps you test one cheaply.
        Figures are labelled FACT, EST (estimate) or UNKNOWN.
      </p>
    </main>
  );
}
