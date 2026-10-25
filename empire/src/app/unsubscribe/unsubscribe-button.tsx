"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { unsubscribe } from "./actions";

export function UnsubscribeButton({ token }: { token: string }) {
  const [result, setResult] = useState<"idle" | "done" | "unknown">("idle");
  const [pending, start] = useTransition();
  if (result === "done")
    return (
      <Notice tone="success" title="Done">
        You&apos;re unsubscribed. You won&apos;t get any more emails from us.
      </Notice>
    );
  if (result === "unknown")
    return (
      <Notice tone="info" title="Already off the list">
        We couldn&apos;t find an active sign-up for this link, so you won&apos;t get emails from us.
        Still hearing from us? Write to hello@herlittleempire.com.
      </Notice>
    );
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => setResult((await unsubscribe(token)).done ? "done" : "unknown"))
      }
    >
      {pending ? "One moment…" : "Unsubscribe"}
    </Button>
  );
}
