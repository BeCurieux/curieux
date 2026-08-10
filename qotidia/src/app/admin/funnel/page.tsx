// Whether the product is working.
//
// Six steps and one number. The chart exists so that the events are read
// rather than merely collected — a table nobody looks at is a table that
// should not have been written, and it is the exact shape of "we collect it
// just in case" that this product tells families it does not do.
//
// Counted as distinct people per step, not as events. A funnel drawn from
// raw event counts says a family who uploaded four times is four families,
// and every step below the first looks better than it is.
//
// There is nothing here about any particular family, because there is
// nothing in the table about any particular family. lib/analytics/events.ts
// argues why, and the last section of this page states it on screen so that
// whoever reads this chart is reminded what it is not.

import Link from "next/link";
import { redirect } from "next/navigation";
import { adminClient, currentUser } from "@/lib/supabase/server";
import { tally } from "@/lib/analytics/record";
import {
  FUNNEL, KEEP_FOR_DAYS, NEVER_RECORDED, NORTH_STAR, WINDOW_DAYS,
} from "@/lib/analytics/events";
import { countOf } from "@/lib/words";

export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90] as const;

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/home");

  const days = PERIODS.includes(Number(searchParams.days) as any)
    ? Number(searchParams.days)
    : 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const counts = await tally(admin, since);

  const top = counts[FUNNEL[0].step] ?? 0;
  const northStar = counts[NORTH_STAR] ?? 0;

  return (
    <div className="mx-auto !max-w-2xl py-10">
      <p className="text-xs uppercase tracking-[0.28em] text-clay">Last {countOf(days, "day")}</p>
      <h1 className="mt-3 text-title">Is it working</h1>

      <p className="mt-4 text-sm">
        {PERIODS.map((d, i) => (
          <span key={d}>
            {i > 0 && " · "}
            <Link
              href={`/admin/funnel?days=${d}`}
              className={d === days ? "text-ink" : "text-ochre"}
            >
              {d} days
            </Link>
          </span>
        ))}
      </p>

      {/* The north star, alone and first. Not signups and not revenue: a
          family who has sent a story has received the thing this product is
          for and shown it to somebody who might want their own. It is the
          one number that is both the value delivered and the growth loop. */}
      <section className="mt-10 rounded-2xl bg-card p-8">
        <div className="font-display text-5xl">{northStar}</div>
        <p className="mt-2 text-sm">families sent a story to somebody</p>
        <p className="mt-3 max-w-[46ch] text-xs leading-relaxed text-stone">
          The north star. Everything above it in the funnel is how somebody
          gets here, and everything below is what follows from having got
          here.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg">The funnel</h2>
        <ul className="mt-5 space-y-3">
          {FUNNEL.map((s) => {
            const n = counts[s.step] ?? 0;
            const share = top === 0 ? 0 : n / top;
            return (
              <li key={s.step}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span>{s.as}</span>
                  <span className="tabular-nums text-stone">
                    {n}
                    {top > 0 && s.step !== FUNNEL[0].step && (
                      <span className="ml-2 text-xs">{Math.round(share * 100)}%</span>
                    )}
                  </span>
                </div>
                {/* A bar rather than a chart library. The shape of a funnel
                    is the only thing being read here and it needs no axes. */}
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-rule">
                  <div
                    className="h-full rounded-full bg-clay"
                    style={{ width: `${Math.max(share * 100, n > 0 ? 1.5 : 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 max-w-[52ch] text-xs leading-relaxed text-stone">
          Distinct people per step, not events &mdash; counting events would
          make a family who uploaded four times look like four families, and
          every step below the first would look better than it is.
        </p>
      </section>

      {/* Everything not on the funnel, so that a bad number cannot be hidden
          by only charting the good ones. archive_deleted is here on purpose. */}
      <section className="mt-10">
        <h2 className="text-lg">Everything else</h2>
        <ul className="mt-4 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
          {Object.entries(counts)
            .filter(([name]) => !FUNNEL.some((f) => f.step === name))
            .sort((a, b) => b[1] - a[1])
            .map(([name, n]) => (
              <li key={name} className="flex justify-between gap-4 border-b border-rule py-1.5">
                <span className="text-stone">{name.replace(/_/g, " ")}</span>
                <span className="tabular-nums">{n}</span>
              </li>
            ))}
          {Object.keys(counts).length === 0 && (
            <li className="text-stone">Nothing yet in this period.</li>
          )}
        </ul>
      </section>

      {/* What this chart is not. On the page, where somebody reading numbers
          about families is reminded what those numbers cannot do. */}
      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="text-lg">What isn&rsquo;t in this</h2>
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-stone">
          Not redacted &mdash; absent. There is nowhere in the table to put
          any of it:
        </p>
        <ul className="mt-3 grid gap-x-8 gap-y-1 text-sm text-stone sm:grid-cols-2">
          {NEVER_RECORDED.map((x) => (
            <li key={x} className="flex gap-2.5">
              <span className="text-clay">&mdash;</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-[52ch] text-xs leading-relaxed text-stone">
          People are counted through a token that changes every{" "}
          {countOf(WINDOW_DAYS, "day")}, so nobody can be followed from one
          window to the next &mdash; including us. Everything here is deleted
          after {countOf(KEEP_FOR_DAYS, "day")}, by the daily sweep.
        </p>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/admin" className="text-ochre">Back to admin</Link>
      </p>
    </div>
  );
}
