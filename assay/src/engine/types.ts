/**
 * The engine's vocabulary.
 *
 * Everything downstream — the score, the badge, the score page, the rewrite
 * prompt — is a function of the shapes in this file, so the constraints the
 * brief calls non-negotiable are expressed here as types rather than as
 * discipline. In particular:
 *
 *   - a Finding cannot say a claim is unlawful, because the sentence it
 *     shows is composed from `Modality`, which has no such member;
 *   - a Finding cannot exist without a Rule, because it carries the rule's
 *     id and citation by construction;
 *   - a jurisdiction with no pack is an error rather than a clean sheet.
 */

/**
 * Launch set is AU + US + EU. `GB` and `CA_QC` are named because the paid
 * tiers will sell them and the toggles need a type before they need rules —
 * but naming a jurisdiction is not shipping one. `packFor` throws for a
 * jurisdiction with no pack, and the reason is the worst failure this product
 * has: a brand toggles a market we have not written, scores 100 on silence,
 * and puts a badge on the page.
 */
export type Jurisdiction = "AU" | "US" | "EU" | "GB" | "CA_QC";

export const LAUNCH_JURISDICTIONS = ["AU", "US", "EU"] as const satisfies readonly Jurisdiction[];

/**
 * The claim taxonomy, first-class per the brief. Five kinds, and the list is
 * closed until somebody decides to open it: a sixth category invented mid-rule
 * is how a taxonomy stops meaning anything.
 *
 * Named ClaimCategory rather than ClaimKind on purpose. The sibling product is
 * called ClaimKind and shares nothing with this codebase; a type of that name
 * would read like a dependency that does not exist.
 */
export type ClaimCategory =
  /** What the product does to a body: "reduces wrinkles", "boosts immunity". */
  | "efficacy"
  /** What is absent or pure: "clean", "non-toxic", "free from nasties". */
  | "free_from"
  /** What it does to the planet: "eco-friendly", "carbon neutral", "recyclable". */
  | "environmental"
  /** What a study is said to show: "clinically proven", "dermatologist tested". */
  | "clinical"
  /** How it feels or seems, the one kind that is usually fine: "silky", "glows". */
  | "sensory";

export const CLAIM_CATEGORIES = [
  "efficacy",
  "free_from",
  "environmental",
  "clinical",
  "sensory",
] as const satisfies readonly ClaimCategory[];

/**
 * How far a finding moves the score, and nothing else. Severity is about the
 * claim's exposure — how reliably this language draws an ad rejection, a
 * retailer query or a regulator's letter — not about how wrong the brand is.
 */
export type Severity = "high" | "medium" | "low";

/** Points deducted for the first trip of a rule at each severity. See score.ts. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  high: 18,
  medium: 9,
  low: 4,
};

/**
 * The closed set of things this product is willing to say about a brand's own
 * copy. Every finding headline is composed from one of these; there is no free
 * text path from a rule to the sentence a customer reads.
 *
 * The list is short and it is meant to stay short. Adding a member is a
 * decision about what the product asserts, so it belongs in a review, not in
 * the middle of authoring a rule.
 */
export type Modality =
  /** The language reliably trips platform review or a regulator's screen. */
  | "likely_to_be_flagged"
  /** The claim is fine if the evidence exists; we cannot see the evidence. */
  | "may_be_unsubstantiated"
  /** The instrument names evidence this specific wording has to carry. */
  | "requires_substantiation"
  /** The claim is defensible; the wording reaches further than it needs to. */
  | "narrowing_suggested";

/** A half-open character range into the scanned document. */
export type Span = { start: number; end: number };

/**
 * A claim, as segmented out of the document.
 *
 * Claims are how findings are attributed and grouped for display. They are
 * *not* what the rules read: `evaluate` runs the corpus over the whole
 * document and then attributes each hit to the claim containing it. An
 * extractor — deterministic here, a model later — that misses a sentence
 * therefore costs presentation quality and never costs a finding.
 */
export type Claim = {
  id: string;
  /** Exact substring of the source, so highlighting needs no re-derivation. */
  text: string;
  span: Span;
  /** What kind of claim this looks like. Display and grouping only. */
  categories: ClaimCategory[];
};

/** Where a rule comes from, so a finding can name it rather than assert it. */
export type Citation = {
  /** The instrument, in the form a brand's lawyer would recognise. */
  instrument: string;
  /** Article, section, clause — whatever that instrument calls its unit. */
  locator?: string;
  /** A public URL for the instrument, when there is a stable one. */
  url?: string;
};

/** The declarative matcher language. Serialisable on purpose: a rule pack is
 *  data, so it can be versioned, diffed, tested, and one day authored in a UI
 *  by somebody who does not write TypeScript. */
export type Matcher =
  /**
   * Any of these phrases, matched case-insensitively at word boundaries.
   * `unless` suppresses the hit when one of its phrases appears within
   * `window` characters — that is how "recyclable" stays quiet next to
   * "recyclable where facilities exist".
   */
  | { kind: "phrase"; any: string[]; unless?: string[]; window?: number }
  /** An explicit regular expression, for the shapes phrases cannot express. */
  | { kind: "pattern"; source: string; flags?: string; unless?: string[]; window?: number }
  /** Every child must hit somewhere in the document. Reports the first child's spans. */
  | { kind: "all"; of: Matcher[] }
  /** Any child hitting is a hit. Reports every child's spans. */
  | { kind: "any"; of: Matcher[] };

// There is deliberately no document-scoped negation — no "this phrase and that
// one nowhere on the page". Every rule authored so far wanted the qualifier
// near the claim rather than somewhere on the page, and a page-wide `without`
// is how a disclaimer in the footer silences a finding in the hero. If a rule
// genuinely needs it later, it is a small addition; until then it is a large
// loophole nobody asked for.

/**
 * One rule. The unit a finding cites and the unit the score deducts against.
 */
export type Rule = {
  /** Stable, kebab-case, jurisdiction-prefixed. Never reused for a new meaning. */
  id: string;
  /** Short label, for chips and the score page. Sentence case, no full stop. */
  title: string;
  jurisdiction: Jurisdiction;
  /** What kind of claim this rule is about. Grouping and coverage, never a gate. */
  categories: ClaimCategory[];
  severity: Severity;
  modality: Modality;
  citation: Citation;
  /**
   * What the instrument itself says, stated neutrally about the law. This is
   * the one field allowed to use the law's own absolute verbs, because it is
   * describing an instrument and not judging a brand's page.
   */
  instrumentSays: string;
  /**
   * Why this wording draws attention, addressed to the brand's copy. Guidance
   * voice, no absolutes — enforced by tests/framing.test.ts.
   */
  concern: string;
  /** What evidence or wording would settle it. Shown beside the finding. */
  remedy: string;
  /** Constrains the rewrite: what a compliant alternative must and must not do. */
  rewriteGuidance: string;
  match: Matcher;
};

/** A versioned bundle of rules for one jurisdiction. */
export type RulePack = {
  jurisdiction: Jurisdiction;
  /** Bumped whenever a rule is added, removed, or changed in a way that
   *  changes a score. A badge records the version it was earned under. */
  version: string;
  /** Human name for the pack, as it appears on the score page. */
  label: string;
  rules: Rule[];
};

/** One rule tripping once, at one place in the document. */
export type Finding = {
  ruleId: string;
  ruleTitle: string;
  jurisdiction: Jurisdiction;
  categories: ClaimCategory[];
  severity: Severity;
  modality: Modality;
  citation: Citation;
  /** The claim this was attributed to, or null when it fell outside all of them. */
  claimId: string | null;
  /** The exact text that tripped the rule, and where it sits in the document. */
  trigger: { text: string; span: Span };
  /** The sentence shown to the brand. Composed, never authored. See framing.ts. */
  headline: string;
  concern: string;
  remedy: string;
  rewriteGuidance: string;
};

/** One line of the score's arithmetic. Every point lost has one of these. */
export type Deduction = {
  ruleId: string;
  ruleTitle: string;
  severity: Severity;
  /** 1 for the first trip of this rule, 2 for the second, and so on. */
  occurrence: number;
  points: number;
  reason: string;
};

export type ScoreBand = "clear" | "review" | "rework";

export type Score = {
  /** 0–100. Presentation — number, letter or three-state — is still open. */
  value: number;
  band: ScoreBand;
  deductions: Deduction[];
};

export type ScanInput = {
  /** The copy being scanned, already reduced to text. */
  text: string;
  /** Where it came from, for the record on the score page. */
  source: { kind: "url" | "paste" | "upload"; reference?: string };
  jurisdictions: Jurisdiction[];
};

export type ScanResult = {
  source: ScanInput["source"];
  jurisdictions: Jurisdiction[];
  /** Pack versions this scan ran under, so a score page can say what it checked. */
  packVersions: Record<string, string>;
  claims: Claim[];
  findings: Finding[];
  /**
   * The headline score: the *lowest* of the per-jurisdiction scores, not a sum
   * and not an average.
   *
   * The alternative — one pool of findings across every selected market —
   * means a brand selling into three countries scores worse than the same
   * copy sold into one, because the same phrase is counted once per pack. That
   * makes scores incomparable between brands and quietly penalises the
   * customers with the most to lose. Taking the weakest market instead keeps
   * the number meaning one thing: how this copy reads where it reads worst.
   */
  score: Score;
  /** The arithmetic per market, which is what the jurisdiction chips render. */
  byJurisdiction: Partial<Record<Jurisdiction, Score>>;
  /** The standing disclaimer. Part of the result so no surface can omit it. */
  disclaimer: string;
};
