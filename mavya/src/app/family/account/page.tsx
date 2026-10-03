import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetDemoButton } from "@/components/demo/reset-demo-button";
import { RemindersSwitch } from "@/components/family/reminders-switch";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { familyContext } from "@/lib/demo/context";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { viewer, demo, db } = await familyContext();
  const { data: me } = await db
    .from("users")
    .select("lesson_reminders")
    .eq("id", viewer.userId)
    .maybeSingle();

  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Account</h1>
      <dl className="flex flex-col divide-y divide-line rounded-lg bg-surface shadow-[0_1px_0_var(--border)]">
        <div className="px-5 py-4">
          <dt className="text-sm font-semibold text-muted">Name</dt>
          <dd className="text-lg font-semibold">{viewer.name}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-sm font-semibold text-muted">Email</dt>
          <dd className="text-lg font-semibold break-all">{viewer.email}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-sm font-semibold text-muted">Family</dt>
          <dd className="text-lg font-semibold">
            {viewer.families.map((f) => f.displayName).join(", ")}
          </dd>
        </div>
      </dl>
      <Link
        href="/family/fees"
        className="flex items-center justify-between gap-4 rounded-lg bg-surface px-5 py-4 text-lg font-semibold shadow-[0_1px_0_var(--border)] hover:bg-white/70"
      >
        Fees and payments
        <ArrowRight aria-hidden className="size-5 text-muted" />
      </Link>
      <section aria-label="Emails" className="rounded-lg bg-surface shadow-[0_1px_0_var(--border)]">
        <RemindersSwitch on={me?.lesson_reminders ?? true} />
      </section>
      <div className="flex flex-wrap gap-3">
        <SignOutButton />
        {demo ? <ResetDemoButton /> : null}
      </div>
    </div>
  );
}
