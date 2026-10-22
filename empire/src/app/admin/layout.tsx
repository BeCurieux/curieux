import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { isAdminEmail } from "@/env";
import { Wordmark } from "@/components/shell/wordmark";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="no-print border-line bg-paper border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Wordmark href="/studio" />
          <nav aria-label="Account" className="flex items-center gap-1 text-sm sm:gap-3">
            {isAdminEmail(user.email) ? (
              <Link href="/admin" className="hover:text-oxblood px-2 py-2 font-medium">
                Founder
              </Link>
            ) : null}
            <Link href="/account" className="hover:text-oxblood px-2 py-2 font-medium">
              Account
            </Link>
            <form action="/auth/sign-out" method="post">
              <button className="text-ink-soft hover:text-oxblood px-2 py-2 font-medium">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
