"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";
import type { Shell } from "@/lib/auth/roles";

export function ShellViewTracker({ shell }: { shell: Shell }) {
  useEffect(() => {
    track("shell_viewed", { shell });
  }, [shell]);
  return null;
}
