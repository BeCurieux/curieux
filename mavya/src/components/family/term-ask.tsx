"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Answer, FamilyAsk } from "@/lib/domain/terms";
import { answerTermAsk } from "@/lib/family/actions";
import { dayName, formatTime } from "@/lib/format";

const when = (c: FamilyAsk["current"]) =>
  `${dayName(c.weekday)} ${formatTime(c.start)}${c.location ? ` · ${c.location}` : ""}`;

const ANSWERED: Record<Answer, (a: FamilyAsk) => string> = {
  stay: (a) => `Keeping ${a.current.name}`,
  move: (a) => `Moving to ${a.offered?.name ?? "the new class"}`,
  leave: () => "Not coming back",
};

// One child's place next term: stay, leave, or move up if offered. The
// answer can be changed until the term starts.
export function TermAskCard({ ask, replyBy }: { ask: FamilyAsk; replyBy: string | null }) {
  const [answer, setAnswer] = useState<Answer | null>(ask.answer);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const choose = (next: Answer) =>
    start(async () => {
      setError(null);
      const result = await answerTermAsk(ask.id, next);
      if (result.error) setError(result.error);
      else setAnswer(next);
    });

  const options: { value: Answer; label: string }[] = ask.offered
    ? [
        { value: "move", label: `Move up to ${ask.offered.name}` },
        { value: "stay", label: `Stay in ${ask.current.name}` },
        { value: "leave", label: "Not next term" },
      ]
    : [
        { value: "stay", label: "Yes, keep it" },
        { value: "leave", label: "Not next term" },
      ];

  return (
    <article
      aria-label={`${ask.childFirstName}, ${ask.term}`}
      className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-[0_1px_0_var(--border)]"
    >
      <div>
        <p className="text-sm font-semibold text-muted">
          {ask.school} · {ask.term}
        </p>
        <h3 className="text-lg leading-snug font-semibold">
          {ask.offered
            ? `${ask.childFirstName} is ready to move up`
            : `Keep ${ask.childFirstName}'s place?`}
        </h3>
        <p className="text-muted">
          {ask.current.name} · {when(ask.current)}
        </p>
        {ask.offered ? (
          <p className="mt-1">
            <span className="font-semibold">Offered:</span> {ask.offered.name} · {when(ask.offered)}
          </p>
        ) : null}
      </div>
      {answer ? (
        <p
          role="status"
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#dcf1e7] px-4 py-2 font-semibold text-[#23694c]"
        >
          <Check aria-hidden className="size-4" strokeWidth={3} />
          {ANSWERED[answer](ask)}
        </p>
      ) : replyBy ? (
        <p className="text-sm text-muted">Please answer by {replyBy}.</p>
      ) : null}
      {error ? (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {options.map((o, i) => (
          <Button
            key={o.value}
            type="button"
            variant={i === 0 && !answer ? "warm" : "soft"}
            aria-pressed={answer === o.value}
            disabled={pending}
            onClick={() => choose(o.value)}
            className="aria-pressed:ring-2 aria-pressed:ring-ink"
          >
            {o.label}
          </Button>
        ))}
      </div>
      {answer ? (
        <p className="text-sm text-muted">You can change this until the term starts.</p>
      ) : null}
    </article>
  );
}
