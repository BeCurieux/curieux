import { CalendarClock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { ClaimButtons } from "@/components/family/claim-buttons";
import { familyContext } from "@/lib/demo/context";
import { offerDetails, type OfferStatus } from "@/lib/domain/fill";
import { lessonMoment } from "@/lib/format";

export const metadata: Metadata = { title: "A spot opened" };

const CLOSED: Record<Exclude<OfferStatus, "offered">, string> = {
  claimed: "You've already claimed this spot.",
  declined: "You said no thanks to this spot.",
  expired: "This offer has expired.",
  filled: "Sorry, someone else took this spot.",
  withdrawn: "This offer is no longer open.",
};

// A claim link. It shows the offer only to the family it was made for, and
// only what the lesson is: never who is away or why.
export default async function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { db } = await familyContext();
  const offer = /^[0-9a-f]{64}$/.test(code) ? await offerDetails(db, code) : null;

  if (!offer) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/family">Home</BackLink>
        <EmptyState icon={<CalendarClock />} title="This link isn't available">
          It may be for another family, or it may have been mistyped.
        </EmptyState>
      </div>
    );
  }

  const when = lessonMoment(offer.startsAt, offer.timezone);
  const closed = offer.status === "offered" ? null : CLOSED[offer.status];

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/family">Home</BackLink>
      <div>
        <p className="inline-flex items-center gap-2 font-semibold text-muted">
          <Sparkles aria-hidden className="size-5" />A spot opened
        </p>
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          {offer.childFirstName} can come {when.day} at {when.time}
        </h1>
      </div>

      <section
        aria-label="The lesson"
        className="flex flex-col gap-1 rounded-lg bg-surface p-5 shadow-[0_1px_0_var(--border)]"
      >
        <p className="text-lg font-semibold">
          {offer.level} · {when.date}
        </p>
        <p className="text-muted">
          {offer.location}
          {offer.instructor ? ` · with ${offer.instructor}` : ""}
        </p>
        <p className="text-muted">It uses one of {offer.childFirstName}&apos;s make-up credits.</p>
      </section>

      {closed ? (
        <p role="status" className="rounded-md bg-surface-soft px-4 py-3 font-semibold">
          {closed}
        </p>
      ) : (
        <ClaimButtons code={code} child={offer.childFirstName} />
      )}
    </div>
  );
}
