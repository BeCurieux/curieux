/**
 * EU — the Empowering Consumers for the Green Transition Directive.
 *
 * Directive (EU) 2024/825 amends the Unfair Commercial Practices Directive
 * (2005/29/EC) and the Consumer Rights Directive. Member states apply the
 * transposed rules from 27 September 2026, which is the date the launch
 * campaign is built around, and the reason this pack was authored first.
 *
 * What it adds, in the shape that matters to a product page: several green
 * marketing moves that used to be arguable become listed unfair practices,
 * unfair in all circumstances, with no case-by-case balancing available. That
 * is what makes them worth a scanner — the answer stops depending on context
 * the scanner cannot see.
 *
 * On citations. Locators here name the subject of the amended provision
 * rather than the Annex I point number. Point numbering shifts between the
 * directive's own amending text, the consolidated UCPD, and each member
 * state's transposition, and a citation that is precisely wrong is worse on a
 * score page than one that is plainly descriptive. Pinning exact locators —
 * and the per-member-state transposition — is a pass for counsel before
 * launch, tracked in README.md.
 */

import type { Rule, RulePack } from "../engine/types.js";

const ECGT = "Directive (EU) 2024/825 (ECGT)";
const ECGT_URL = "https://eur-lex.europa.eu/eli/dir/2024/825/oj";

const rules: Rule[] = [
  {
    id: "eu-ecgt-generic-environmental",
    title: "Generic environmental claim, standing on its own",
    jurisdiction: "EU",
    categories: ["environmental"],
    severity: "high",
    modality: "likely_to_be_flagged",
    citation: {
      instrument: ECGT,
      locator: "amending UCPD Annex I — generic environmental claims",
      url: ECGT_URL,
    },
    instrumentSays:
      "The ECGT adds generic environmental claims to the list of practices that are unfair in all " +
      "circumstances, unless the trader can demonstrate recognised excellent environmental " +
      "performance relevant to the claim. 'Environmentally friendly', 'eco', 'green', 'kind to the " +
      "planet' and their relatives are the examples the directive itself gives.",
    concern:
      "This is a broad green claim with nothing attached to it. From 27 September 2026 a claim of " +
      "this shape is assessed against demonstrated excellent environmental performance rather than " +
      "against whether it feels fair, and very few products clear that bar.",
    remedy:
      "Replace the general word with the specific thing that is true and measurable — the material, " +
      "the percentage, the certified scheme, the part of the product it applies to.",
    rewriteGuidance:
      "Swap the generic adjective for one concrete, verifiable attribute the brand already holds " +
      "evidence for. Keep the sentence's rhythm and length. Never substitute a different vague word.",
    match: {
      kind: "phrase",
      any: [
        "eco friendly",
        "eco-friendly",
        "environmentally friendly",
        "friendly to the environment",
        "kind to the planet",
        "planet friendly",
        "good for the planet",
        "green product",
        "eco conscious",
        "environmentally conscious",
        "sustainable beauty",
        "consciously made",
      ],
    },
  },
  {
    id: "eu-ecgt-offset-neutrality",
    title: "Neutrality claim resting on offsetting",
    jurisdiction: "EU",
    categories: ["environmental"],
    severity: "high",
    modality: "likely_to_be_flagged",
    citation: {
      instrument: ECGT,
      locator: "amending UCPD Annex I — claims based on emissions offsetting",
      url: ECGT_URL,
    },
    instrumentSays:
      "The ECGT lists as unfair in all circumstances any claim that a product has a neutral, " +
      "reduced or positive environmental impact on emissions where that claim rests on offsetting " +
      "rather than on the product's own lifecycle.",
    concern:
      "'Carbon neutral' and its relatives are the single most enforced phrase in this area, and " +
      "the ECGT closes the offsetting route to them specifically. A page carrying one is worth " +
      "checking against what the number is actually built from.",
    remedy:
      "Say what was reduced and by how much, and describe any offsetting separately and plainly " +
      "rather than as the basis of a neutrality claim.",
    rewriteGuidance:
      "Convert the neutrality assertion into a reduction statement with a figure and a baseline. " +
      "If the brand has no figure, drop the environmental sentence rather than softening it.",
    match: {
      kind: "phrase",
      any: [
        "carbon neutral",
        "climate neutral",
        "co2 neutral",
        "net zero",
        "carbon positive",
        "climate positive",
        "carbon negative",
      ],
    },
  },
  {
    id: "eu-ecgt-legal-requirement-as-feature",
    title: "Legal baseline presented as a distinguishing feature",
    jurisdiction: "EU",
    categories: ["free_from", "environmental"],
    severity: "medium",
    modality: "likely_to_be_flagged",
    citation: {
      instrument: ECGT,
      locator: "amending UCPD Annex I — requirements imposed by law shown as distinctive",
      url: ECGT_URL,
    },
    instrumentSays:
      "Presenting as a distinctive feature something the law already imposes on all products in " +
      "the category is added to Annex I, whose practices are prohibited outright — unfair in all " +
      "circumstances, with no case-by-case assessment available.",
    concern:
      "Cosmetics sold in the EU already sit under the animal-testing ban and the substance " +
      "restrictions in Regulation 1223/2009. Advertising the baseline as a point of difference is " +
      "the specific move this provision names.",
    remedy:
      "Keep the fact if it matters to customers, but frame it as information rather than as an " +
      "advantage over products that are held to the same standard.",
    rewriteGuidance:
      "Rewrite so the statement reads as reassurance about category norms, not as a differentiator. " +
      "Drop comparative framing entirely.",
    match: {
      kind: "phrase",
      any: [
        "cruelty free",
        "never tested on animals",
        "not tested on animals",
        "cfc free",
        "no cfcs",
        "microbead free",
        "no microbeads",
      ],
      unless: ["leaping bunny", "peta approved", "cruelty free international"],
    },
  },
  {
    id: "eu-ecgt-self-made-sustainability-label",
    title: "Sustainability label without an outside scheme behind it",
    jurisdiction: "EU",
    categories: ["environmental"],
    severity: "medium",
    modality: "requires_substantiation",
    citation: {
      instrument: ECGT,
      locator: "amending UCPD Annex I — sustainability labels not based on a certification scheme",
      url: ECGT_URL,
    },
    instrumentSays:
      "Displaying a sustainability label that is not based on a certification scheme, or not " +
      "established by public authorities, is listed as unfair in all circumstances.",
    concern:
      "A badge or seal a brand designed for itself reads to a shopper exactly like one an outside " +
      "body awarded. That is the distinction this provision turns on, and it applies to the graphic " +
      "as much as to the words beside it.",
    remedy:
      "Name the scheme and the body behind any seal shown, or present the commitment as the " +
      "brand's own statement rather than as a mark.",
    rewriteGuidance:
      "If a scheme exists, name it inline. If none does, rewrite the seal's wording into a first-" +
      "person commitment sentence with no badge language.",
    match: {
      kind: "phrase",
      any: [
        "our sustainability seal",
        "our eco seal",
        "our green seal",
        "our sustainability badge",
        "sustainability approved",
        "eco approved",
        "planet approved",
        "green certified",
        "eco certified",
      ],
      unless: ["cosmos", "ecocert", "b corp", "soil association", "eu ecolabel", "nordic swan"],
    },
  },
  {
    id: "eu-ecgt-whole-product-from-one-part",
    title: "Whole-product claim built from one component",
    jurisdiction: "EU",
    categories: ["environmental"],
    severity: "medium",
    modality: "narrowing_suggested",
    citation: {
      instrument: ECGT,
      locator: "amending UCPD Annex I — claims about the entire product based on one aspect",
      url: ECGT_URL,
    },
    instrumentSays:
      "Making an environmental claim about the whole product, or the trader's whole business, when " +
      "it concerns only a particular aspect, is listed as unfair in all circumstances.",
    concern:
      "Recyclable packaging is a fact about the carton. Stated without the carton, it becomes a " +
      "claim about the product, which is a different and larger claim than the evidence supports.",
    remedy:
      "Attach the claim to the part it belongs to — the carton, the bottle, the outer film — in the " +
      "same sentence.",
    rewriteGuidance:
      "Insert the specific component the claim applies to. Keep every other word. If the component " +
      "is unknown, mark the sentence for the brand to complete rather than picking one.",
    match: {
      kind: "phrase",
      any: ["recyclable", "compostable", "biodegradable", "plastic free", "zero waste"],
      // The component has to be near the claim, not merely somewhere on the
      // page: "recyclable" in the hero is a claim about the product even when
      // the word "carton" appears four hundred words below in the shipping tab.
      unless: ["packaging", "carton", "bottle", "tube", "outer", "box", "wrap", "film", "cap", "jar", "pouch", "label"],
      window: 60,
    },
  },
  {
    id: "eu-ecgt-future-commitment",
    title: "Future environmental commitment with no plan attached",
    jurisdiction: "EU",
    categories: ["environmental"],
    severity: "medium",
    modality: "requires_substantiation",
    citation: {
      instrument: ECGT,
      locator: "amending UCPD Annex I — claims about future environmental performance",
      url: ECGT_URL,
    },
    instrumentSays:
      "A claim about future environmental performance needs clear, objective, publicly available " +
      "and verifiable commitments, a detailed and realistic implementation plan, and independent " +
      "third-party monitoring of progress.",
    concern:
      "A dated pledge on a product page is read as a commitment rather than an aspiration, and the " +
      "directive attaches three specific things to it — the plan, the publication and the outside " +
      "monitor.",
    remedy:
      "Link the pledge to the published plan and name who verifies progress, or move the pledge off " +
      "the product page and onto a page that carries all three.",
    rewriteGuidance:
      "Keep the pledge only if a linkable plan exists; otherwise rewrite it as a description of " +
      "what the brand does today. Never invent a target year.",
    match: {
      kind: "pattern",
      source: "\\b(net[\\s-]?zero|carbon[\\s-]?neutral|plastic[\\s-]?free|fully sustainable)\\b[^.]{0,60}\\b(by|before)\\s+20\\d{2}",
      flags: "i",
    },
  },
  {
    id: "eu-ecgt-vague-degradability",
    title: "Degradability stated without conditions or timeframe",
    jurisdiction: "EU",
    categories: ["environmental"],
    severity: "low",
    modality: "may_be_unsubstantiated",
    citation: {
      instrument: ECGT,
      locator: "amending UCPD Article 6 — environmental claims that mislead as to characteristics",
      url: ECGT_URL,
    },
    instrumentSays:
      "The ECGT extends the misleading-actions test to environmental claims, which brings the " +
      "conditions a claim depends on inside the assessment of whether the claim itself misleads.",
    concern:
      "'Biodegradable' describes an outcome under conditions. Without the conditions and the " +
      "timeframe, the shopper supplies their own — usually a home compost bin and a few weeks.",
    remedy:
      "State the environment and the period: industrial composting, home composting, marine, and " +
      "how long under which standard.",
    rewriteGuidance:
      "Add the conditions and the standard when the brand has them. When they are missing, narrow " +
      "the word rather than deleting the sentence.",
    match: {
      kind: "phrase",
      any: ["biodegradable", "degrades naturally", "breaks down naturally", "returns to the earth"],
      unless: ["en 13432", "astm d6400", "industrial compost", "home compost", "within", "days", "months"],
    },
  },
];

export const euEcgtPack: RulePack = {
  jurisdiction: "EU",
  version: "2026.08.1",
  label: "EU — Empowering Consumers for the Green Transition (from 27 September 2026)",
  rules,
};
