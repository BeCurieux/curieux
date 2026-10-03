import { CalendarRange, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TermOnlySwitch } from "@/components/business/term-forms";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/business/owner";
import {
  listTerms,
  schoolToday,
  shortDate,
  termSettings,
  termStage,
  type TermStage,
} from "@/lib/domain/terms";

export const metadata: Metadata = { title: "Terms" };

const STAGE_LABELS: Record<TermStage, string> = {
  planned: "Coming up",
  asking: "Asking families",
  under_way: "Under way",
  finished: "Finished",
};

export default async function TermsPage() {
  const { db, organisationId } = await requireOwner();
  const [terms, settings] = await Promise.all([
    listTerms(db, organisationId),
    termSettings(db, organisationId),
  ]);
  const today = schoolToday(settings.timezone);
  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Terms</h1>
          <p className="mt-1 max-w-xl text-muted">
            Before each term, ask every family whether they&apos;re staying, and offer moves up a
            level, in one go.
          </p>
        </div>
        <Button asChild>
          <Link href="/business/settings/terms/new">
            <Plus aria-hidden />
            Add term
          </Link>
        </Button>
      </div>

      {terms.length === 0 ? (
        <EmptyState icon={<CalendarRange />} title="No terms yet">
          Add your terms, with their first and last days.
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {terms.map((t) => {
            const stage = termStage(t, today);
            return (
              <li key={t.id}>
                <Link
                  href={`/business/settings/terms/${t.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#faf9fc]"
                >
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-muted">
                      {shortDate(t.startsOn)} to {shortDate(t.endsOn)}
                    </p>
                  </div>
                  <span
                    className={
                      stage === "asking"
                        ? "rounded-full bg-butter px-3 py-1 text-sm font-semibold"
                        : "text-sm text-muted"
                    }
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <TermOnlySwitch on={settings.termOnly} />
    </div>
  );
}
