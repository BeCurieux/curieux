// A story somebody was sent.
//
// The only page in the product that opens without an account, which is the
// point: the person most likely to know what was happening in a photograph
// is a grandmother who is not going to make an account before she looks at
// it. Asking her to loses the answer, and the answer is the asset.
//
// What she can reach is one frozen story and a box. Not the archive, not the
// child's other photographs, not the years either side, not who else was
// sent it. lib/share/policy.ts argues why that is a different thing from the
// public share link the original brief refused.

import type { Metadata } from "next";
import Link from "next/link";
import { adminClient } from "@/lib/supabase/server";
import { contributeToStory } from "@/app/actions";
import { TOKEN_SHAPE, reachable, sayWhy } from "@/lib/share/policy";
import { getObjectStore, TTL } from "@/lib/storage/provider";
import { SERVABLE_VERDICT } from "@/lib/media/verify";
import { BRAND } from "@/lib/brand";
import { dateRange } from "@/lib/words";

export const dynamic = "force-dynamic";

/**
 * Never indexed, and said three ways.
 *
 * A search engine that reaches one of these has made a family's private
 * story public, permanently and irreversibly. robots meta here, and the
 * route is disallowed in robots.txt as well — belt and braces, because the
 * cost of being wrong is not recoverable.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // No title or description carrying the child's name. Those end up in
  // link previews in group chats.
  title: BRAND,
};

export default async function SharedStoryPage(
  props: {
    params: Promise<{ token: string }>;
    searchParams: Promise<{ thanks?: string; error?: string; full?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const token = params.token;

  const admin = adminClient();
  const { data: rows } = TOKEN_SHAPE.test(token)
    ? await admin.rpc("open_shared_story", { t: token })
    : { data: [] };
  const share = (Array.isArray(rows) ? rows[0] : null) as any;

  const state = reachable(
    share
      ? {
          expiresAt: share.expires_at,
          revokedAt: share.revoked_at,
          allowContributions: share.allow_contributions,
          contributionCount: share.contribution_count ?? 0,
        }
      : null,
    new Date().toISOString()
  );

  if (!state.ok) {
    return (
      <div className="mx-auto !max-w-lg px-6 py-24 text-center">
        <p className="font-display text-2xl">{sayWhy(state.because)}</p>
        <p className="mt-8 text-sm">
          <Link href="/" className="text-ochre">
            What {BRAND} is
          </Link>
        </p>
      </div>
    );
  }

  const payload = share.payload ?? {};
  const shotIds: string[] = Array.isArray(payload.shotIds) ? payload.shotIds : [];

  // Resolved here, from the frozen list of ids. Still gated on the scan
  // verdict — a link being shared is not a reason to serve a file nothing
  // has read.
  const { data: assets } = shotIds.length
    ? await admin
        .from("media_assets")
        .select("memory_id, storage_path")
        .in("memory_id", shotIds)
        .eq("scan_verdict", SERVABLE_VERDICT)
    : { data: [] };

  const store = getObjectStore();
  const urls = new Map<string, string>();
  for (const asset of (assets ?? []) as any[]) {
    try {
      urls.set(asset.memory_id, await store.readUrl("media", asset.storage_path, TTL.view));
    } catch {
      continue;
    }
  }

  return (
    <div className="mx-auto !max-w-3xl px-6 py-16">
      {payload.title && (
        <h1 className="max-w-[18ch] font-display text-5xl leading-[1.1] md:text-6xl">
          {payload.title}
        </h1>
      )}
      {payload.subtitle && (
        <p className="mt-4 max-w-[46ch] leading-relaxed text-stone">{payload.subtitle}</p>
      )}

      {urls.size > 0 && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shotIds
            .filter((id) => urls.has(id))
            .map((id) => (
              <img
                key={id}
                src={urls.get(id)}
                alt=""
                className="aspect-[4/5] w-full rounded-lg object-cover"
              />
            ))}
        </div>
      )}

      {payload.from && payload.to && (
        <p className="mt-5 text-sm text-stone">{dateRange(payload.from, payload.to)}</p>
      )}

      {/* ------------------------------------------------- what they remember
          The reason this page exists. She was sent it because she knows
          something the archive does not. */}
      {state.mayContribute && !searchParams.thanks && (
        <section className="mt-14 border-t border-rule pt-8">
          <h2 className="font-display text-2xl">Do you remember this?</h2>
          <p className="mt-2 max-w-[50ch] text-sm leading-relaxed text-stone">
            Anything at all &mdash; where it was, what happened next, what
            somebody said. It goes to the family who sent this, and they decide
            whether to keep it. You don&rsquo;t need an account.
          </p>

          {searchParams.error && (
            <p className="mt-5 rounded-xl bg-clay/15 p-4 text-sm">{searchParams.error}</p>
          )}

          <form action={contributeToStory} className="mt-6 space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label className="label" htmlFor="body">What you remember</label>
              <textarea id="body" name="body" rows={4} className="input w-full" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Who you are</label>
                <input id="name" name="name" className="input" placeholder="Gran" required />
              </div>
              <div>
                <label className="label" htmlFor="email">
                  Email <span className="text-stone">(optional)</span>
                </label>
                <input id="email" name="email" type="email" className="input" />
                <p className="mt-1 text-xs text-stone">
                  Only so they can ask you more. Nothing is sent to you.
                </p>
              </div>
            </div>
            <button className="btn">Send it to them</button>
          </form>
        </section>
      )}

      {searchParams.thanks && (
        <section className="mt-14 border-t border-rule pt-8">
          <p className="font-display text-2xl">Sent. Thank you.</p>
          <p className="mt-3 max-w-[50ch] leading-relaxed text-stone">
            They&rsquo;ll see it next time they open the archive. Things like
            this are the part nobody can work out from a photograph later.
          </p>
        </section>
      )}

      {searchParams.full && (
        <section className="mt-14 border-t border-rule pt-8">
          <p className="max-w-[50ch] leading-relaxed text-stone">
            This one isn&rsquo;t taking any more answers. Ask whoever sent it if
            you have something to add.
          </p>
        </section>
      )}

      {/* --------------------------------------------------------- the mark
          Small, and it links to what this is rather than to a signup form.
          Somebody who has just read a stranger's family story should be
          told what they are looking at, not sold to in the same breath. */}
      <footer className="mt-20 border-t border-rule pt-8 text-sm text-stone">
        <p>
          Remembered with{" "}
          <Link href="/" className="text-ochre">
            {BRAND}
          </Link>
          {" "}&mdash; a private archive that becomes a book once a year.
        </p>
        <p className="mt-2 max-w-[52ch] text-xs leading-relaxed">
          This link was sent to you by the family it belongs to. It isn&rsquo;t
          listed or searchable anywhere, it reaches this one story and nothing
          else, and it stops working on its own.
        </p>
      </footer>
    </div>
  );
}
