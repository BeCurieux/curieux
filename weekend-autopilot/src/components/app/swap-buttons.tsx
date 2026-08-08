"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestSwap } from "@/app/(product)/actions";
import { Button } from "@/components/ui";

/**
 * "Swap this plan" (§25).
 *
 * Four fixed buttons and no text box. A chat interface here would look
 * generous and be a regression: the product is selling the absence of a
 * conversation about your Saturday. Each button is also a clean preference
 * signal, which free text is not.
 */
const OPTIONS = [
  { value: "MAKE_IT_EASIER", label: "Make it easier" },
  { value: "SPEND_LESS", label: "Spend less" },
  { value: "STAY_CLOSER", label: "Stay closer" },
  { value: "MORE_ACTIVE", label: "More active" },
  { value: "SURPRISE_ME", label: "Surprise me" },
] as const;

export function SwapButtons({ planId }: { planId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function swap(reason: string) {
    setChosen(reason);
    startTransition(async () => {
      const result = await requestSwap({ planId, reason });
      setMessage(result.ok ? (result.message ?? "On it.") : (result.error ?? "Couldn’t do that"));
      if (result.ok) router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => swap(option.value)}
          >
            {pending && chosen === option.value ? "Working…" : option.label}
          </Button>
        ))}
      </div>
      {message ? (
        <p aria-live="polite" className="mt-3 text-[14px] text-forest">
          {message}
        </p>
      ) : null}
    </div>
  );
}
