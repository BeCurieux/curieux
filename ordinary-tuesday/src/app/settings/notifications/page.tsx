// What we may write to you about.
//
// Reachable two ways: signed in, or from the token in an email footer — so
// someone can stop the mail without hunting for a password. Transactional
// mail is listed but not switchable, because turning off "your book has
// shipped" would be a worse product, and pretending otherwise would be a lie.

import { redirect } from "next/navigation";
import { adminClient, currentUser, userClient } from "@/lib/supabase/server";
import { updateNotificationPreferences } from "@/app/actions";

export const dynamic = "force-dynamic";

const OPTIONAL = [
  {
    key: "contributions_waiting",
    title: "When your family adds something",
    blurb:
      "At most once a day, however much they add. Without it, things sit waiting and you would never know.",
  },
  {
    key: "year_closing",
    title: "Three weeks before their birthday",
    blurb:
      "Once a year. The year is about to close and be made into a book — the last moment to write down anything you have been meaning to.",
  },
] as const;

const ALWAYS = [
  "Your book is ready to read",
  "Your order is going to print",
  "Your book is on its way",
  "Someone has invited you to an archive",
];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { t?: string; saved?: string };
}) {
  const user = await currentUser();

  // The token from an email footer identifies the person without a login.
  let prefs: any = null;
  if (searchParams.t) {
    const { data } = await adminClient()
      .from("email_preferences")
      .select("*")
      .eq("opt_out_token", searchParams.t)
      .maybeSingle();
    prefs = data;
  } else if (user) {
    const { data } = await userClient()
      .from("email_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    prefs = data;
  } else {
    redirect("/login");
  }

  const value = (key: string) => (prefs ? prefs[key] !== false : true);

  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-3xl">What we write to you about</h1>
      <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-stone">
        We would rather send you four emails a year that you are glad of than
        forty you delete. Nothing we send ever contains a photograph or
        anything your family has written &mdash; those stay behind your login.
      </p>

      {searchParams.saved && (
        <p className="mt-4 rounded-lg bg-card p-3 text-sm text-stone">Saved.</p>
      )}

      <form action={updateNotificationPreferences} className="card mt-8 space-y-5">
        <input type="hidden" name="token" value={searchParams.t ?? ""} />
        {OPTIONAL.map((o) => (
          <label key={o.key} className="flex gap-3">
            <input
              type="checkbox"
              name={o.key}
              defaultChecked={value(o.key)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm">{o.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-stone">{o.blurb}</span>
            </span>
          </label>
        ))}
        <button className="btn w-full">Save</button>
      </form>

      <section className="mt-10">
        <h2 className="text-lg">Always sent</h2>
        <p className="mt-1 text-sm leading-relaxed text-stone">
          These concern something you asked us to do, so they cannot be
          switched off.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-stone">
          {ALWAYS.map((a) => (
            <li key={a} className="flex gap-2">
              <span className="text-ochre">&mdash;</span>
              {a}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
