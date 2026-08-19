/**
 * Did the rewrite invent evidence?
 *
 * CLAUDE.md: "Never invent a study, a figure, a sample size or a certification
 * when drafting a rewrite. A rewrite that fabricates evidence is the single
 * worst thing this product could ship." This file is that sentence, checked.
 *
 * The failure it guards is specific and very easy to reach. Ask a model to
 * make "clinically proven to reduce fine lines" defensible and the helpful
 * thing to write is "in a 12-week study, 87% of users reported smoother
 * skin" — which is a better sentence, clears the rule, and is a claim the
 * brand cannot support and did not make. The brand then publishes it, on our
 * advice, on a card carrying our mark.
 *
 * So the test is not "does this look substantiated". It is: **every piece of
 * evidence in the rewrite must already have been in the original.** A rewrite
 * may delete evidence, keep it, or reword around it. It may never add any.
 *
 * Deliberately over-broad. A false positive costs one rejected draft and a
 * retry; a false negative costs a brand a claim it cannot defend.
 *
 * The one exception is a placeholder — see `PLACEHOLDER` below. A blank the
 * brand is asked to fill is the honest answer where the fix needs a fact only
 * they have, and it is what stops "never invent" collapsing into "always
 * delete the claim".
 */

/** A specific thing a rewrite may not introduce. */
export type Evidence = {
  kind: "figure" | "duration" | "scheme" | "study" | "ranking";
  /** Normalised for comparison — lowercased, whitespace collapsed. */
  token: string;
};

/**
 * Certification and standards names. Naming one the brand does not hold is
 * the most expensive fabrication available: it is checkable, it is somebody
 * else's mark, and it turns a wording problem into a false claim of
 * accreditation.
 */
const SCHEMES = [
  "cosmos",
  "ecocert",
  "b corp",
  "bcorp",
  "leaping bunny",
  "peta",
  "cruelty free international",
  "soil association",
  "eu ecolabel",
  "nordic swan",
  "usda organic",
  "fairtrade",
  "rainforest alliance",
  "fsc",
  "cradle to cradle",
  "vegan society",
  "climate active",
  "en 13432",
  "astm d6400",
  "iso 14001",
  "oeko-tex",
  "dermatest",
  "allergy certified",
];

/**
 * Words that assert testing happened. A rewrite that adds "in a study" has
 * added a study, whatever else the sentence says.
 */
const STUDY_WORDS = [
  "study",
  "studies",
  "trial",
  "trials",
  "clinical",
  "clinically",
  "participants",
  "volunteers",
  "subjects",
  "panel",
  "in vitro",
  "in vivo",
  "peer reviewed",
  "peer-reviewed",
  "dermatologist",
  "ophthalmologist",
  "laboratory",
  "lab tested",
  "double blind",
  "placebo",
];

/** Assertions about rank or market position, which need a comparison. */
const RANKINGS = [
  "number one",
  "no. 1",
  "no.1",
  "#1",
  "best selling",
  "bestselling",
  "best-selling",
  "award winning",
  "award-winning",
  "market leading",
  "market-leading",
  "voted",
];

const DURATION = /\b\d+\s*(?:-|\s)?\s*(?:second|minute|hour|day|night|week|month|year)s?\b/gi;
// No trailing \b: after "%" there is no word character to bound against, so
// the boundary cut "87%" down to "87" — and a draft could then add a
// percentage to a copy that already mentioned the bare number.
const FIGURE = /\b\d+(?:[.,]\d+)?\s*(?:%|percent|x|×)?/gi;

const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * A blank the brand fills in: `[name your scheme]`, `[the tested figure]`.
 *
 * Some rules cannot be answered without a fact only the brand has — which
 * certification they hold, what the study measured, which component the claim
 * is about. The model must never guess one, and the honest output is a rewrite
 * with the gap marked rather than filled. So placeholders are removed before
 * evidence is counted: `[87%]` is a request, not a claim.
 *
 * It is also the pressure valve that keeps the fabrication check strict. With
 * no way to say "your number goes here", a model asked for a defensible
 * version of "clinically proven" has only two moves — invent a study, or
 * delete the claim — and the first is the one it will reach for.
 */
export const PLACEHOLDER = /\[[^\]]{0,80}\]/g;

const withoutPlaceholders = (text: string) => text.replace(PLACEHOLDER, " ");

function findAll(text: string, needles: string[], kind: Evidence["kind"]): Evidence[] {
  const haystack = normalise(text);
  return needles
    .filter((needle) => haystack.includes(needle))
    .map((needle) => ({ kind, token: needle }));
}

/**
 * Every claim-supporting thing this text asserts.
 *
 * Durations are collected before bare figures and the figures inside them are
 * not collected again, so "28 days" is one piece of evidence rather than two —
 * otherwise a rewrite could keep the number, drop the unit, and look clean.
 */
export function evidenceIn(raw: string): Evidence[] {
  const text = withoutPlaceholders(raw);
  const found: Evidence[] = [];
  const durations = [...text.matchAll(DURATION)].map((m) => m[0]);
  const claimedByDuration = new Set(durations.flatMap((d) => [...d.matchAll(FIGURE)].map((m) => normalise(m[0]))));

  for (const duration of durations) found.push({ kind: "duration", token: normalise(duration) });
  for (const match of text.matchAll(FIGURE)) {
    const token = normalise(match[0]);
    if (!token || claimedByDuration.has(token)) continue;
    found.push({ kind: "figure", token });
  }
  found.push(...findAll(text, SCHEMES, "scheme"));
  found.push(...findAll(text, STUDY_WORDS, "study"));
  found.push(...findAll(text, RANKINGS, "ranking"));

  const seen = new Set<string>();
  return found.filter((item) => {
    const key = `${item.kind}::${item.token}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Evidence the rewrite asserts that the original did not.
 *
 * Compared against the original *claim plus its surrounding context*, because
 * a rewrite is allowed to pull a figure the brand already published a line
 * further up the page — that is not invention, it is the fix the remedy asks
 * for. It is only fabrication when the number exists nowhere on the page.
 */
export function fabricatedEvidence(original: string, rewrite: string): Evidence[] {
  const had = new Set(evidenceIn(original).map((item) => `${item.kind}::${item.token}`));
  return evidenceIn(rewrite).filter((item) => !had.has(`${item.kind}::${item.token}`));
}

/** One line for a person, or null when the rewrite invented nothing. */
export function fabricationReason(fabricated: Evidence[]): string | null {
  if (fabricated.length === 0) return null;
  const listed = fabricated.map((item) => `${item.kind} "${item.token}"`).join(", ");
  return `introduces evidence the copy does not contain: ${listed}`;
}
