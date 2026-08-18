/**
 * Australia — the TGA's advertising code, and the ACL as the ACCC reads it.
 *
 * Australia splits the work between two regulators, and which one a page
 * answers to is decided by the page. The TGA governs advertising of
 * therapeutic goods, and a cosmetic that claims a therapeutic effect is
 * advertising a therapeutic good whether or not it is listed as one. The ACCC
 * enforces the Australian Consumer Law across everything else, and since 2023
 * has run a sustained greenwashing programme with published guidance and
 * litigated outcomes behind it.
 *
 * This is the founder's home market and the one where the underlying knowledge
 * is deepest, which is why it carries the sharpest rules in the corpus rather
 * than the most.
 */

import type { Rule, RulePack } from "../engine/types.js";

const ADVERTISING_CODE = "Therapeutic Goods Advertising Code 2021";
const ACL = "Australian Consumer Law (Competition and Consumer Act 2010, Sch 2)";
const ACCC_GREEN = "ACCC, Making environmental claims: a guide for business (2023)";

const rules: Rule[] = [
  {
    id: "au-tga-serious-condition",
    title: "A serious condition named in the copy",
    jurisdiction: "AU",
    categories: ["efficacy", "clinical"],
    severity: "high",
    modality: "likely_to_be_flagged",
    citation: { instrument: ADVERTISING_CODE, locator: "restricted and prohibited representations" },
    instrumentSays:
      "The Code treats representations about serious forms of disease, condition, ailment or defect " +
      "as restricted: they need the TGA's permission before they appear in advertising directed to " +
      "the public, and some representations are not available at all.",
    concern:
      "Naming a serious condition beside a product is the shape the Code is built around, and it " +
      "is assessed on what the advertisement conveys rather than on whether the sentence was meant " +
      "as a claim.",
    remedy:
      "Take the condition out of the copy. Where the product genuinely holds an approval, cite the " +
      "approval rather than restating the effect.",
    rewriteGuidance:
      "Remove the condition and rebuild the sentence around the everyday experience the customer " +
      "recognises. Do not substitute a euphemism that carries the same meaning.",
    match: {
      kind: "pattern",
      source:
        "\\b(cancer|tumou?rs?|diabetes|heart disease|stroke|alzheimer'?s|dementia|depression|anxiety disorder|arthritis|osteoporosis|infertility|hiv|hepatitis|epilepsy|asthma)\\b",
      flags: "i",
    },
  },
  {
    id: "au-tga-cosmetic-crossing-into-therapeutic",
    title: "Cosmetic copy claiming a therapeutic effect",
    jurisdiction: "AU",
    categories: ["efficacy"],
    severity: "high",
    modality: "likely_to_be_flagged",
    citation: { instrument: ADVERTISING_CODE, locator: "advertising of therapeutic goods to the public" },
    instrumentSays:
      "Whether a product is a cosmetic or a therapeutic good turns in part on the claims made for " +
      "it. Copy that claims to treat, prevent or alleviate a condition brings the product inside " +
      "the therapeutic goods framework and its advertising requirements.",
    concern:
      "This wording carries a therapeutic meaning while sitting on a page that is set up as a " +
      "cosmetic one. Two sets of requirements then apply at once, and the page satisfies the " +
      "second by accident if at all.",
    remedy:
      "Rewrite towards appearance and feel, or complete the therapeutic-goods path for the product " +
      "deliberately rather than arriving there through a product description.",
    rewriteGuidance:
      "Recast each therapeutic verb as an appearance or sensory observation. Keep the specificity " +
      "the copy has — vague replacements read as evasive and sell worse.",
    match: {
      kind: "phrase",
      any: [
        "heals",
        "healing",
        "treats",
        "treatment for",
        "cures",
        "relieves",
        "relief from",
        "anti-inflammatory",
        "antibacterial",
        "antiseptic",
        "repairs the skin barrier",
        "restores the skin barrier",
        "medicated",
      ],
      unless: ["heals over time with", "healing crystals"],
    },
  },
  {
    id: "au-tga-indication-outside-permitted-list",
    title: "Health indication phrased outside the permitted wording",
    jurisdiction: "AU",
    categories: ["efficacy"],
    severity: "medium",
    modality: "narrowing_suggested",
    citation: {
      instrument: "Therapeutic Goods (Permissible Indications) Determination",
      locator: "indications available to listed medicines",
    },
    instrumentSays:
      "A listed medicine may only carry indications drawn from the permissible indications list, " +
      "and the list is worded conservatively: maintain, support, assist, help — rather than boost, " +
      "increase or enhance.",
    concern:
      "'Boosts immunity' and 'maintains immune system health' describe the same product. Only one " +
      "of them is drawn from the list, and the difference is the verb rather than the evidence.",
    remedy:
      "Move the verb to the maintain-or-support family and keep the rest of the sentence as it is.",
    rewriteGuidance:
      "Substitute the permitted verb, preserve every other word, and never widen the body system " +
      "referred to while doing it.",
    match: {
      kind: "pattern",
      source:
        "\\b(boosts?|boosting|increases?|enhances?|supercharges?|maximis[ez]es?)\\b[^.!?]{0,30}\\b(immunity|immune system|metabolism|collagen production|energy levels|gut health|testosterone|hormones?)\\b",
      flags: "i",
    },
  },
  {
    id: "au-accc-generic-green-claim",
    title: "Green claim with nothing behind it in the copy",
    jurisdiction: "AU",
    categories: ["environmental"],
    severity: "high",
    modality: "likely_to_be_flagged",
    citation: { instrument: ACCC_GREEN, locator: "principle 1 — make accurate and truthful claims" },
    instrumentSays:
      "The ACCC's guidance asks businesses to make claims that are accurate and truthful, to have " +
      "evidence to back them up, and to avoid broad and unqualified environmental language. The " +
      "ACL provisions behind it are ss 18 and 29 — misleading or deceptive conduct, and false or " +
      "misleading representations about a product's characteristics.",
    concern:
      "Greenwashing is the ACCC's stated enforcement priority and the sweeps that produced it read " +
      "product pages, not annual reports. Broad green adjectives on a PDP are the exact artefact " +
      "those sweeps collect.",
    remedy:
      "Say the specific thing and be ready to show it — the material, the proportion, the scheme, " +
      "the part of the product.",
    rewriteGuidance:
      "Replace the adjective with the substantiated specific. Where the brand has supplied no " +
      "specific, cut the claim rather than qualifying it into vagueness.",
    match: {
      kind: "phrase",
      any: [
        "eco friendly",
        "eco-friendly",
        "environmentally friendly",
        "sustainable",
        "green",
        "kind to the planet",
        "planet friendly",
        "earth friendly",
      ],
      unless: [
        "sustainably sourced from",
        "green tea",
        "green clay",
        "green apple",
        "green tomato",
        "matcha",
      ],
    },
  },
  {
    id: "au-accc-offsetting-neutrality",
    title: "Neutrality claim without the basis named",
    jurisdiction: "AU",
    categories: ["environmental"],
    severity: "medium",
    modality: "requires_substantiation",
    citation: { instrument: ACCC_GREEN, locator: "principles 4 and 6 — explain conditions and substantiate" },
    instrumentSays:
      "The guidance asks that any qualifications and conditions a claim depends on be explained, " +
      "and that the claim rest on evidence a business can produce. Carbon-neutrality claims sit " +
      "squarely inside that, and the certification most Australian brands rely on is Climate Active.",
    concern:
      "A neutrality claim with no scheme, boundary or period named is the version the ACCC's own " +
      "greenwashing sweep singled out, and it has been litigated here.",
    remedy:
      "Name the scheme and the scope — which emissions, which period, certified by whom — beside " +
      "the claim itself.",
    rewriteGuidance:
      "Add scheme and scope where the brand has them. Where they are absent, convert to a " +
      "reduction statement with a figure, or remove.",
    match: {
      kind: "phrase",
      any: ["carbon neutral", "climate neutral", "net zero", "carbon positive", "climate positive"],
      unless: ["climate active", "certified by", "scope 1", "scope 2", "scope 3"],
    },
  },
  {
    id: "au-accc-superlative-without-basis",
    title: "Superlative or ranking used without a basis",
    jurisdiction: "AU",
    categories: ["efficacy"],
    severity: "medium",
    modality: "may_be_unsubstantiated",
    citation: { instrument: ACL, locator: "s 29(1)(g) — false or misleading representations" },
    instrumentSays:
      "The ACL addresses representations that goods have performance characteristics, uses or " +
      "benefits they do not have. A ranking or superlative is such a representation, and the " +
      "business making it is expected to hold the comparison behind it.",
    concern:
      "'Australia's number one' is a factual assertion about a market, and the question that " +
      "follows is always the same: measured how, over what period, against whom.",
    remedy:
      "Attach the measure and the source, or move to a claim about the brand's own customers " +
      "rather than the category.",
    rewriteGuidance:
      "Add the measure and source when supplied. Otherwise replace the ranking with a first-person " +
      "statement — bestselling within the brand's own range, and say so.",
    match: {
      kind: "pattern",
      source:
        "\\b(australia['\u2019]?s|the world['\u2019]?s|the)\\s+(number\\s*one|no\\.?\\s*1|#1|best|most effective|strongest|fastest)\\b",
      flags: "i",
    },
  },
  {
    id: "au-accc-free-from-implying-harm",
    title: "'Free from' implying the alternatives are unsafe",
    jurisdiction: "AU",
    categories: ["free_from"],
    severity: "low",
    modality: "narrowing_suggested",
    citation: { instrument: ACL, locator: "ss 18 and 29 — overall impression conveyed" },
    instrumentSays:
      "Conduct is assessed on the overall impression created, including impressions conveyed by " +
      "implication rather than stated outright.",
    concern:
      "A list of excluded ingredients under a heading like 'no nasties' says something about every " +
      "product that contains them. That implied comparison is part of what the copy conveys, and " +
      "it is assessed as such.",
    remedy:
      "Keep the exclusion list, which is useful and true, and drop the framing that grades the " +
      "excluded ingredients.",
    rewriteGuidance:
      "Retain the list verbatim and neutralise the heading above it. Do not add a safety assertion " +
      "in its place.",
    match: {
      kind: "phrase",
      any: ["no nasties", "free from nasties", "nothing nasty", "no harsh chemicals", "toxin free", "clean formula"],
    },
  },
];

export const auPack: RulePack = {
  jurisdiction: "AU",
  version: "2026.08.1",
  label: "AU — TGA Advertising Code and ACCC environmental-claims enforcement",
  rules,
};
