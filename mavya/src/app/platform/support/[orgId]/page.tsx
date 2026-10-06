import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Wordmark } from "@/components/shell/wordmark";
import { ownerTwoStepNeeded, requireViewer } from "@/lib/auth/viewer";
import { formatMoney } from "@/lib/domain/accounts";
import { amPlatformAdmin } from "@/lib/domain/platform";
import { supportSchoolView } from "@/lib/domain/support";
import { dayName, formatDateTime, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Support view" };

// How a school that let support in is set up (docs/M6_MIGRATION_PILOT.md,
// M6g). Read only; no child, parent or family is named; opening this page
// is recorded and shown to the school's owners.
export default async function SupportViewPage({ params }: { params: Promise<{ orgId: string }> }) {
  await requireViewer();
  if (await ownerTwoStepNeeded()) redirect("/two-step");
  const db = await createClient();
  if (!(await amPlatformAdmin(db))) notFound();
  const { orgId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(orgId)) notFound();
  const v = await supportSchoolView(db, orgId);
  if (!v) notFound();

  const yes = (b: boolean) => (b ? "on" : "off");
  const facts: [string, string][] = [
    ["Activity", v.school.activity_type],
    ["Time zone", v.school.timezone],
    ["Joined Ovyko", formatDateTime(v.school.created_at)],
    ["Demo school", v.school.is_demo ? "yes" : "no"],
    ["Owners need two-step sign-in", yes(v.school.owner_two_step_required)],
    ["Lessons only in terms", yes(v.school.lessons_in_term_only)],
    ["Fee reminders", yes(v.school.fee_reminders)],
    ["Instalments", yes(v.school.instalments_on)],
    ["Vouchers taken", v.school.voucher_schemes.join(", ") || "none"],
    [
      "Staff",
      Object.entries(v.staff)
        .map(([role, n]) => `${n} ${role}${n === 1 ? "" : "s"}`)
        .join(", ") || "none",
    ],
    [
      "Families",
      `${v.families.count}, ${v.families.joined} joined; ${v.families.children_enrolled} children enrolled`,
    ],
    [
      "Payments",
      !v.payments
        ? "not set up"
        : `${v.payments.charges_enabled ? "taking payments" : "not taking payments"}, payouts ${yes(v.payments.payouts_enabled)}`,
    ],
    [
      "Ovyko plan",
      v.plan?.status
        ? `${v.plan.status}, ${v.plan.locations ?? "?"} location(s)${v.plan.cancel_at_period_end ? ", ending" : ""}`
        : `no plan; trial ends ${formatDateTime(v.trial_ends)}`,
    ],
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <Wordmark />
      <Link href="/platform" className="w-fit font-semibold underline underline-offset-4">
        Ovyko totals
      </Link>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{v.school.name}</h1>
        <p className="mt-1 text-muted">
          Support view, read only. The school sees that you looked.
          {v.grant ? ` Open until ${formatDateTime(v.grant.expires_at)}.` : ""}
        </p>
        {v.grant?.note ? (
          <p className="mt-3 rounded-md bg-surface-soft px-4 py-3">“{v.grant.note}”</p>
        ) : null}
      </div>

      <Section title="The school">
        {facts.map(([k, val]) => (
          <Row key={k} label={k} value={val} />
        ))}
      </Section>

      <Section title="Locations">
        {v.locations.map((l) => (
          <Row
            key={l.name}
            label={l.name}
            value={`${l.suburb ?? ""} ${l.timezone}${l.active ? "" : " (archived)"}`}
          />
        ))}
      </Section>

      <Section title="Programs and levels">
        {v.levels.map((l) => (
          <Row
            key={`${l.program}-${l.level}`}
            label={`${l.program}: ${l.level}`}
            value={l.active ? "" : "archived"}
          />
        ))}
      </Section>

      <Section title="Classes">
        {v.classes.map((c, k) => (
          <Row
            key={k}
            label={`${dayName(c.weekday)} ${formatTime(c.start_time)} · ${c.name}`}
            value={`${c.location} · ${c.level} · ${c.enrolled}/${c.capacity}${
              c.has_instructor ? "" : " · no instructor"
            }${c.price_per_lesson_cents == null ? " · no price" : ` · ${formatMoney(c.price_per_lesson_cents)}`}${
              c.active ? "" : " · archived"
            }`}
          />
        ))}
      </Section>

      <Section title="Terms">
        {v.terms.map((t) => (
          <Row
            key={t.name}
            label={t.name}
            value={`${t.starts_on} to ${t.ends_on}${t.asked ? " · families asked" : ""}${
              t.applied ? " · applied" : ""
            }`}
          />
        ))}
      </Section>

      <Section title="Recent imports">
        {v.imports.map((b) => (
          <Row
            key={b.created_at}
            label={formatDateTime(b.created_at)}
            value={`${Object.entries(b.counts)
              .map(([k, n]) => `${k} ${JSON.stringify(n)}`)
              .join(", ")} · ${b.problems} problems${b.undone ? " · undone" : ""}`}
          />
        ))}
      </Section>

      <Section title="Emails, last 7 days">
        {v.emails_7d.map((e) => (
          <Row key={`${e.kind}-${e.status}`} label={e.kind} value={`${e.count} ${e.status}`} />
        ))}
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {children.length === 0 ? (
        <p className="text-muted">None.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {children}
        </ul>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-5 py-3">
      <span className="font-semibold">{label}</span>
      <span className="text-right text-muted">{value}</span>
    </li>
  );
}
