/**
 * Whether a link can possibly go anywhere.
 *
 * The demo shops are built on `casalino.example` and `example.invalid`, and
 * every product card in them linked to a host that does not exist. Nothing was
 * broken exactly — the URLs are correct for the catalogue they came from — but
 * a page whose entire argument is that everything on it is real output was
 * handing visitors dead links, on the one section a sceptic actually clicks.
 *
 * This is not a heuristic. RFC 2606 and RFC 6761 reserve `.example`,
 * `.invalid`, `.test` and `.localhost` precisely so that they can never be
 * registered or resolved, which makes "this link is dead" a fact about the
 * address rather than a guess about the world. That is the whole reason the
 * demo catalogue uses them, and it is why this check can be certain rather
 * than cautious.
 *
 * Deliberately narrow. It does not try to decide whether a *real* merchant's
 * URL works: a store that is briefly down, a product that was deleted, a typo
 * in a feed — none of those are knowable from a string, and guessing would
 * mean suppressing links that do work. Anything not on a reserved name is
 * treated as reachable, which is the honest default.
 */

/**
 * Reserved by the IETF to never resolve.
 *
 * `localhost` is included for completeness rather than need: a shop rendered
 * from a local ingest would otherwise offer a shopper a link to their own
 * machine.
 */
const RESERVED = /(^|\.)(example|invalid|test|localhost)$/i;

/**
 * True when a URL can be followed, as far as its address can tell us.
 *
 * A string that is not a URL at all comes back false. The callers all use this
 * to decide whether to render an anchor, and an anchor around something that
 * does not parse is worse than no anchor.
 */
export function isReachable(url: string | undefined | null): boolean {
  if (!url) return false;

  // Fragments and same-page targets are always followable; they never leave.
  if (url.startsWith("#") || url.startsWith("/")) return true;

  try {
    return !RESERVED.test(new URL(url).hostname);
  } catch {
    return false;
  }
}
