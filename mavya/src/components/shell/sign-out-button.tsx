"use client";

import { Button } from "@/components/ui/button";
import { resetAnalytics } from "@/lib/analytics/client";

export function SignOutButton({ variant = "soft" }: { variant?: "soft" | "ghost" }) {
  return (
    <form action="/auth/sign-out" method="post" onSubmit={() => resetAnalytics()}>
      <Button type="submit" variant={variant}>
        Sign out
      </Button>
    </form>
  );
}
