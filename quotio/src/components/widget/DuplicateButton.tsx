"use client";

// "Duplicate this widget" (brief §22).
//
// The bottom of the growth loop and the sharpest part of it: someone who likes
// a widget they've just used gets a copy of it, in their own account, in one
// click — and because §27 lets them build without signing up, that click
// really is the whole journey.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon } from "@/components/ui/Icons";
import { duplicateWidget } from "@/app/actions";

export function DuplicateButton({ widgetId }: { widgetId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await duplicateWidget(widgetId);
          if (result.ok && result.widgetId) {
            router.push(`/dashboard/widgets/${result.widgetId}`);
            return;
          }
          setError(result.error ?? "That didn't work.");
          setBusy(false);
        }}
      >
        <CopyIcon size={16} />
        {busy ? "Copying…" : "Duplicate it"}
      </button>
      {error ? (
        <p className="mt-2 w-full text-xs font-medium text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
