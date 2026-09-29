"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/lib/family/actions";

// Opening Messages marks new notifications seen, after the page has shown
// them as new. Done from the browser so a link prefetch can never count as
// reading them.
export function MarkRead() {
  useEffect(() => {
    void markNotificationsRead();
  }, []);
  return null;
}
