// Who keeps this if you can't.
//
// The hardest page in the product to get the tone of. It asks a parent to
// think about their own death, in a product otherwise about a toddler's
// yellow boots, and the temptation is to soften it into meaninglessness.
//
// Two things it must do instead. Say what actually happens, in the order it
// happens, with real numbers — because the reason to trust this is that it
// is specific. And be unmissable when somebody has asked for the archive:
// that notice is the only thing standing between a living person and losing
// eighteen years of their child's life to whoever knew their email address.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { claimArchive, nameKeeper, refuseClaim, removeKeeper } from "@/app/actions";
import { roleInFamily } from "@/lib/family/membership";
import { canManageAccess } from "@/lib/family/roles";
import { NOTICE_DAYS, SETTLING_DAYS, SILENT_FOR_DAYS, daysBetween } from "@/lib/succession/policy";
import { friendlyDate } from "@/lib/words";

export const dynamic = "force-dynamic";

const months = (days: number) => Math.round(days / 30);

export default async function SuccessionPage({
  searchParams,
}: {
  searchParams: { named?: string; removed?: string; asked?: string; stopped?: string; error?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();
  const now = new Date().toISOString();

  const { data: membership } = await db
    .from("family_memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const familyId = membership?.family_id ?? null;
  const role = familyId ? await roleInFamily(db, familyId, user.id) : null;
  const isOwner = Boolean(familyId && canManageAccess(role));

  // Keepers of your own archive, and archives you have been named on. The
  // second is why this page is reachable by somebody with no family of their
  // own: a keeper is usually not a member.
  const { data: keepers } = familyId
    ? await db
        .from("family_keepers")
        .select("id, email, relationship, named_at, declined_at, family_id")
        .eq("family_id", familyId)
        .order("named_at")
    : { data: [] };

  // Archives somebody else has named this person on. Skipped entirely rather
  // than searched for with a placeholder when there is no email: a query
  // whose whole purpose is matching a person must not run with a value that
  // matches nobody-in-particular.
  const namedOn = user.email
    ? (
        await db
          .from("family_keepers")
          .select("id, family_id, named_at, families(family_name, owner_user_id)")
          .ilike("email", user.email)
          .neq("family_id", familyId ?? "00000000-0000-0000-0000-000000000000")
      ).data
    : [];

  const { data: claims } = await db
    .from("succession_claims")
    .select("id, family_id, keeper_email, opening, status, opened_at, decides_at, settled_because")
    .order("created_at", { ascending: false })
    .limit(20);

  const openOnMine = (claims ?? []).find(
    (c: any) => c.family_id === familyId && c.status === "notice"
  ) as any;

  return (
    <div className="mx-auto !max-w-2xl px-6 py-16">
      <Link href="/settings/privacy" className="text-sm text-ochre">
        ← Archive settings
      </Link>

      {/* Before anything else on the page. Somebody has asked for this
          archive, and the person reading is the only one who can stop it. */}
      {openOnMine && (
        <div className="mt-8 rounded-2xl border-2 border-clay bg-card p-6">
          <p className="font-display text-2xl">Someone has asked to take over your archive.</p>
          <p className="mt-3 leading-relaxed">
            {openOnMine.keeper_email} has told us you&rsquo;ve died and asked for this
            archive as the keeper you named. If that&rsquo;s wrong — and you&rsquo;re
            reading this, so it is — you&rsquo;ve already stopped it by signing in.
          </p>
          <p className="mt-3 text-sm text-stone">
            It would otherwise pass to them on {friendlyDate(openOnMine.decides_at)},{" "}
            {Math.max(0, daysBetween(now, openOnMine.decides_at))} days from now. Nothing
            has been deleted and nothing has moved.
          </p>
          <form action={refuseClaim} className="mt-5">
            <input type="hidden" name="claim_id" value={openOnMine.id} />
            <button className="btn">Stop this now</button>
          </form>
        </div>
      )}

      <h1 className="mt-8 font-display text-4xl">If you can&rsquo;t keep this</h1>

      <div className="mt-6 space-y-4 leading-relaxed">
        <p>
          This archive is meant to last until your child is grown. That is longer
          than some of the people who start one.
        </p>
        <p>
          You can name a <strong>keeper</strong> — one person who would take it over
          if you couldn&rsquo;t. They see nothing today and can do nothing today. What
          they can do is stop your family&rsquo;s archive from ending up behind a login
          nobody can pass.
        </p>
      </div>

      {searchParams.error && (
        <p className="mt-6 rounded-xl bg-clay/15 p-4 text-sm">{searchParams.error}</p>
      )}
      {searchParams.named && (
        <p className="mt-6 rounded-xl bg-card p-4 text-sm">
          Named. We&rsquo;ve emailed you about it, which is how you&rsquo;d find out if
          somebody else had done it.
        </p>
      )}
      {searchParams.stopped && (
        <p className="mt-6 rounded-xl bg-card p-4 text-sm">
          Stopped. It&rsquo;s in your activity log, permanently.
        </p>
      )}
      {searchParams.asked && (
        <p className="mt-6 rounded-xl bg-card p-4 text-sm">
          We&rsquo;ve asked. Nothing happens for {NOTICE_DAYS} days, and if they sign in
          at any point in that time it stops.
        </p>
      )}

      {/* ----------------------------------------------- what happens, exactly */}
      <section className="mt-12">
        <h2 className="font-display text-2xl">What would actually happen</h2>
        <ol className="mt-5 space-y-4 border-l border-clay/40 pl-6 text-[0.95rem] leading-relaxed">
          <li>
            <strong>They ask.</strong> Your keeper tells us you&rsquo;ve died. They
            can&rsquo;t do this for the first {SETTLING_DAYS} days after you name them.
          </li>
          <li>
            <strong>We spend a month trying to be told otherwise.</strong> You get an
            email straight away and five more over {NOTICE_DAYS} days, and this notice
            sits on every page.
          </li>
          <li>
            <strong>Signing in stops it.</strong> Not a button — opening Qotidia is
            enough. If you turn up on the last morning, it stops.
          </li>
          <li>
            <strong>Otherwise it passes to them.</strong> They become the owner.
            Nothing is deleted, your name stays on everything you wrote, and if it
            ever happened by mistake it can be undone.
          </li>
        </ol>

        <p className="mt-6 text-sm leading-relaxed text-stone">
          There&rsquo;s a second, slower way in: if nobody signs in for{" "}
          {months(SILENT_FOR_DAYS)} months and there&rsquo;s a keeper named, we offer
          it to them without waiting to be asked. That&rsquo;s the one that works when
          there&rsquo;s nobody left who knows to ask. If you never name anybody, nothing
          happens at all — we don&rsquo;t go looking for somebody to give your family&rsquo;s
          archive to.
        </p>
      </section>

      {/* --------------------------------------------------------- your keeper */}
      {isOwner && (
        <section className="mt-12">
          <h2 className="font-display text-2xl">Your keeper</h2>

          {(keepers ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-stone">Nobody named yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(keepers ?? []).map((k: any) => (
                <li key={k.id} className="flex items-center justify-between rounded-xl bg-card p-4">
                  <div>
                    <p className="font-medium">{k.email}</p>
                    <p className="text-sm text-stone">
                      {k.relationship ? `${k.relationship} · ` : ""}
                      named {friendlyDate(k.named_at)}
                      {k.declined_at ? " · they'd rather not" : ""}
                    </p>
                  </div>
                  <form action={removeKeeper}>
                    <input type="hidden" name="keeper_id" value={k.id} />
                    <button className="btn-secondary !px-4 !py-2 text-sm">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form action={nameKeeper} className="mt-6 space-y-3">
            <div>
              <label className="label" htmlFor="email">Their email</label>
              <input className="input" id="email" name="email" type="email" required />
            </div>
            <div>
              <label className="label" htmlFor="relationship">
                Who they are <span className="text-stone">(optional)</span>
              </label>
              <input
                className="input"
                id="relationship"
                name="relationship"
                placeholder="my sister Ruth"
              />
            </div>
            <button className="btn">Name them</button>
            <p className="text-xs leading-relaxed text-stone">
              We&rsquo;ll email you to confirm. Tell them you&rsquo;ve done it — being
              named is not much use to somebody who doesn&rsquo;t know.
            </p>
          </form>
        </section>
      )}

      {/* ------------------------------------------ archives you are keeper of */}
      {(namedOn ?? []).length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl">You&rsquo;re a keeper</h2>
          <p className="mt-3 text-sm leading-relaxed text-stone">
            Somebody has named you as the person who would take their archive over.
            You can&rsquo;t see anything in it and nothing is expected of you.
          </p>
          <ul className="mt-4 space-y-3">
            {(namedOn ?? []).map((k: any) => {
              const open = (claims ?? []).find(
                (c: any) => c.family_id === k.family_id && c.status === "notice"
              ) as any;
              const waited = daysBetween(k.named_at, now);
              return (
                <li key={k.id} className="rounded-xl bg-card p-4">
                  <p className="font-medium">{k.families?.family_name ?? "An archive"}</p>
                  <p className="mt-1 text-sm text-stone">
                    Named {friendlyDate(k.named_at)}
                  </p>
                  {open ? (
                    <p className="mt-3 text-sm leading-relaxed">
                      You&rsquo;ve asked for this. It passes to you on{" "}
                      {friendlyDate(open.decides_at)} unless they sign in before then.
                    </p>
                  ) : waited < SETTLING_DAYS ? (
                    <p className="mt-3 text-sm text-stone">
                      You can ask for this from{" "}
                      {friendlyDate(
                        new Date(new Date(k.named_at).getTime() + SETTLING_DAYS * 86_400_000)
                      )}
                      .
                    </p>
                  ) : (
                    <form action={claimArchive} className="mt-4">
                      <input type="hidden" name="family_id" value={k.family_id} />
                      <button className="btn-secondary !px-4 !py-2 text-sm">
                        They&rsquo;ve died — ask to take this over
                      </button>
                      <p className="mt-2 text-xs leading-relaxed text-stone">
                        Nothing happens for {NOTICE_DAYS} days, and they&rsquo;ll be
                        emailed about it. If they sign in, it stops.
                      </p>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* -------------------------------------------------------- what happened */}
      {(claims ?? []).filter((c: any) => c.status !== "notice").length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl">What&rsquo;s been asked before</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(claims ?? [])
              .filter((c: any) => c.status !== "notice")
              .map((c: any) => (
                <li key={c.id} className="rounded-xl bg-card px-4 py-3">
                  <span className="text-stone">{friendlyDate(c.opened_at)} · </span>
                  {c.opening === "silence"
                    ? "opened because nobody had signed in for a long time"
                    : `${c.keeper_email} asked to take this over`}
                  {c.settled_because ? ` — ${c.settled_because}` : ""}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
