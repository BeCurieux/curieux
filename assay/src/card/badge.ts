/**
 * The badge — the thing the whole product is for.
 *
 * BRIEF.md §5 makes it the core bet and §9 fixes its language: descriptive,
 * never a warranty. So the words on it are generated from the scan rather than
 * written by anybody, and `tests/badge.test.ts` asserts that the warranty
 * vocabulary — approved, certified, compliant, guaranteed, safe — never
 * appears on it in any state. That test is most of the badge's legal defence
 * and it should not be relaxed further than it already has been; see
 * BADGE_HEADLINE.
 *
 * Two states. Live, while the scan is current. Lapsed, when it is not: the
 * Vanta-style retention loop the brief describes, where cancelling greys the
 * mark rather than removing it. A lapsed badge still names its date and still
 * links to its page, because a mark that quietly keeps asserting a score it no
 * longer stands behind is the dishonest version of this mechanic.
 *
 * Plain SVG with no embedded fonts: this renders inside a merchant's page, and
 * a hundred kilobytes of base64 on every PDP to guarantee one typeface is a
 * bad trade. The serif stack degrades to something decent everywhere.
 */

import type { ScanResult } from "../engine/types.js";
import { badgeEligible } from "../engine/score.js";
import { escXml, safeUrl } from "./escape.js";
import { BADGE_PALETTE as PALETTE, FONTS, monthYear } from "./tokens.js";

export type BadgeOptions = {
  result: ScanResult;
  /** The date this scan was run. Taken, never read off the clock. */
  reviewedOn: Date;
  /**
   * False once monitoring stops. The mark greys and says so; it does not
   * disappear and it does not keep claiming to be current.
   */
  live?: boolean;
  /** The public score page this mark links back to. */
  href?: string;
};

export const BADGE_WIDTH = 320;
export const BADGE_HEIGHT = 78;

/**
 * Words this mark may never carry, in any state. Enforced by test.
 *
 * "verified" was on this list and is not any more — see BADGE_HEADLINE. Every
 * other member stays, and each is a different way of saying the thing this
 * product cannot say: that somebody with authority looked and approved.
 */
export const BADGE_FORBIDDEN = [
  "approved",
  "certified",
  "certificate",
  "compliant",
  "compliance",
  "guarantee",
  "guaranteed",
  "safe",
  "endorsed",
  "passed",
] as const;

/**
 * "Claims Verified", as BRIEF.md §4 names it.
 *
 * This was built as "Claims reviewed" first, on the reading that §4's name and
 * §9's descriptive-not-a-warranty requirement pull against each other and that
 * §9 wins because it is the section marked non-negotiable. The owner was shown
 * that argument and kept §4's wording. Recorded here rather than argued again,
 * because a decision somebody reversed on purpose should not read like an
 * oversight to whoever opens this file next.
 *
 * What carries §9 now that the headline does not:
 *
 *   - the line under it says what actually happened — reviewed against these
 *     markets, in this month — so the mark still describes an act on a date
 *     rather than a status;
 *   - the rest of BADGE_FORBIDDEN stands, so nothing on the mark says
 *     approved, certified, compliant, guaranteed or safe;
 *   - the score page it links to opens with the disclaimer, which is a field
 *     on ScanResult and cannot be omitted by a surface;
 *   - `mayDisplayBadge` still refuses the mark to anything but a clear reading
 *     in every market checked; and
 *   - a lapsed mark still says lapsed.
 *
 * The exposure this leaves is real and worth naming for the T&Cs review in §9:
 * "verified" invites a reader to think an outside body checked, and nothing
 * did. It is the sentence a plaintiff's lawyer would read aloud. Worth putting
 * in front of counsel with the pack and the rules, not settled in this file.
 */
export const BADGE_HEADLINE = "Claims Verified";

/** Advance width of one mono character at a size, with its letter-spacing. */
const monoWidth = (chars: number, size: number, spacing: number) => chars * (size * 0.6 + spacing);

export function badgeLines(options: BadgeOptions): {
  headline: string;
  markets: string;
  when: string;
} {
  const { result, reviewedOn, live = true } = options;
  // Three markets fit; more would run past the frame, and a truncated market
  // list on a public mark is worse than an honest count.
  const markets =
    result.jurisdictions.length <= 3
      ? result.jurisdictions.join(" · ")
      : `${result.jurisdictions.length} markets`;
  const when = monthYear(reviewedOn);
  return {
    headline: BADGE_HEADLINE,
    // "Reviewed against" rather than the bare market list: with the headline
    // naming a status, this line is where the mark says what was actually
    // done, which is the §9 requirement the headline stopped carrying.
    markets: `Reviewed against ${markets}`,
    when: live ? when : `Lapsed — ${when}`,
  };
}

export function badgeSvg(options: BadgeOptions): string {
  const { result, live = true, href } = options;
  const lines = badgeLines(options);
  const ink = live ? PALETTE.ink : PALETTE.inkFaint;
  const soft = live ? PALETTE.inkSoft : PALETTE.inkFaint;
  const label =
    `${lines.headline}. Reviewed against ${result.jurisdictions.join(", ")}, ${lines.when}. ` +
    `Score ${result.score.value} out of 100.`;

  const scoreSize = 36;
  const scoreX = 22;
  const ofX = scoreX + String(result.score.value).length * scoreSize * 0.45 + 9;
  const divider = 108;
  const textX = divider + 18;

  const body =
    `<rect x="0.5" y="0.5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="3" ` +
    `fill="${PALETTE.paperRaised}" stroke="${live ? PALETTE.rule : PALETTE.ruleFaint}"/>` +
    // The one stroke of accent on the mark, and the clearest live/lapsed
    // signal there is: it goes grey with everything else when a scan stops
    // being current.
    `<rect x="0" y="1" width="3" height="${BADGE_HEIGHT - 2}" ` +
    `fill="${live ? PALETTE.accent : PALETTE.rule}"/>` +
    `<text x="${scoreX}" y="50" font-family='${escXml(FONTS.display)}' font-size="${scoreSize}" ` +
    `fill="${ink}">${result.score.value}</text>` +
    `<text x="${ofX}" y="50" font-family='${escXml(FONTS.display)}' font-size="13" ` +
    `fill="${soft}">/100</text>` +
    `<line x1="${divider}" y1="18" x2="${divider}" y2="${BADGE_HEIGHT - 18}" ` +
    `stroke="${live ? PALETTE.rule : PALETTE.ruleFaint}"/>` +
    `<text x="${textX}" y="30" font-family='${escXml(FONTS.mono)}' font-size="9.5" ` +
    `letter-spacing="1.7" fill="${ink}">${escXml(lines.headline.toUpperCase())}</text>` +
    `<text x="${textX}" y="46" font-family='${escXml(FONTS.mono)}' font-size="8.5" ` +
    `letter-spacing="0.9" fill="${soft}">${escXml(lines.markets.toUpperCase())}</text>` +
    `<text x="${textX}" y="61" font-family='${escXml(FONTS.mono)}' font-size="8.5" ` +
    `letter-spacing="0.9" fill="${PALETTE.inkFaint}">${escXml(lines.when.toUpperCase())}</text>`;

  // Through `safeUrl` rather than straight in: this mark is embedded on other
  // people's pages, and the one attribute it carries is the one an attacker
  // would want. Anything that is not http(s) is dropped and the mark renders
  // without a link.
  const link = safeUrl(href);
  const inner = link ? `<a href="${escXml(link)}" target="_blank" rel="noopener">${body}</a>` : body;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" ` +
    `viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${escXml(label)}">` +
    `<title>${escXml(label)}</title>${inner}</svg>`
  );
}

/** Longest line the mark can hold before it runs past its own frame. */
export function badgeTextFits(options: BadgeOptions): boolean {
  const lines = badgeLines(options);
  const room = BADGE_WIDTH - (108 + 18) - 14;
  return (
    monoWidth(lines.headline.length, 9.5, 1.7) <= room &&
    monoWidth(lines.markets.length, 8.5, 0.9) <= room &&
    monoWidth(lines.when.length, 8.5, 0.9) <= room
  );
}

/**
 * Whether this result may display a mark at all.
 *
 * Re-exported here rather than left to each caller to remember, because the
 * one place this product must not be lenient is between a scan and a public
 * claim about that scan.
 */
export function mayDisplayBadge(result: ScanResult): boolean {
  return badgeEligible(result.score);
}
