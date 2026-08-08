import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/ui";
import { flags } from "@/config/flags";

/**
 * Admin (§42).
 *
 * Role-protected at the layout, so every page underneath inherits the check
 * rather than each remembering to make it. The role lives on the profile row
 * and cannot be self-granted — the RLS update policy on `profiles` re-reads
 * the stored value, so a customer cannot promote themselves.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin");
  if (!(await isAdmin())) redirect("/app");

  const reviewOn = flags().requirePlanReview;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <BrandLogo href="/admin" />
            <span className="text-[13px] uppercase tracking-[0.14em] text-mist">Admin</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/admin" className="text-[15px] text-graphite hover:text-ink">
              Dashboard
            </Link>
            <Link href="/admin/queue" className="text-[15px] text-graphite hover:text-ink">
              Plan queue
            </Link>
            <span
              className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                reviewOn ? "bg-clayWash text-clay" : "bg-sage text-forest"
              }`}
              title="REQUIRE_PLAN_REVIEW"
            >
              {reviewOn ? "Review on" : "Autonomous"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
