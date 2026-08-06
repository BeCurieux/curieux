import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { charter } from "./fonts";
import { currentUser } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND} — You live it. We help you keep it.`,
  description:
    "The year is already in your camera roll. We turn it into one beautiful hardcover book of their year.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const signedIn = !!user;

  return (
    <html lang="en" className={charter.variable}>
      <body>
        {/* On the landing page the wordmark sits inside the dark hero, so the
            header goes transparent and lets it through. */}
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link
            href={signedIn ? "/home" : "/"}
            className="font-display text-xl lowercase tracking-tight"
          >
            {BRAND}
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            {signedIn ? (
              <>
                <Link href="/home" className="hover:text-ochre">Home</Link>
                <Link href="/account" className="hover:text-ochre">Account</Link>
                <form action={signOut}>
                  <button className="text-stone hover:text-ochre">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-ochre">Log in</Link>
                <Link href="/signup" className="btn !px-5 !py-2">Make their year</Link>
              </>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 pb-24">{children}</main>
      </body>
    </html>
  );
}
