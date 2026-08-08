"use client";

import { useEffect, useRef } from "react";
import { markOpened } from "@/app/(product)/actions";
import type { PlanStatus } from "@/lib/types";

/**
 * Records that a plan was opened (§28, §45).
 *
 * Plan open rate is one of the ten metrics that matter, and it is the earliest
 * signal that a Thursday email landed well. Fire-and-forget, once per mount,
 * and only for a plan that has actually been delivered.
 */
export function MarkOpened({ planId, status }: { planId: string; status: PlanStatus }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (status !== "DELIVERED" && status !== "READY") return;
    fired.current = true;
    void markOpened(planId);
  }, [planId, status]);

  return null;
}
