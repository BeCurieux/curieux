// Finding an account.
//
// A search box that answers an email from a named person, and refuses to be
// a way of browsing the customer list — exact match only, and nothing at all
// until somebody types a whole address. lib/admin/accounts.ts argues the
// line between the account, which is here, and the archive, which is not.

import Link from "next/link";
import { redirect } from "next/navigation";
import { adminClient, currentUser } from "@/lib/supabase/server";
import { NOT_HERE, findByEmail } from "@/lib/admin/accounts";
import { countOf, fullDate } from "@/lib/words";

export const dynamic = "force-dynamic";

export default async function AccountsPage(
  props: {
    searchParams: Promise<{ email?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const user = await currentUser();
  if (!user) redirect("/login");

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/home");

  const asked = (searchParams.email ?? "").trim();
  const found = asked ? await findByEmail(admin, asked) : [];

  return (
    <div className="mx-auto !max-w-2xl py-10">
      <p className="text-xs uppercase tracking-[0.28em] text-clay">Support</p>
      <h1 className="mt-3 text-title">Find an account</h1>
      <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-stone">
        The whole email address, exactly. This answers questions about the
        account &mdash; what they pay, whether the card is failing, how much
        space they use. It does not open anybody&rsquo;s archive.
      </p>

      <form className="mt-8 flex flex-wrap gap-3">
        <input
          className="input flex-1"
          type="email"
          name="email"
          defaultValue={asked}
          placeholder="them@example.com"
          autoComplete="off"
        />
        <button className="btn">Look up</button>
      </form>

      {asked && found.length === 0 && (
        <p className="mt-8 rounded-2xl bg-card p-5 leading-relaxed">
          Nothing with that address. Worth checking it is the one they signed
          up with rather than the one they wrote from &mdash; those are often
          different, and there is deliberately no way to search for near
          matches.
        </p>
      )}

      {found.map((a) => (
        <section key={a.familyId} className="mt-8 rounded-2xl bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-display text-lg">{a.email}</p>
            <p className="text-xs text-stone">joined {fullDate(a.joined)}</p>
          </div>

          <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ["Paying", a.tier === "paid" ? `yes — ${a.plan}` : "no — free"],
              ["Membership", a.membershipState],
              ["Paid until", a.paidUntil ? fullDate(a.paidUntil) : "—"],
              ["Storage", a.storage],
              ["People", countOf(a.people, "person", "people")],
              ["Free cap", a.atFreeCap ? "reached — cannot add more" : "not reached"],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between gap-4 border-b border-rule py-1.5">
                <dt className="text-stone">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          {/* The archive is behind their permission, and this says which side
              of that line we are currently on. */}
          <p className="mt-5 text-sm leading-relaxed">
            {a.grantOpenUntil ? (
              <>
                They have given us access until {fullDate(a.grantOpenUntil)}.{" "}
                <Link href={`/admin/support/${a.familyId}`} className="text-ochre">
                  What&rsquo;s in the archive
                </Link>
              </>
            ) : (
              <span className="text-stone">
                No access to their archive. If a question genuinely needs it,
                ask them &mdash; it is one button in their settings and it
                expires on its own.
              </span>
            )}
          </p>
        </section>
      ))}

      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="text-lg">What this never shows</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-1 text-sm text-stone sm:grid-cols-2">
          {NOT_HERE.map((x) => (
            <li key={x} className="flex gap-2.5">
              <span className="text-clay">&mdash;</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/admin" className="text-ochre">Back to admin</Link>
      </p>
    </div>
  );
}
