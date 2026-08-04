import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Keeper — You live it. We help you keep it.",
  description:
    "Turn the moments buried in your camera roll — and the little things you'd otherwise forget — into a beautiful book of their year.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href={user ? "/home" : "/"} className="font-display text-xl tracking-tight">
            Keeper
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <Link href="/home" className="hover:text-clay">Home</Link>
                <Link href="/account" className="hover:text-clay">Account</Link>
                <form action={signOut}>
                  <button className="text-ink/60 hover:text-clay">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-clay">Log in</Link>
                <Link href="/signup" className="btn !py-2">Make their year</Link>
              </>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 pb-24">{children}</main>
      </body>
    </html>
  );
}
