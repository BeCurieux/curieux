"use client";

import { useState } from "react";
import { sendEvent } from "@/components/beacon";
import { buttonClass, type Variant } from "@/components/ui/button";

// Copies text and says so, for sighted and screen-reader users alike.
export function CopyButton({
  text,
  label = "Copy",
  event,
  variant = "quiet",
}: {
  text: string;
  label?: string;
  event?: Record<string, string>;
  variant?: Variant;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      sendEvent("asset_copied", event ?? {});
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  };
  return (
    <button type="button" onClick={copy} className={buttonClass(variant, variant === "quiet" ? "min-h-9 text-sm" : "")}>
      <span aria-live="polite">{state === "copied" ? "Copied ✓" : state === "failed" ? "Select and copy" : label}</span>
    </button>
  );
}
