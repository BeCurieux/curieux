/**
 * "Made with popuup" — the free tier's badge, and the entire marketing budget.
 *
 * Two forces pull against each other here. It has to be seen, because published
 * shops are how the next merchant finds this. And it has to be *tolerated*,
 * because a merchant who resents it removes it the moment they can, and a badge
 * on a shop nobody kept is worth nothing.
 *
 * So it wears the merchant's palette rather than popuup's. A violet pill in the
 * middle of a sage-green shop is the version a merchant strips out; the same
 * words set in their own muted tone is the version that stays. The one piece of
 * brand that survives the translation is the violet on the double-u, which is
 * the wordmark's distinguishing mark and is recognisable at this size without
 * fighting anything.
 *
 * It says "made with", which is true. It does not say the shop is synced, live
 * or connected, because the whole page is under the same rule and the badge is
 * the single most tempting place to break it.
 */

const HOME = "https://popuup.com";

export function Badge({ slug }: { slug?: string }) {
  // A UTM per shop, because "organic install rate from published-shop badges"
  // is a number the brief commits to accumulating, and it is unmeasurable
  // without this.
  const href = `${HOME}?utm_source=shop&utm_medium=badge${slug ? `&utm_campaign=${encodeURIComponent(slug)}` : ""}`;

  return (
    <a className="badge" href={href} target="_blank" rel="noopener">
      <span className="badge-made">Made with</span>
      <span className="badge-mark">
        pop<em>uu</em>p
      </span>
    </a>
  );
}
