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
