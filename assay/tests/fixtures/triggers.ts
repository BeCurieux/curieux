/**
 * One line of copy that should trip each rule, and one that should not.
 *
 * Every rule in the corpus needs an entry here, and corpus.test.ts fails if
 * one is missing. That is the only defence against the failure mode this kind
 * of product dies of: a rule that reads beautifully on the score page, cites a
 * real instrument, and has never matched anything in its life.
 *
 * The quiet lines are the more valuable half. Each is the same claim written
 * the way the rule is asking for, so the pair doubles as documentation of what
 * a good rewrite looks like — and as proof that the rewrite actually clears
 * the rule rather than only sounding better.
 */

export type TriggerFixture = { trips: string; quiet: string };

export const TRIGGERS: Record<string, TriggerFixture> = {
  // ------------------------------------------------------------------ EU
  "eu-ecgt-generic-environmental": {
    trips: "An eco-friendly serum, made in small batches.",
    quiet: "A serum made in small batches, 92% bio-based by weight.",
  },
  "eu-ecgt-offset-neutrality": {
    trips: "Every order ships carbon neutral.",
    quiet: "Shipping emissions are down 41% against our 2023 baseline.",
  },
  "eu-ecgt-legal-requirement-as-feature": {
    trips: "Cruelty free, always — unlike the big houses.",
    quiet: "Cruelty free, certified by Leaping Bunny.",
  },
  "eu-ecgt-self-made-sustainability-label": {
    trips: "Look for our sustainability seal on the pack.",
    quiet: "Our sustainability seal is awarded under COSMOS Organic.",
  },
  "eu-ecgt-whole-product-from-one-part": {
    trips: "Fully recyclable, inside and out.",
    quiet: "The outer carton is recyclable.",
  },
  "eu-ecgt-future-commitment": {
    trips: "We will be plastic free by 2027.",
    quiet: "Our refill programme has replaced 40,000 bottles since 2025.",
  },
  "eu-ecgt-vague-degradability": {
    trips: "The formula is biodegradable.",
    quiet: "Biodegradable in industrial composting within 90 days, to EN 13432.",
  },

  // ------------------------------------------------------------------ US
  "us-fda-disease-claim": {
    trips: "Clears acne without the sting.",
    quiet: "Leaves congested skin looking calmer and less shiny.",
  },
  "us-ftc-proven-efficacy": {
    trips: "Clinically proven to reduce fine lines.",
    quiet: "In a 12-week study of 42 women, 87% reported smoother-looking skin.",
  },
  "us-ftc-establishment-tested": {
    trips: "Dermatologist tested for sensitive skin.",
    quiet: "Assessed for skin tolerance on 30 volunteers over four weeks.",
  },
  "us-ftc-typical-results": {
    trips: "In 7 days my dark spots were gone.",
    quiet: "I have used it every morning since March and I would not swap it.",
  },
  "us-ftc-general-environmental-benefit": {
    trips: "An eco-friendly formula from an eco-friendly brand.",
    quiet: "A formula with 92% naturally derived ingredients.",
  },
  "us-ftc-free-of-and-non-toxic": {
    trips: "100% natural and non-toxic.",
    quiet: "Formulated without parabens, sulfates or synthetic fragrance.",
  },
  "us-ftc-recyclable-unqualified": {
    trips: "The bottle is recyclable.",
    quiet: "The bottle is recyclable where facilities exist.",
  },

  // ------------------------------------------------------------------ AU
  "au-tga-serious-condition": {
    trips: "A gentle daily ritual for hands living with arthritis.",
    quiet: "A gentle daily ritual for hands that ache after a long day.",
  },
  "au-tga-cosmetic-crossing-into-therapeutic": {
    trips: "Heals cracked skin overnight.",
    quiet: "Softens and comforts cracked-looking skin overnight.",
  },
  "au-tga-indication-outside-permitted-list": {
    trips: "Boosts immunity through winter.",
    quiet: "Maintains immune system health through winter.",
  },
  "au-accc-generic-green-claim": {
    trips: "A sustainable skincare ritual.",
    quiet: "Our green tea extract is grown on one farm in Uji.",
  },
  "au-accc-offsetting-neutrality": {
    trips: "Every parcel we send is carbon neutral.",
    quiet: "Every parcel we send is carbon neutral, certified under Climate Active.",
  },
  "au-accc-superlative-without-basis": {
    trips: "Australia's number one retinol.",
    quiet: "Our own bestselling retinol, three years running.",
  },
  "au-accc-free-from-implying-harm": {
    trips: "No nasties, ever.",
    quiet: "No parabens, no phthalates, no added fragrance.",
  },
};
