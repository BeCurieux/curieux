import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireShell } from "@/lib/auth/viewer";
import { planState } from "@/lib/domain/plan";
import { createClient } from "@/lib/supabase/server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const viewer = await requireShell("business");
  const owned = viewer.staff.find((s) => s.role === "owner");
  // Ovyko's plan (docs/SUBSCRIPTIONS.md): a reminder, never a lock.
  const plan = owned ? await planState(await createClient(), owned.organisationId) : null;
  return (
    <AppShell shell="business" shells={viewer.shells}>
      {plan === "none" || plan === "attention" ? (
        <Link
          href="/business/settings/plan"
          role="status"
          className="mb-6 block rounded-md bg-[#fff4d6] px-4 py-3 font-semibold text-[#6b4b00]"
        >
          {plan === "none"
            ? "Your free trial has ended. Set up your Ovyko plan to keep going."
            : "Your last Ovyko payment didn't go through. Update your payment details."}
        </Link>
      ) : null}
      {children}
    </AppShell>
  );
}
