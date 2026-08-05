import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Ordinary Tuesday — You live it. We help you keep it.",
  description:
    "The year is already in your camera roll. We turn it into one beautiful hardcover book of their year.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const signedIn = !!user;

  return (
    <html lang="en">
      <body>
        {/* On the landing page the wordmark sits inside the dark hero, so the
            header goes transparent and lets it through. */}
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link
            href={signedIn ? "/home" : "/"}
            className="text-sm uppercase tracking-[0.3em]"
          >
            Ordinary Tuesday
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            {signedIn ? (
              <>
                <Link href="/home" className="hover:text-boot">Home</Link>
                <Link href="/account" className="hover:text-boot">Account</Link>
                <form action={signOut}>
                  <button className="text-stone hover:text-boot">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-boot">Log in</Link>
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
