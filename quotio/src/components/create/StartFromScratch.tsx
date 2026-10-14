"use client";

// The three starting points from §29.
//
// Each one creates a small, complete, working widget rather than an empty
// canvas — see src/lib/widget/defaults.ts for why.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Illustration } from "@/components/illustrations/Illustration";
import { createBlank } from "@/app/actions";
import { START_POINTS } from "@/lib/widget/defaults";
import type { IllustrationKey } from "@/lib/widget/illustrations";

const ART: Record<string, IllustrationKey> = {
  calculator: "chart",
  estimator: "coins",
  quiz: "question",
};

export function StartFromScratch() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {START_POINTS.map((point) => (
          <button
            key={point.type}
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(point.type);
              setError(null);
              const result = await createBlank(point.type);
              if (result.ok && result.widgetId) {
                router.push(`/dashboard/widgets/${result.widgetId}`);
                return;
              }
              setError(result.error ?? "That didn't work.");
              setBusy(null);
            }}
            className="card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-60"
          >
            <Illustration name={ART[point.type]} size={40} />
            <p className="mt-3 text-sm font-bold">
              {busy === point.type ? "Creating…" : point.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate">{point.blurb}</p>
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-center text-sm font-medium text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
