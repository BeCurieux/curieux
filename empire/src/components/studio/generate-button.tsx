"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { generateAction } from "@/app/studio/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";

const WAITING = [
  "Reading everything you told us…",
  "Matching it to your brand voice…",
  "Leaving out anything we can't back up…",
  "Checking the facts against your facts…",
  "Nearly there. Good things, small waits.",
];

export function GenerateButton({
  profileId,
  module,
  productId = null,
  label = "Generate",
  disabledReason,
}: {
  profileId: string;
  module: string;
  productId?: string | null;
  label?: string;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setTick((t) => t + 1), 2500);
    return () => clearInterval(timer);
  }, [pending]);

  const run = () => {
    setError(null);
    setTick(0);
    startTransition(async () => {
      const result = await generateAction({ profileId, module, productId });
      if (!result.ok) setError(result.message ?? "That didn't work. Try again.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Button type="button" onClick={run} disabled={pending || Boolean(disabledReason)}>
        {pending ? "Writing…" : label}
      </Button>
      <p aria-live="polite" className="text-mute text-sm">
        {pending ? WAITING[tick % WAITING.length] : (disabledReason ?? "")}
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
