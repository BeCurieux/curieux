"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { createFromTemplate } from "@/app/actions";

/**
 * "Use this template" (brief §24).
 *
 * No signup in the way — §27 means this lands the person straight in the
 * builder with their own editable copy.
 */
export function UseTemplateButton({ slug, label = "Use this template" }: { slug: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="btn btn-lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await createFromTemplate(slug);
          if (result.ok && result.widgetId) {
            router.push(`/dashboard/widgets/${result.widgetId}`);
            return;
          }
          setError(result.error ?? "That didn't work.");
          setBusy(false);
        }}
      >
        {busy ? "Setting it up…" : label}
        <ArrowRightIcon size={18} />
      </button>

      {error ? (
        <p className="mt-2 text-sm font-medium text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
