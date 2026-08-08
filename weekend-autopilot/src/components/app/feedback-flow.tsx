"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitFeedback } from "@/app/(product)/actions";
import { Button, Card, ChoiceCard, SectionLabel } from "@/components/ui";
import type { NotDoneReason, Rating } from "@/lib/types";

/**
 * The feedback flow (§24).
 *
 * Yes/no, then at most one follow-up question, then done. The design rule is
 * that answering must never feel like a survey — so the yes path submits
 * immediately on the first tap and treats the rating as a bonus, and the no
 * path asks exactly one optional question.
 */
const RATINGS: Array<{ value: Rating; label: string }> = [
  { value: "LOVED", label: "😍 Loved it" },
  { value: "GOOD", label: "🙂 Good" },
  { value: "FINE", label: "😐 Fine" },
  { value: "NOT_FOR_ME", label: "🙅 Not for me" },
];

const REASONS: Array<{ value: NotDoneReason; label: string }> = [
  { value: "PLANS_CHANGED", label: "Plans changed" },
  { value: "TOO_TIRED", label: "Too tired" },
  { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "WEATHER", label: "Weather" },
  { value: "TOO_FAR", label: "Too far" },
  { value: "DIDNT_APPEAL", label: "Didn’t appeal" },
  { value: "SOMETHING_ELSE", label: "Something else" },
];

export function FeedbackFlow({
  planId,
  initialDidIt,
  alreadyAnswered,
}: {
  planId: string;
  initialDidIt: "YES" | "NO" | null;
  alreadyAnswered: boolean;
}) {
  const [didIt, setDidIt] = useState<"YES" | "NO" | null>(initialDidIt);
  const [rating, setRating] = useState<Rating | null>(null);
  const [reason, setReason] = useState<NotDoneReason | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(alreadyAnswered);
  const [pending, startTransition] = useTransition();

  function send(next: {
    didIt: "YES" | "NO";
    rating?: Rating | null;
    reason?: NotDoneReason | null;
    finish?: boolean;
  }) {
    startTransition(async () => {
      await submitFeedback({
        planId,
        didIt: next.didIt,
        rating: next.rating ?? null,
        reason: next.reason ?? null,
        note: note.trim() ? note.trim() : null,
      });
      if (next.finish) setDone(true);
    });
  }

  if (done) {
    return (
      <Card className="p-7 text-center">
        <p className="font-display text-[22px] leading-snug text-ink">Thank you.</p>
        <p className="mx-auto mt-2 max-w-prose text-[15px] leading-relaxed text-graphite">
          That single answer teaches us more than any preference form. Next weekend will be
          better for it.
        </p>
        <Link
          href="/app"
          className="mt-5 inline-block text-[15px] font-semibold text-forest underline-offset-4 hover:underline"
        >
          Back to this weekend →
        </Link>
      </Card>
    );
  }

  // ---------------------------------------------------------------- step 1
  if (didIt === null) {
    return (
      <Card className="p-7">
        <h2 className="text-[22px] leading-snug text-ink">Did you do it?</h2>
        <div className="mt-5 flex gap-3">
          <Button
            block
            disabled={pending}
            onClick={() => {
              setDidIt("YES");
              // Record the answer immediately. The rating is optional and the
              // "did it" number is the one that matters.
              send({ didIt: "YES" });
            }}
          >
            Yes
          </Button>
          <Button
            block
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setDidIt("NO");
              send({ didIt: "NO" });
            }}
          >
            No
          </Button>
        </div>
      </Card>
    );
  }

  // ------------------------------------------------------------ yes branch
  if (didIt === "YES") {
    return (
      <Card className="p-7">
        <SectionLabel>Good</SectionLabel>
        <h2 className="mt-2 text-[22px] leading-snug text-ink">How was it?</h2>

        <div className="mt-5 space-y-2">
          {RATINGS.map((option) => (
            <ChoiceCard
              key={option.value}
              title={option.label}
              selected={rating === option.value}
              onClick={() => setRating(option.value)}
            />
          ))}
        </div>

        <div className="mt-5">
          <label htmlFor="best-bit" className="text-[14px] font-medium text-graphite">
            What was the best bit? <span className="text-mist">Optional</span>
          </label>
          <input
            id="best-bit"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            className="mt-1.5 h-12 w-full rounded-xl border border-rule bg-white px-4 text-[15px] text-ink"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            disabled={pending || rating === null}
            onClick={() => send({ didIt: "YES", rating, finish: true })}
          >
            {pending ? "Saving…" : "Done"}
          </Button>
          <Button variant="ghost" onClick={() => setDone(true)}>
            Skip
          </Button>
        </div>
      </Card>
    );
  }

  // ------------------------------------------------------------- no branch
  return (
    <Card className="p-7">
      <SectionLabel>No problem</SectionLabel>
      <h2 className="mt-2 text-[22px] leading-snug text-ink">What got in the way?</h2>
      <p className="mt-1.5 text-[15px] text-graphite">
        Optional — but it stops us sending you the same thing again.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {REASONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={reason === option.value}
            onClick={() => setReason(option.value)}
            className={`rounded-full border px-4 py-2.5 text-[15px] transition-colors ${
              reason === option.value
                ? "border-forest bg-forest text-white"
                : "border-rule bg-white text-graphite hover:border-[#CFC7B8]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <Button
          disabled={pending || reason === null}
          onClick={() => send({ didIt: "NO", reason, finish: true })}
        >
          {pending ? "Saving…" : "Done"}
        </Button>
        <Button variant="ghost" onClick={() => setDone(true)}>
          Skip
        </Button>
      </div>
    </Card>
  );
}
