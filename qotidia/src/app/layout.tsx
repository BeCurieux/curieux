import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { charter } from "./fonts";
import { currentUser } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { BRAND, ONE_LINER, TAGLINE } from "@/lib/brand";
import { PRICING } from "@/lib/nav";

export const metadata: Metadata = {
  title: `${BRAND} — ${TAGLINE}`,
  // The one-liner leads with what the product does all year, not with the
  // book. The book is the last clause for the same reason it is the last
  // step: it is what a year of noticing produces, not the thing itself.
  description: ONE_LINER,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const signedIn = !!user;

  return (
    <html lang="en" className={charter.variable}>
      <body>
        {/* Unusually small on purpose. Features / Solutions / Resources /
            About is what makes a site feel like software, and this one is
            meant to feel like a publishing house. Three destinations and a
            way in — pricing is reached through the CTA flow and the foot of
            the homepage rather than announced in the bar. */}
        <header className="mx-auto flex max-w-page items-center justify-between px-[5vw] py-7">
          <Link
            href={signedIn ? "/home" : "/"}
            className="font-display text-xl lowercase tracking-tight"
          >
            {BRAND}
          </Link>
          <nav className="flex items-center gap-7 text-sm">
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
                <Link href="/#how" className="hidden hover:text-ochre sm:inline">How it works</Link>
                <Link href="/pricing" className="hidden hover:text-ochre sm:inline">The book</Link>
                <Link href="/privacy" className="hidden hover:text-ochre sm:inline">Privacy</Link>
                <Link href="/login" className="text-stone hover:text-ochre">Sign in</Link>
                <Link href="/signup" className="btn !px-5 !py-2">Start your year</Link>
              </>
            )}
          </nav>
        </header>
        {/* The homepage manages its own width, section by section. Every
            other page still wants a reading column. */}
        <main className="[&>*:not(.grain)]:mx-auto [&>*:not(.grain)]:max-w-5xl [&>*:not(.grain)]:px-6 [&>*:not(.grain)]:pb-24">
          {children}
        </main>
      </body>
    </html>
  );
}
