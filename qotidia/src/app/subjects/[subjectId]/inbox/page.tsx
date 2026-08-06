// The Memory Inbox.
//
// Most visits to this page should find nothing here, and the empty state is
// written to make that feel like the product working rather than the product
// being broken. Everything shared, mailed or typed in is already kept — this
// is only the handful of things the archive genuinely could not work out.
//
// The rest of the page is the two doors themselves, because an inbox nobody
// knows how to send to is a screen about a feature rather than the feature.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient, adminClient } from "@/lib/supabase/server";
import { roleForSubject } from "@/lib/family/membership";
import { canEdit } from "@/lib/family/roles";
import { addressFor, newToken } from "@/lib/inbox/address";
import { fileArrivalAction, moveArrival, rotateInboxAddress, setInboxOpenness } from "@/app/actions";
import { friendlyDate } from "@/lib/words";

export const dynamic = "force-dynamic";

export default async function InboxPage({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: child } = await db
    .from("subjects")
    .select("id, display_name, family_id")
    .eq("id", params.subjectId)
    .single();
  if (!child) redirect("/home");

  const first = child.display_name?.split(" ")[0] ?? child.display_name;
  const role = (await roleForSubject(db, child.id, user.id))?.role ?? null;
  const editor = canEdit(role);

  // The address is created on first sight rather than at signup, so a family
  // that never uses it never has a live write credential sitting unused.
  let { data: inbox } = await db
    .from("subject_inboxes")
    .select("token, accept_from_anyone")
    .eq("subject_id", child.id)
    .maybeSingle();

  if (!inbox && editor) {
    const { data: made } = await adminClient()
      .from("subject_inboxes")
      .insert({ subject_id: child.id, token: newToken() })
      .select("token, accept_from_anyone")
      .single();
    inbox = made;
  }

  const { data: waiting } = await db
    .from("memories")
    .select("id, type, raw_text, arrival_note, arrived_via, created_at")
    .eq("subject_id", child.id)
    .is("filed_at", null)
    .not("arrived_via", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  // Somewhere to move a misfiled arrival to. Only fetched because the share
  // sheet cannot ask whose photograph it is, so our guess has to be one tap
  // from being corrected.
  const { data: siblings } = await db
    .from("subjects")
    .select("id, display_name")
    .eq("family_id", child.family_id);
  const others = ((siblings ?? []) as any[]).filter((s) => s.id !== child.id);

  const items = (waiting ?? []) as any[];

  return (
    <div className="py-10">
      <p className="text-xs uppercase tracking-[0.18em] text-clay">Inbox</p>

      {items.length === 0 ? (
        <>
          <h1 className="mt-3 max-w-[22ch] text-4xl leading-tight">Nothing waiting.</h1>
          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-stone">
            Everything sent in is already kept &mdash; dated, filed and part of{" "}
            {first}&rsquo;s year. Things only land here when we can&rsquo;t
            work something out on our own, which isn&rsquo;t often.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-3 max-w-[24ch] text-4xl leading-tight">
            {items.length === 1
              ? "One thing we couldn't place."
              : `${items.length} things we couldn't place.`}
          </h1>
          <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-stone">
            These are kept already. The only thing missing is where they sit in
            the year &mdash; and if you don&rsquo;t know, say so and they stay
            as they are.
          </p>

          <ul className="mt-8 space-y-4">
            {items.map((m) => (
              <li key={m.id} className="card">
                <p className="font-display text-lg leading-snug">
                  {m.raw_text || m.arrival_note || `A ${m.type}`}
                </p>
                <p className="mt-1 text-xs text-stone">
                  {m.arrived_via === "email" ? "Mailed in" : "Shared"} &middot;{" "}
                  arrived {friendlyDate(m.created_at)}
                </p>

                {editor && (
                  <form action={fileArrivalAction} className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="memory_id" value={m.id} />
                    <input type="hidden" name="subject_id" value={child.id} />
                    <input className="input max-w-[12rem]" type="date" name="memory_date" />
                    <button className="btn !px-4 !py-2 text-xs" name="intent" value="date">
                      Set the date
                    </button>
                    {/* Offered as plainly as the date, and it genuinely
                        ignores whatever is in the field: an archive that
                        will not let you say "I don't remember" is one that
                        collects wrong answers. */}
                    <button className="text-xs text-stone hover:text-ink" name="intent" value="unknown">
                      I don&rsquo;t know &mdash; keep it undated
                    </button>
                  </form>
                )}

                {editor && others.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone">
                    <span>We put this with {first}.</span>
                    {others.map((o) => (
                      <form action={moveArrival} key={o.id}>
                        <input type="hidden" name="memory_id" value={m.id} />
                        <input type="hidden" name="subject_id" value={child.id} />
                        <input type="hidden" name="to_subject_id" value={o.id} />
                        <button className="rounded-full border border-rule px-3 py-1 transition hover:border-ink hover:text-ink">
                          It&rsquo;s {o.display_name?.split(" ")[0]}&rsquo;s
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* --------------------------------------------------- the two doors */}

      <div className="mt-14 border-t border-rule pt-10">
        <h2 className="text-2xl">Sending things in</h2>
        <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-stone">
          Capture that takes more than a few seconds is capture that stops
          happening. Neither of these needs the app open.
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-lg">From your phone</h3>
            <p className="mt-1 max-w-[44ch] text-sm leading-relaxed text-stone">
              Add Qotidia to your home screen and it appears in the share
              sheet. Then it&rsquo;s share &rarr; Qotidia, and you&rsquo;re
              done &mdash; no app, no form.
            </p>
            {/* Said out loud rather than discovered. Half of all phones
                cannot do this, and a feature that silently isn't there on
                your device reads as a product that is broken. */}
            <p className="mt-2 max-w-[44ch] text-xs leading-relaxed text-stone">
              Android only, for now &mdash; iPhone doesn&rsquo;t let web apps
              into the share sheet. The address below works everywhere.
            </p>
          </div>

          <div>
            <h3 className="text-lg">{first}&rsquo;s private address</h3>
            {inbox ? (
              <>
                <p className="mt-1 max-w-[44ch] text-sm leading-relaxed text-stone">
                  Mail or forward anything here and it&rsquo;s kept. Photos,
                  a line you want to remember, something a grandparent sent
                  you.
                </p>
                <p className="mt-3 select-all break-all rounded-md border border-rule bg-card px-3 py-2 font-mono text-xs">
                  {addressFor(inbox.token, child.display_name)}
                </p>
                <p className="mt-2 max-w-[44ch] text-xs leading-relaxed text-stone">
                  Treat it like a key: anyone who has it can add to{" "}
                  {first}&rsquo;s archive. Mail from anyone who isn&rsquo;t in
                  the family is {inbox.accept_from_anyone ? "held for you to approve" : "turned away"}.
                </p>

                {editor && (
                  <div className="mt-4 flex flex-col items-start gap-3">
                    <form action={setInboxOpenness}>
                      <input type="hidden" name="subject_id" value={child.id} />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          name="accept_from_anyone"
                          defaultChecked={inbox.accept_from_anyone}
                        />
                        <span>Hold mail from outside the family for review</span>
                      </label>
                      <button className="mt-1.5 text-xs text-ochre hover:underline">Save</button>
                    </form>

                    <form action={rotateInboxAddress}>
                      <input type="hidden" name="subject_id" value={child.id} />
                      <button className="text-xs text-stone hover:text-ink">
                        Change the address
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-1 max-w-[44ch] text-sm leading-relaxed text-stone">
                Ask whoever set up {first}&rsquo;s archive for the address.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="mt-12 text-sm text-stone">
        <Link className="text-ochre" href={`/subjects/${child.id}`}>
          Back to {first}&rsquo;s year
        </Link>
      </p>
    </div>
  );
}
