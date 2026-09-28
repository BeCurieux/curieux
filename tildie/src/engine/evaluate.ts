/**
 * The scan.
 *
 * Text in, findings and a score out, with no network call and no model
 * anywhere in the path. That is the property worth protecting as this file
 * grows: a model may choose how the document is segmented and may draft the
 * rewrite afterwards, but between those two points nothing decides anything
 * except a rule.
 */

import { DISCLAIMER, headline } from "./framing.js";
import { match } from "./match.js";
import { packFor, isSupported, UnsupportedJurisdictionError } from "./registry.js";
import { scoreFindings } from "./score.js";
import { extractClaims } from "../extract/deterministic.js";
import type {
  Claim,
  Finding,
  Jurisdiction,
  Rule,
  ScanInput,
  ScanResult,
  Score,
  Span,
} from "./types.js";

/** The claim a hit sits inside, or null when it landed between them. */
function claimContaining(claims: Claim[], span: Span): Claim | null {
  return claims.find((claim) => claim.span.start <= span.start && claim.span.end >= span.end) ?? null;
}

function findingFor(rule: Rule, text: string, span: Span, claims: Claim[]): Finding {
  return {
    ruleId: rule.id,
    ruleTitle: rule.title,
    jurisdiction: rule.jurisdiction,
    categories: rule.categories,
    severity: rule.severity,
    modality: rule.modality,
    citation: rule.citation,
    claimId: claimContaining(claims, span)?.id ?? null,
    trigger: { text: text.slice(span.start, span.end), span },
    headline: headline(rule),
    concern: rule.concern,
    remedy: rule.remedy,
    rewriteGuidance: rule.rewriteGuidance,
  };
}

/** Every finding one pack has about one document, in document order. */
export function findingsFor(jurisdiction: Jurisdiction, text: string, claims: Claim[]): Finding[] {
  const pack = packFor(jurisdiction);
  const findings = pack.rules.flatMap((rule) =>
    match(text, rule.match).map((span) => findingFor(rule, text, span, claims)),
  );
  return findings.sort((a, b) => a.trigger.span.start - b.trigger.span.start || a.ruleId.localeCompare(b.ruleId));
}

export function scan(input: ScanInput): ScanResult {
  if (input.jurisdictions.length === 0) {
    throw new Error("A scan needs at least one jurisdiction; scoring against no rules is not a clean sheet.");
  }
  const unsupported = input.jurisdictions.find((j) => !isSupported(j));
  if (unsupported) throw new UnsupportedJurisdictionError(unsupported);

  // Duplicates would score the same market twice and read as two chips.
  const jurisdictions = [...new Set(input.jurisdictions)];
  const claims = extractClaims(input.text);

  const byJurisdiction: Partial<Record<Jurisdiction, Score>> = {};
  const packVersions: Record<string, string> = {};
  const findings: Finding[] = [];

  for (const jurisdiction of jurisdictions) {
    const own = findingsFor(jurisdiction, input.text, claims);
    byJurisdiction[jurisdiction] = scoreFindings(own);
    packVersions[jurisdiction] = packFor(jurisdiction).version;
    findings.push(...own);
  }

  findings.sort(
    (a, b) =>
      a.trigger.span.start - b.trigger.span.start ||
      jurisdictions.indexOf(a.jurisdiction) - jurisdictions.indexOf(b.jurisdiction) ||
      a.ruleId.localeCompare(b.ruleId),
  );

  const weakest = weakestOf(jurisdictions, byJurisdiction);
  return {
    source: input.source,
    jurisdictions,
    packVersions,
    claims,
    findings,
    readChars: input.text.trim().length,
    score: byJurisdiction[weakest] ?? { value: 100, band: "clear", deductions: [] },
    byJurisdiction,
    disclaimer: DISCLAIMER,
  };
}

/**
 * The market this copy reads worst in, which is the market the headline score
 * reports. Ties go to the order the caller asked for, so the same request
 * always produces the same answer.
 */
export function weakestOf(
  jurisdictions: Jurisdiction[],
  scores: Partial<Record<Jurisdiction, Score>>,
): Jurisdiction {
  let weakest = jurisdictions[0] as Jurisdiction;
  for (const jurisdiction of jurisdictions) {
    const here = scores[jurisdiction]?.value ?? 100;
    const best = scores[weakest]?.value ?? 100;
    if (here < best) weakest = jurisdiction;
  }
  return weakest;
}

/** Convenience for surfaces that want to name the weakest market. */
export function weakestMarket(result: ScanResult): Jurisdiction {
  return weakestOf(result.jurisdictions, result.byJurisdiction);
}
