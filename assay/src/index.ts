/** The engine's public surface. Everything a scan, a score page or a badge needs. */

export * from "./engine/types.js";
export { scan, findingsFor, weakestMarket, weakestOf } from "./engine/evaluate.js";
export { scoreFindings, badgeEligible, bandFor, BAND_THRESHOLDS } from "./engine/score.js";
export { match, normaliseSpans, DEFAULT_QUALIFIER_WINDOW } from "./engine/match.js";
export {
  headline,
  citationLabel,
  absolutesIn,
  BANNED_ABSOLUTES,
  CLAIM_DIRECTED_FIELDS,
  DISCLAIMER,
} from "./engine/framing.js";
export {
  packFor,
  allPacks,
  allRules,
  ruleById,
  isSupported,
  supportedJurisdictions,
  UnsupportedJurisdictionError,
} from "./engine/registry.js";
export { extractClaims, categoriesOf } from "./extract/deterministic.js";

// ------------------------------------------------------------------- the card

export { resultPage, rewriteKey, type CardOptions } from "./card/page.js";
export { shareCard, wrapText, OG_WIDTH, OG_HEIGHT, type ShareCardOptions } from "./card/og.js";
export {
  badgeSvg,
  badgeLines,
  badgeTextFits,
  mayDisplayBadge,
  BADGE_FORBIDDEN,
  BADGE_HEADLINE,
  BADGE_WIDTH,
  BADGE_HEIGHT,
  type BadgeOptions,
} from "./card/badge.js";
export {
  annotate,
  annotateResult,
  marksFor,
  marketsOf,
  headlineMark,
  type Annotated,
  type Mark,
  type Piece,
} from "./card/annotate.js";
export {
  PALETTE,
  DARK,
  FONTS,
  BAND_LABEL,
  SEVERITY_LABEL,
  SEVERITY_MARK,
  MARKET_LABEL,
  bandNote,
  longDate,
  monthYear,
  paletteCss,
  fontFaces,
  type EmbeddedFonts,
} from "./card/tokens.js";
export { esc, escXml, safeUrl } from "./card/escape.js";

// `fonts.ts` reads from disk and is deliberately not re-exported here: the
// renderers are pure, and a surface that pulls node:fs into a browser bundle
// by importing the index is a bad afternoon.
