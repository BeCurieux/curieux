import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { isAdminEmail } from "@/env";
import { Wordmark } from "@/components/shell/wordmark";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="no-print border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Wordmark href="/studio" />
          <nav aria-label="Account" className="flex items-center gap-1 text-sm sm:gap-3">
            {isAdminEmail(user.email) ? (
              <Link href="/admin" className="px-2 py-2 font-medium hover:text-oxblood">Founder</Link>
            ) : null}
            <Link href="/account" className="px-2 py-2 font-medium hover:text-oxblood">Account</Link>
            <form action="/auth/sign-out" method="post">
              <button className="px-2 py-2 font-medium text-ink-soft hover:text-oxblood">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
