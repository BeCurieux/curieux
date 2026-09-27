import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/site/AuthForm";
import { Logo } from "@/components/site/Chrome";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-lavender px-5 py-12">
      <Link href="/" aria-label="Home">
        <Logo />
      </Link>

      <div className="mt-8 w-full max-w-sm rounded-panel border border-rule bg-white p-7 shadow-soft">
        <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-slate">Pick up where you left off.</p>

        <div className="mt-6">
          <AuthForm mode="signin" />
        </div>

        {/* The way out of a locked account has to be on the screen that
            locked you out, not somewhere you have to go looking. */}
        <p className="mt-4 text-center text-sm">
          <Link href="/forgot" className="font-semibold text-purple">
            Forgotten your password?
          </Link>
        </p>
      </div>
    </div>
  );
}
