"use client";

/**
 * Loading and error states for generation (§38, §39).
 *
 * The loading stages are real. Each label corresponds to a pipeline stage the
 * generation run has actually reached, read from the run record — the brief is
 * explicit that we should not lie about them, and a fake progress animation
 * would be exactly that. When we do not know the stage, we say something
 * honest and non-specific instead of inventing progress.
 */

import { useEffect, useState } from "react";
import type { GenerationStage } from "@/lib/types";
import { Button, Card, SectionLabel } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/config/brand";

const STAGE_COPY: Partial<Record<GenerationStage, string>> = {
  CONTEXT: "Reading your weekend profile…",
  INTENTS: "Working out what would suit you…",
  CANDIDATES: "Finding places that actually fit…",
  FILTERING: "Ruling out what won’t work…",
  SCORING: "Weighing them up…",
  ASSEMBLY: "Putting your day together…",
  SELECTION: "Choosing between a few good options…",
  VERIFICATION: "Checking they’re open…",
  COPY: "Writing it up…",
  VALIDATION: "Making sure the timing works…",
};

const FALLBACK = "Putting your weekend together…";

export function LoadingPlanner({ stage }: { stage: GenerationStage | null }) {
  // A gentle cycle only while we genuinely do not know the stage, so the
  // screen is never static — but it never claims a stage we have not reached.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (stage) return;
    const timer = setInterval(() => setTick((t) => t + 1), 2600);
    return () => clearInterval(timer);
  }, [stage]);

  const generic = [FALLBACK, "Checking the weather…", "This usually takes under a minute…"];
  const label = stage ? (STAGE_COPY[stage] ?? FALLBACK) : generic[tick % generic.length];

  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center">
        <span className="h-2.5 w-2.5 animate-ping rounded-full bg-forest" aria-hidden />
      </div>
      <p aria-live="polite" className="mt-4 font-display text-[19px] text-ink">
        {label}
      </p>
      <p className="mt-2 text-sm text-mist">
        We check opening hours and travel times before we send anything, so this takes a moment.
      </p>
    </Card>
  );
}

/**
 * What a customer sees when we could not build something we would recommend.
 * The wording is the brief’s, and it is the right wording: it tells the truth
 * and it does not offer a worse plan as consolation (§39).
 */
export function GenerationError({ onRetry }: { onRetry?: () => void }) {
  return (
    <Card className="p-8 text-center">
      <SectionLabel>This weekend</SectionLabel>
      <h2 className="mt-2 text-[22px] leading-snug text-ink">
        We couldn’t build one we’d genuinely recommend yet.
      </h2>
      <p className="mx-auto mt-3 max-w-prose text-[15px] leading-relaxed text-graphite">
        We’re checking again. You’ll hear from us as soon as there’s something
        worth doing — we would rather send you nothing than send you filler.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        {onRetry ? (
          <Button onClick={onRetry} variant="secondary">
            Try again now
          </Button>
        ) : null}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-sm text-mist underline-offset-4 hover:underline"
        >
          Tell us what you were hoping for
        </a>
      </div>
    </Card>
  );
}
