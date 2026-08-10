import Link from "next/link";
import { Logo } from "@/components/site/Chrome";
import { signOutAction } from "@/app/actions";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * Dashboard chrome (brief §28).
 *
 * "Avoid a giant SaaS sidebar unless required." It isn't required: there are
 * four places to go, so they fit in the header.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const registered = isRegistered(user);
  const plan = user ? PLANS[user.plan] : PLANS.free;

  return (
    <div className="min-h-screen bg-lavender">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>

          <nav className="ml-2 hidden items-center gap-1 sm:flex" aria-label="Dashboard">
            <Link href="/dashboard" className="btn-ghost">
              Widgets
            </Link>
            <Link href="/templates" className="btn-ghost">
              Templates
            </Link>
            <Link href="/dashboard/settings" className="btn-ghost">
              Settings
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {registered ? (
              <>
                <span className="hidden text-xs font-semibold text-muted md:inline">
                  {plan.name} · {user?.email}
                </span>
                <form action={signOutAction}>
                  <button type="submit" className="btn-ghost">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <span className="hidden text-xs font-medium text-muted sm:inline">
                  Not signed in — your work is saved to this browser.
                </span>
                <Link href="/signup" className="btn">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}
