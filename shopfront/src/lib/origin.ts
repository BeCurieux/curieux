/**
 * Where this deployment thinks it lives.
 *
 * Only one thing uses this: `metadataBase`, which is what a relative Open
 * Graph image is resolved against. Get it wrong and the page still works
 * perfectly — it just unfurls a broken image everywhere it is shared, which is
 * a bad failure for a page whose whole job is being shared, and a silent one.
 *
 * The order is deliberate:
 *
 *   1. `PUBLIC_ORIGIN` — set by hand, wins over everything. This is the
 *      answer once there is a custom domain, because none of the automatic
 *      values below will ever know about it.
 *   2. `NEXT_PUBLIC_ORIGIN` — the same thing under the name a client bundle
 *      could read. Accepted so that a deployment configured either way works.
 *   3. `VERCEL_PROJECT_PRODUCTION_URL` — the project's stable production
 *      domain, set by the platform. This is the one that makes a fresh import
 *      correct with no configuration at all.
 *   4. `VERCEL_URL` — the per-deployment URL, which changes on every push.
 *      Wrong as a canonical origin for production and right for a preview,
 *      which is exactly when the value above is absent.
 *   5. The domain the badge already points at, as a last resort.
 *
 * The platform values arrive without a scheme (`popuup.vercel.app`), so they
 * are given one. Vercel is https-only.
 *
 * Deliberately not used by `publish`: the URL handed to a merchant is a
 * promise about where their shop lives, and it should keep failing loudly when
 * nobody has said where that is rather than quietly guessing a preview domain
 * that stops existing next week. `pnpm deploy:check` still refuses on a
 * missing `PUBLIC_ORIGIN` for the same reason.
 */

export interface OriginEnv {
  PUBLIC_ORIGIN?: string | undefined;
  NEXT_PUBLIC_ORIGIN?: string | undefined;
  VERCEL_PROJECT_PRODUCTION_URL?: string | undefined;
  VERCEL_URL?: string | undefined;
}

const FALLBACK = "https://popuup.com";

// The cast is the weak-type check firing, not a shortcut: none of these names
// are declared on Node's ProcessEnv, so TypeScript sees an object type with no
// properties in common with this one and refuses the assignment.
export function resolveOrigin(env: OriginEnv = process.env as OriginEnv): string {
  const explicit = trim(env.PUBLIC_ORIGIN) ?? trim(env.NEXT_PUBLIC_ORIGIN);
  if (explicit) return withScheme(explicit);

  const platform = trim(env.VERCEL_PROJECT_PRODUCTION_URL) ?? trim(env.VERCEL_URL);
  if (platform) return withScheme(platform);

  return FALLBACK;
}

function trim(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** A bare host becomes https. Anything already carrying a scheme is left alone. */
function withScheme(value: string): string {
  return /^https?:\/\//i.test(value) ? value.replace(/\/+$/, "") : `https://${value.replace(/\/+$/, "")}`;
}
