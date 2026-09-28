"use client";

import { useEffect } from "react";
import { startAnalytics } from "@/lib/analytics/client";

export function AnalyticsProvider() {
  useEffect(() => {
    startAnalytics();
  }, []);
  return null;
}
