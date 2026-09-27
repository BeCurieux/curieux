import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/site/AuthForm";
import { Logo } from "@/components/site/Chrome";
import { Illustration } from "@/components/illustrations/Illustration";
import { currentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";

export const metadata: Metadata = { title: "Create an account" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  // If they built something anonymously, say so — it's the reason to finish.
  const user = await currentUser();
  const pending = user && !user.email ? await getStore().countWidgets(user.id) : 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-lavender px-5 py-12">
      <Link href="/" aria-label="Home">
        <Logo />
      </Link>

      <div className="mt-8 w-full max-w-sm rounded-panel border border-rule bg-white p-7 shadow-soft">
        <h1 className="text-xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate">
          {pending > 0
            ? `Your ${pending} widget${pending === 1 ? "" : "s"} will come with you — nothing is lost.`
            : "Free to start. No card, no trial countdown."}
        </p>

        <div className="mt-6">
          <AuthForm mode="signup" />
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3 text-xs text-muted">
        <Illustration name="sparkle" size={26} />
        You can build a widget without an account. We only ask when you publish.
      </div>
    </div>
  );
}
