/**
 * United States — FTC substantiation, the Green Guides, and the line the FDA
 * draws around disease.
 *
 * Three instruments do most of the work on a beauty or supplement page. The
 * FTC's Health Products Compliance Guidance (2022) sets what evidence an
 * efficacy claim has to be resting on before it is made. The Green Guides
 * (16 CFR Part 260) do the same for environmental claims and are unusually
 * specific about wording. And the Federal Food, Drug, and Cosmetic Act
 * decides, by what the page says rather than by what is in the bottle, whether
 * a product is being sold as a drug.
 *
 * The third is the one that surprises brands, so it is the first rule here.
 * A cosmetic becomes a drug in the FDA's reading when its marketing claims an
 * effect on the structure or function of the body or on a disease — the
 * ingredients need not change at all.
 *
 * Green Guides section numbers are cited directly because that part is stable.
 * They still want a pass from counsel before launch, along with everything
 * else in this corpus; see README.md.
 */

import type { Rule, RulePack } from "../engine/types.js";

const HEALTH_GUIDANCE = "FTC Health Products Compliance Guidance (2022)";
const GREEN_GUIDES = "FTC Green Guides, 16 CFR Part 260";
const ENDORSEMENT_GUIDES = "FTC Endorsement Guides, 16 CFR Part 255";
const FDCA = "Federal Food, Drug, and Cosmetic Act";

const rules: Rule[] = [
  {
    id: "us-fda-disease-claim",
    title: "Disease language on a product sold as a cosmetic or supplement",
    jurisdiction: "US",
    categories: ["efficacy", "clinical"],
    severity: "high",
    modality: "likely_to_be_flagged",
    citation: { instrument: FDCA, locator: "§201(g)(1) — intended use establishes drug status" },
    instrumentSays:
      "Under the FDCA a product's intended use is established by its marketing. A claim to treat, " +
      "cure, prevent or mitigate a disease makes the product a drug for regulatory purposes, " +
      "whatever its formulation, and drugs need approval before they are sold.",
    concern:
      "This is the wording that moves a product across the cosmetic-or-supplement line by itself. " +
      "It is also the language Meta and TikTok screen hardest, so the commercial cost usually " +
      "arrives as a disapproved ad long before anything official does.",
    remedy:
      "Describe the appearance, feel or maintenance benefit instead of the condition — what a " +
      "customer sees and experiences, rather than what the product does to a diagnosis.",
    rewriteGuidance:
      "Move the sentence from clinical to observational. Keep the customer benefit and the brand's " +
      "voice; drop the condition name and every treat/cure/prevent verb. Do not swap in a synonym " +
      "for the same medical meaning.",
    /** The worked example the rewriter is shown for this rule. */
    example: {
      trips: "Clears acne without the sting.",
      quiet: "Leaves congested skin looking calmer and less shiny.",
    },
    match: {
      kind: "any",
      of: [
        {
          kind: "pattern",
          source:
            "\\b(treats?|treating|cures?|curing|prevents?|preventing|heals?|healing|clears?|clearing|reverses?|reversing)\\b[^.!?]{0,40}\\b(acne|eczema|psoriasis|rosacea|dermatitis|cancer|arthritis|depression|anxiety|diabetes|insomnia|migraines?|infections?|inflammation)\\b",
          flags: "i",
        },
        {
          kind: "phrase",
          any: [
            "acne treatment",
            "eczema treatment",
            "anti-inflammatory",
            "antibacterial",
            "antifungal",
            "clinically treats",
            "medical grade",
            "pharmaceutical grade",
          ],
        },
      ],
    },
  },
  {
    id: "us-ftc-proven-efficacy",
    title: "'Proven' used as the evidence rather than pointing at it",
    jurisdiction: "US",
    categories: ["clinical", "efficacy"],
    severity: "high",
    modality: "requires_substantiation",
    citation: { instrument: HEALTH_GUIDANCE, locator: "competent and reliable scientific evidence" },
    instrumentSays:
      "The FTC expects health-related efficacy claims to rest on competent and reliable scientific " +
      "evidence held before the claim is made — for most such claims, well-controlled human " +
      "clinical testing. The word 'proven' raises what that evidence has to show.",
    concern:
      "'Clinically proven' is read as a specific assertion about a specific study, and the ad " +
      "platforms treat it as one of a small set of trigger phrases. If the study exists the claim " +
      "may be entirely fine; if it is an ingredient study, a consumer panel or a supplier's " +
      "brochure, the wording has outrun it.",
    remedy:
      "Name what was actually run and on whom — the panel size, the duration, the measure — or " +
      "step the word back from 'proven' to what the testing showed.",
    rewriteGuidance:
      "Replace 'proven' with the study's own finding and its cohort where the brand has supplied " +
      "one. Where no study is supplied, rewrite to a consumer-perception or sensory claim and mark " +
      "it as needing the brand's confirmation. Never invent a sample size.",
    /** The worked example the rewriter is shown for this rule. */
    example: {
      trips: "Clinically proven to reduce fine lines.",
      quiet: "In a 12-week study of 42 women, 87% reported smoother-looking skin.",
    },
    match: {
      kind: "phrase",
      any: [
        "clinically proven",
        "scientifically proven",
        "medically proven",
        "proven to reduce",
        "proven to eliminate",
        "proven results",
        "doctor proven",
        "guaranteed results",
      ],
    },
  },
  {
    id: "us-ftc-establishment-tested",
    title: "'Tested' standing in for what the test found",
    jurisdiction: "US",
    categories: ["clinical"],
    severity: "medium",
    modality: "may_be_unsubstantiated",
    citation: { instrument: HEALTH_GUIDANCE, locator: "establishment claims" },
    instrumentSays:
      "A claim that a product has been tested is an establishment claim: it represents that testing " +
      "of a particular kind was done and supports the benefit implied beside it.",
    concern:
      "'Dermatologist tested' says a test happened. It does not say what the test measured or what " +
      "it found, and placed beside a benefit it is read as having found that benefit.",
    remedy:
      "Say what the testing looked at — irritation, comedogenicity, tolerance — and keep it away " +
      "from the sentence making the performance claim.",
    rewriteGuidance:
      "Separate the testing statement from the benefit statement so neither borrows the other's " +
      "authority. Add the measured endpoint if the brand supplied one.",
    /** The worked example the rewriter is shown for this rule. */
    example: {
      trips: "Dermatologist tested for sensitive skin.",
      quiet: "Assessed for skin tolerance on 30 volunteers over four weeks.",
    },
    match: {
      kind: "phrase",
      any: [
        "dermatologist tested",
        "clinically tested",
        "lab tested",
        "allergy tested",
        "ophthalmologist tested",
        "dermatologist approved",
        "dermatologist recommended",
      ],
    },
  },
  {
    id: "us-ftc-typical-results",
    title: "A customer's result shown as the expected one",
    jurisdiction: "US",
    categories: ["efficacy"],
    severity: "medium",
    modality: "may_be_unsubstantiated",
    citation: { instrument: ENDORSEMENT_GUIDES, locator: "16 CFR §255.2 — consumer endorsements" },
    instrumentSays:
      "An endorsement describing the endorser's experience is understood as representative of what " +
      "others will generally achieve. A disclaimer of typicality does not cure a result the " +
      "advertiser cannot substantiate as generally achievable.",
    concern:
      "A number in a testimonial — days, weeks, percentage — is read as the offer, not as one " +
      "person's story, and 'results may vary' underneath has been held not to fix that.",
    remedy:
      "Use the generally achievable result as the headline figure, and keep individual stories to " +
      "the experience rather than the outcome.",
    rewriteGuidance:
      "Retain the customer's voice and remove the quantified outcome, or replace the figure with " +
      "the brand's own substantiated average where one was supplied.",
    /** The worked example the rewriter is shown for this rule. */
    example: {
      trips: "In 7 days my dark spots were gone.",
      quiet: "I have used it every morning since March and I would not swap it.",
    },
    match: {
      kind: "pattern",
      source:
        "\\b(in|within|after|just)\\s+\\d+\\s*(day|days|week|weeks|night|nights|hours?)\\b[^.!?]{0,60}\\b(cleared?|gone|disappeared|transformed|smoother|younger|brighter|lost|dropped)\\b",
      flags: "i",
    },
  },
  {
    id: "us-ftc-general-environmental-benefit",
    title: "Unqualified general environmental benefit claim",
    jurisdiction: "US",
    categories: ["environmental"],
    severity: "medium",
    modality: "likely_to_be_flagged",
    citation: { instrument: GREEN_GUIDES, locator: "16 CFR §260.4 — general environmental benefit claims" },
    instrumentSays:
      "The Green Guides advise marketers not to make unqualified general environmental benefit " +
      "claims, because they are near impossible to substantiate: they suggest the product has no " +
      "negative environmental impact at all.",
    concern:
      "The same phrase that draws the ECGT's attention in Europe is the Green Guides' first " +
      "example here. One rewrite usually settles both markets, which is the argument for fixing it " +
      "once.",
    remedy:
      "Qualify the claim down to the specific benefit, clearly and close to the words themselves " +
      "rather than in a footnote.",
    rewriteGuidance:
      "Attach the specific, substantiated attribute in the same sentence. Keep it to one attribute; " +
      "a list of three reads as the general claim again.",
    /** The worked example the rewriter is shown for this rule. */
    example: {
      trips: "An eco-friendly formula from an eco-friendly brand.",
      quiet: "A formula with 92% naturally derived ingredients.",
    },
    match: {
      kind: "phrase",
      any: [
        "eco friendly",
        "eco-friendly",
        "environmentally friendly",
        "green choice",
        "better for the planet",
        "sustainable choice",
        "earth friendly",
      ],
    },
  },
  {
    id: "us-ftc-free-of-and-non-toxic",
    title: "'Free of' and 'non-toxic' used as reassurance",
    jurisdiction: "US",
    categories: ["free_from"],
    severity: "medium",
    modality: "may_be_unsubstantiated",
    citation: { instrument: GREEN_GUIDES, locator: "16 CFR §§260.9–260.10 — free-of and non-toxic claims" },
    instrumentSays:
      "A free-of claim can mislead even when literally true, including where the substance was " +
      "never used in products of that type. A non-toxic claim is read as safe for people and for " +
      "the environment, and the Green Guides expect competent and reliable scientific evidence for " +
      "both halves of that.",
    concern:
      "'Chemical-free' is the sharpest version, because nothing is. These phrases also travel " +
      "badly: they are what a retailer's claim-substantiation form asks about first.",
    remedy:
      "Name the substances actually excluded, and let the exclusion list carry the reassurance " +
      "instead of a safety adjective.",
    rewriteGuidance:
      "Convert the adjective into the specific exclusion list the brand can evidence. Never carry " +
      "over an implication of safety that the list does not support.",
    /** The worked example the rewriter is shown for this rule. */
    example: {
      trips: "100% natural and non-toxic.",
      quiet: "Formulated without parabens, sulfates or synthetic fragrance.",
    },
    match: {
      kind: "phrase",
      any: [
        "chemical free",
        "toxin free",
        "non toxic",
        "nontoxic",
        "free from nasties",
        "no nasties",
        "completely natural",
        "100% natural",
        "all natural",
      ],
    },
  },
  {
    id: "us-ftc-recyclable-unqualified",
    title: "Recyclable, without saying where",
    jurisdiction: "US",
    categories: ["environmental"],
    severity: "low",
    modality: "narrowing_suggested",
    citation: { instrument: GREEN_GUIDES, locator: "16 CFR §260.12 — recyclable claims" },
    instrumentSays:
      "An unqualified recyclable claim is appropriate where recycling facilities are available to a " +
      "substantial majority of consumers or communities where the item is sold. Otherwise the " +
      "Guides advise qualifying it by the level of availability.",
    concern:
      "Availability is the whole question for a tube, a pump or a mixed-material carton, and it " +
      "differs between the markets a Shopify store ships to.",
    remedy:
      "Qualify by availability — 'recyclable where facilities exist', or the specific programme — " +
      "and say which component it applies to.",
    rewriteGuidance:
      "Add the availability qualifier in the same sentence. Keep the component named if the copy " +
      "already names one.",
    /** The worked example the rewriter is shown for this rule. */
    example: {
      trips: "The bottle is recyclable.",
      quiet: "The bottle is recyclable where facilities exist.",
    },
    // The Guides ask for an availability qualifier and name this wording; the
    // rewrite is the qualifier, and nothing about it needs deciding.
    mechanical: { kind: "qualify", suffix: " where facilities exist" },
    match: {
      kind: "phrase",
      any: ["recyclable", "widely recycled", "fully recyclable"],
      unless: ["where facilities exist", "check locally", "kerbside", "curbside", "not recyclable", "store drop"],
    },
  },
];

export const usFtcPack: RulePack = {
  jurisdiction: "US",
  version: "2026.08.1",
  label: "US — FTC substantiation, Green Guides, and FDA drug-claim boundary",
  rules,
};
