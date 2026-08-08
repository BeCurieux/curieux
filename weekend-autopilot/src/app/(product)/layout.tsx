import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/ui";
import { currentUser } from "@/lib/supabase/server";

/**
 * The signed-in shell.
 *
 * Mobile-first (§36): a bottom bar on a phone, because this is a product used
 * one-handed on a Thursday morning, and a quiet top bar on a desktop. Four
 * destinations, no more — the dashboard is meant to be almost empty.
 */
const NAV = [
  { href: "/app", label: "This weekend" },
  { href: "/app/history", label: "History" },
  { href: "/app/preferences", label: "Preferences" },
  { href: "/app/settings", label: "Settings" },
];

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/app");

  return (
    <div className="min-h-dvh bg-paper pb-20 sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-rule/70 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <BrandLogo href="/app" />
          <nav className="hidden items-center gap-6 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[15px] text-graphite hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>

      {/* Bottom bar, phones only. Sits above the home indicator. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="mx-auto flex max-w-3xl">
          {NAV.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="flex h-16 flex-col items-center justify-center gap-1 text-[12px] text-graphite"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
