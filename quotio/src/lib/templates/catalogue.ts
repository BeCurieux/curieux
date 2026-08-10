// The launch template library (brief §23).
//
// "Each template should be genuinely functional. Not screenshots." Every one
// below is a real widget document: it is parsed through the same Zod schema as
// AI output and user edits at module load, so a typo here is an import-time
// crash rather than a broken gallery card in production.
//
// A note on pricing shape, because it decides whether a customer gets an
// itemised breakdown (§19). The engine can only itemise a formula honestly
// when each question contributes independently — `bedrooms * 35 + extras`.
// Percentage multipliers and per-head maths (`guests * catering`) are real
// pricing models, but a marginal-contribution breakdown of them double-counts,
// so the engine declines to show one. Templates that want a breakdown are
// therefore written additively, with discounts as negative option values.

import { widgetSchemaSchema, type WidgetDocument, type WidgetType } from "@/lib/widget/schema";
import type { IllustrationKey } from "@/lib/widget/illustrations";

export interface TemplateDefinition {
  slug: string;
  name: string;
  type: WidgetType;
  /** One line for the gallery card (§24). */
  tagline: string;
  /** Who it's for — shown on the template detail page. */
  audience: string;
  illustration: IllustrationKey;
  document: WidgetDocument;
}

/** Parses at import time: a malformed template can never reach the gallery. */
function template(
  meta: Omit<TemplateDefinition, "document">,
  document: unknown
): TemplateDefinition {
  return { ...meta, document: widgetSchemaSchema.parse(document) };
}

const PRIVACY = "Your info is safe with us. No spam, ever.";

/* ------------------------------------------------------------------ */

const cleaning = template(
  {
    slug: "cleaning-estimate",
    name: "Cleaning Estimate",
    type: "estimator",
    tagline: "Turn “how much do you charge?” into a price in 30 seconds.",
    audience: "Domestic and commercial cleaning companies",
    illustration: "bucket",
  },
  {
    name: "Cleaning Estimate",
    type: "estimator",
    intro: {
      heading: "Get your cleaning estimate",
      description: "Five quick questions. No phone call, no waiting for a quote by email.",
      buttonLabel: "Get my estimate",
      illustration: "bucket",
    },
    steps: [
      {
        id: "home_type",
        title: "What are we cleaning?",
        description: "This sets the base rate for the visit.",
        input: {
          kind: "choice",
          columns: 3,
          options: [
            { id: "apartment", label: "Apartment", value: 40, illustration: "window" },
            { id: "house", label: "House", value: 60, illustration: "house" },
            { id: "office", label: "Office", value: 80, illustration: "people" },
          ],
        },
      },
      {
        id: "bedrooms",
        title: "How many bedrooms?",
        description: "We use this to estimate the time and the resources.",
        input: {
          kind: "choice",
          columns: 3,
          options: [
            { id: "b1", label: "1 bedroom", value: 1, illustration: "bed" },
            { id: "b2", label: "2 bedrooms", value: 2, illustration: "bed" },
            { id: "b3", label: "3 bedrooms", value: 3, illustration: "bed" },
            { id: "b4", label: "4 bedrooms", value: 4, illustration: "bed" },
            { id: "b5", label: "5+ bedrooms", value: 5, illustration: "bed" },
            { id: "b0", label: "Not sure", value: 2, illustration: "question" },
          ],
        },
      },
      {
        id: "bathrooms",
        title: "And bathrooms?",
        input: {
          kind: "choice",
          columns: 3,
          options: [
            { id: "r1", label: "1", value: 1, illustration: "bath" },
            { id: "r2", label: "2", value: 2, illustration: "bath" },
            { id: "r3", label: "3", value: 3, illustration: "bath" },
            { id: "r4", label: "4+", value: 4, illustration: "bath" },
          ],
        },
      },
      {
        id: "extras",
        title: "Anything extra?",
        description: "Pick as many as you like.",
        required: false,
        input: {
          kind: "choice",
          multiple: true,
          columns: 2,
          options: [
            { id: "oven", label: "Inside the oven", value: 30, illustration: "oven" },
            { id: "windows", label: "Inside windows", value: 25, illustration: "window" },
            { id: "fridge", label: "Inside the fridge", value: 20, illustration: "box" },
            { id: "laundry", label: "Laundry & ironing", value: 15, illustration: "droplet" },
          ],
        },
      },
      {
        id: "frequency",
        title: "How often?",
        description: "Regular visits are cheaper — the place stays on top of itself.",
        input: {
          kind: "choice",
          columns: 3,
          options: [
            { id: "once", label: "One-off", value: 0, illustration: "calendar" },
            { id: "fortnightly", label: "Fortnightly", description: "Save $10", value: -10, illustration: "calendar" },
            { id: "weekly", label: "Weekly", description: "Save $15", value: -15, illustration: "calendar" },
          ],
        },
      },
    ],
    logic: [
      {
        id: "large-home",
        label: "Large home (5+ bedrooms)",
        when: { field: "bedrooms", operator: ">=", value: 5 },
        then: { add: 40, message: "Large homes are quoted for two cleaners." },
      },
    ],
    result: {
      kind: "range",
      heading: "Your estimated price",
      description: "Every home is different. This is a ballpark based on what you told us.",
      expression: "total + home_type + bedrooms * 35 + bathrooms * 25 + extras + frequency",
      rangeSpread: 0.2,
      bullets: ["Standard cleaning included", "Professional & insured", "All supplies included"],
      cta: { label: "Book my cleaning" },
      disclaimer: "This is an indicative estimate. We'll confirm your exact price before booking.",
    },
    theme: { preset: "playful", brandColour: "#5B5FEF", radius: "l", buttonStyle: "filled" },
    settings: {
      leadCapture: {
        mode: "after",
        fields: ["name", "email", "phone"],
        heading: "Want us to hold this price?",
        description: "Leave your details and we'll be in touch within a day.",
      },
      privacyNote: PRIVACY,
    },
  }
);

const photography = template(
  {
    slug: "photography-quote",
    name: "Photography Quote",
    type: "estimator",
    tagline: "Stop rewriting the same quote email every week.",
    audience: "Wedding, portrait and brand photographers",
    illustration: "camera",
  },
  {
    name: "Photography Quote",
    type: "estimator",
    intro: {
      heading: "Let's price your shoot",
      description: "Answer five questions and see a real number — not “packages from”.",
      buttonLabel: "Start",
      illustration: "camera",
    },
    steps: [
      {
        id: "package",
        title: "What kind of shoot?",
        input: {
          kind: "choice",
          columns: 2,
          options: [
            { id: "portrait", label: "Portrait session", value: 400, illustration: "person" },
            { id: "wedding", label: "Wedding", value: 1500, illustration: "heart" },
            { id: "event", label: "Event", value: 900, illustration: "balloons" },
            { id: "brand", label: "Brand & product", value: 700, illustration: "palette" },
          ],
        },
      },
      {
        id: "hours",
        title: "How many hours of coverage?",
        input: { kind: "slider", min: 2, max: 12, step: 1, suffix: " hours", defaultValue: 6 },
      },
      {
        id: "second_photographer",
        title: "Would you like a second photographer?",
        description: "Two angles on every moment. Recommended above 80 guests.",
        required: false,
        input: { kind: "toggle", onLabel: "Yes, add one", offLabel: "No thanks", illustration: "people" },
      },
      {
        id: "engagement",
        title: "Add an engagement shoot?",
        description: "An hour together before the day, so the camera stops being strange.",
        required: false,
        hidden: true,
        input: { kind: "toggle", onLabel: "Yes please", offLabel: "Not this time", illustration: "camera" },
      },
      {
        id: "travel",
        title: "How far are we travelling?",
        description: "Miles from the city centre. Leave it at zero if you're local.",
        required: false,
        input: { kind: "number", min: 0, max: 400, step: 5, suffix: "miles", defaultValue: 0 },
      },
    ],
    logic: [
      {
        id: "wedding-extras",
        label: "Weddings get the engagement-shoot option",
        when: { field: "package", operator: "=", value: 1500 },
        then: { show: "engagement" },
      },
    ],
    result: {
      kind: "value",
      heading: "Your shoot, roughly",
      description: "Includes editing and an online gallery you can share.",
      expression:
        "total + package + hours * 120 + second_photographer * 350 + engagement * 300 + travel * 2",
      bullets: ["Edited high-resolution images", "Online gallery for a year", "Print release included"],
      cta: { label: "Check my date" },
      disclaimer: "Dates book up fast — this quote holds for 14 days.",
    },
    theme: { preset: "soft", brandColour: "#E8607E", radius: "xl", buttonStyle: "filled" },
    settings: {
      leadCapture: {
        mode: "after",
        fields: ["name", "email", "message"],
        heading: "Tell me about your day",
        description: "I'll come back with availability and the full package details.",
      },
      privacyNote: PRIVACY,
    },
  }
);

const website = template(
  {
    slug: "website-project-quote",
    name: "Website Project Quote",
    type: "estimator",
    tagline: "Qualify enquiries before the discovery call.",
    audience: "Agencies, studios and freelance web designers",
    illustration: "browser",
  },
  {
    name: "Website Project Quote",
    type: "estimator",
    intro: {
      heading: "What's your website going to cost?",
      description: "A real range in under a minute, so we both know if we're a fit.",
      buttonLabel: "Price my project",
      illustration: "browser",
    },
    steps: [
      {
        id: "project_type",
        title: "What are we building?",
        input: {
          kind: "choice",
          columns: 2,
          options: [
            { id: "landing", label: "Landing page", value: 1200, illustration: "cursor" },
            { id: "marketing", label: "Marketing site", value: 3500, illustration: "browser" },
            { id: "store", label: "Online store", value: 6500, illustration: "box" },
            { id: "app", label: "Web app", value: 12000, illustration: "rocket" },
          ],
        },
      },
      {
        id: "pages",
        title: "Roughly how many pages?",
        description: "A best guess is fine.",
        input: { kind: "slider", min: 1, max: 25, step: 1, defaultValue: 6, suffix: " pages" },
      },
      {
        id: "features",
        title: "Anything beyond the basics?",
        required: false,
        input: {
          kind: "choice",
          multiple: true,
          columns: 2,
          options: [
            { id: "blog", label: "Blog or news", value: 600, illustration: "browser" },
            { id: "booking", label: "Online booking", value: 900, illustration: "calendar" },
            { id: "payments", label: "Payments", value: 1200, illustration: "wallet" },
            { id: "languages", label: "Multiple languages", value: 1500, illustration: "people" },
          ],
        },
      },
      {
        id: "design",
        title: "How should it look?",
        input: {
          kind: "choice",
          columns: 2,
          options: [
            { id: "template", label: "Start from a template", description: "Fast and tidy", value: 0, illustration: "browser" },
            { id: "custom", label: "Designed from scratch", description: "Yours alone", value: 2500, illustration: "palette" },
          ],
        },
      },
      {
        id: "timeline",
        title: "When do you need it?",
        input: {
          kind: "choice",
          columns: 2,
          options: [
            { id: "standard", label: "The usual 6–8 weeks", value: 0, illustration: "calendar" },
            { id: "rush", label: "Inside 4 weeks", description: "We'll clear the decks", value: 1500, illustration: "clock" },
          ],
        },
      },
    ],
    result: {
      kind: "range",
      heading: "Your project estimate",
      description: "Design, build, testing and launch. Hosting is separate.",
      expression: "total + project_type + pages * 180 + features + design + timeline",
      rangeSpread: 0.25,
      bullets: ["Fixed price before we start", "Weekly demos, no black box", "Two rounds of revisions"],
      cta: { label: "Book a call" },
      disclaimer: "A proper estimate needs a conversation. This gets us to the right ballpark.",
    },
    theme: { preset: "minimal", brandColour: "#5B5FEF", radius: "m", buttonStyle: "filled" },
    settings: {
      leadCapture: { mode: "after", fields: ["name", "email"], heading: "Send me this estimate" },
      privacyNote: PRIVACY,
    },
  }
);

const roi = template(
  {
    slug: "roi-calculator",
    name: "ROI Calculator",
    type: "calculator",
    tagline: "Let prospects prove your value to themselves.",
    audience: "B2B software, agencies and consultants",
    illustration: "graph",
  },
  {
    name: "ROI Calculator",
    type: "calculator",
    intro: {
      heading: "What would this be worth to you?",
      description: "Four numbers you already know. We'll do the arithmetic.",
      buttonLabel: "Work it out",
      illustration: "graph",
    },
    steps: [
      {
        id: "monthly_spend",
        title: "What would you spend with us each month?",
        input: { kind: "number", min: 0, max: 100000, step: 50, prefix: "$", defaultValue: 500 },
      },
      {
        id: "customers",
        title: "How many new customers would that need to bring you?",
        description: "Per month. Be conservative — the number is more convincing that way.",
        input: { kind: "number", min: 0, max: 1000, step: 1, defaultValue: 4 },
      },
      {
        id: "deal_value",
        title: "What's a customer worth on day one?",
        input: { kind: "number", min: 0, max: 100000, step: 50, prefix: "$", defaultValue: 900 },
      },
      {
        id: "retention_months",
        title: "And how long do they typically stay?",
        input: { kind: "slider", min: 1, max: 36, step: 1, defaultValue: 12, suffix: " months" },
      },
    ],
    result: {
      kind: "value",
      heading: "Your estimated 12-month return",
      description:
        "That's lifetime revenue from a year of new customers, less what you'd spend to get them.",
      expression: "customers * 12 * deal_value * retention_months / 12 - monthly_spend * 12",
      format: { style: "currency", currency: "USD", decimals: 0 },
      bullets: ["Based on your own numbers", "Cancel any time", "No setup fee"],
      cta: { label: "See how it works" },
      showBreakdown: false,
      disclaimer: "Estimates, not promises. Your results depend on your market.",
    },
    theme: { preset: "bold", brandColour: "#1B1F3B", radius: "s", buttonStyle: "filled" },
    settings: {
      leadCapture: { mode: "after", fields: ["name", "email"], heading: "Email me this calculation" },
      privacyNote: PRIVACY,
    },
  }
);

const eventBudget = template(
  {
    slug: "event-budget",
    name: "Event Budget",
    type: "calculator",
    tagline: "Help people plan the party before they ask the price.",
    audience: "Venues, caterers and event planners",
    illustration: "balloons",
  },
  {
    name: "Event Budget",
    type: "calculator",
    intro: {
      heading: "Let's budget your event",
      description: "Move a few sliders and see where the money actually goes.",
      buttonLabel: "Start planning",
      illustration: "balloons",
    },
    steps: [
      {
        id: "guests",
        title: "How many guests?",
        input: { kind: "slider", min: 10, max: 300, step: 5, defaultValue: 80, suffix: " guests" },
      },
      {
        id: "catering",
        title: "What are you feeding them?",
        description: "Per head.",
        input: {
          kind: "choice",
          columns: 3,
          options: [
            { id: "canapes", label: "Canapés", value: 35, illustration: "cake" },
            { id: "buffet", label: "Buffet", value: 55, illustration: "cake" },
            { id: "plated", label: "Plated dinner", value: 85, illustration: "cake" },
          ],
        },
      },
      {
        id: "venue",
        title: "What's the venue costing?",
        description: "Leave it at zero if you've got somewhere free.",
        input: { kind: "number", min: 0, max: 50000, step: 100, prefix: "$", defaultValue: 2500 },
      },
      {
        id: "extras",
        title: "What else do you need?",
        required: false,
        input: {
          kind: "choice",
          multiple: true,
          columns: 2,
          options: [
            { id: "photographer", label: "Photographer", value: 1200, illustration: "camera" },
            { id: "dj", label: "DJ or band", value: 800, illustration: "music" },
            { id: "flowers", label: "Flowers & styling", value: 600, illustration: "plant" },
            { id: "cake", label: "Cake", value: 400, illustration: "cake" },
          ],
        },
      },
    ],
    result: {
      kind: "value",
      heading: "Your event budget",
      description: "Catering is per head, so guest count moves this number more than anything else.",
      expression: "total + venue + guests * catering + extras",
      bullets: ["Everything above included", "No booking fee", "Payment plans available"],
      cta: { label: "Check our availability" },
      disclaimer: "Prices vary by date and season. Ask us for a firm quote.",
    },
    theme: { preset: "playful", brandColour: "#E5A21C", radius: "xl", buttonStyle: "filled" },
    settings: {
      leadCapture: { mode: "after", fields: ["name", "email", "phone"], heading: "Save my plan" },
      privacyNote: PRIVACY,
    },
  }
);

const moving = template(
  {
    slug: "moving-cost-estimate",
    name: "Moving Cost Estimate",
    type: "estimator",
    tagline: "Quote a move without sending anyone round to look.",
    audience: "Removals and man-with-a-van companies",
    illustration: "truck",
  },
  {
    name: "Moving Cost Estimate",
    type: "estimator",
    intro: {
      heading: "What will your move cost?",
      description: "Four questions. No survey visit needed for a ballpark.",
      buttonLabel: "Estimate my move",
      illustration: "truck",
    },
    steps: [
      {
        id: "home_size",
        title: "How big is the place you're leaving?",
        input: {
          kind: "choice",
          columns: 3,
          options: [
            { id: "studio", label: "Studio", value: 350, illustration: "box" },
            { id: "one", label: "1 bedroom", value: 550, illustration: "bed" },
            { id: "two", label: "2 bedrooms", value: 850, illustration: "bed" },
            { id: "three", label: "3 bedrooms", value: 1200, illustration: "house" },
            { id: "four", label: "4+ bedrooms", value: 1600, illustration: "house" },
            { id: "unsure", label: "Not sure", value: 850, illustration: "question" },
          ],
        },
      },
      {
        id: "distance",
        title: "How far are you going?",
        input: { kind: "number", min: 0, max: 3000, step: 10, suffix: "miles", defaultValue: 25 },
      },
      {
        id: "floors",
        title: "Any stairs?",
        input: {
          kind: "choice",
          columns: 3,
          options: [
            { id: "ground", label: "Ground floor", value: 0, illustration: "house" },
            { id: "low", label: "1–2 flights", value: 120, illustration: "house" },
            { id: "high", label: "3+ flights", value: 250, illustration: "house" },
          ],
        },
      },
      {
        id: "packing",
        title: "Want us to pack for you?",
        required: false,
        input: { kind: "toggle", onLabel: "Yes, please pack", offLabel: "I'll pack", illustration: "box" },
      },
      {
        id: "move_day",
        title: "When are you moving?",
        input: {
          kind: "choice",
          columns: 2,
          options: [
            { id: "weekday", label: "A weekday", value: 0, illustration: "calendar" },
            { id: "weekend", label: "A weekend", description: "Busier, so a little more", value: 150, illustration: "calendar" },
          ],
        },
      },
    ],
    result: {
      kind: "range",
      heading: "Your move, estimated",
      expression: "total + home_size + distance * 1.8 + floors + packing * 400 + move_day",
      rangeSpread: 0.15,
      bullets: ["Fully insured", "Blankets and straps included", "No hidden fuel charges"],
      cta: { label: "Get my exact quote" },
      disclaimer: "Final price confirmed after a two-minute video call.",
    },
    theme: { preset: "soft", brandColour: "#2E9C8B", radius: "l", buttonStyle: "filled" },
    settings: {
      leadCapture: { mode: "after", fields: ["name", "email", "phone"], heading: "Book my survey call" },
      privacyNote: PRIVACY,
    },
  }
);

const skincare = template(
  {
    slug: "skincare-finder",
    name: "Skincare Finder",
    type: "quiz",
    tagline: "Send shoppers to the right product instead of the whole catalogue.",
    audience: "Beauty and wellness brands",
    illustration: "droplet",
  },
  {
    name: "Skincare Finder",
    type: "quiz",
    intro: {
      heading: "Find your routine",
      description: "Three questions and we'll point you at the set that suits your skin.",
      buttonLabel: "Find my match",
      illustration: "droplet",
    },
    steps: [
      {
        id: "skin_type",
        title: "How does your skin behave most days?",
        input: {
          kind: "choice",
          columns: 2,
          options: [
            { id: "dry", label: "Tight and dry", value: "dry", illustration: "droplet", scores: { hydrate: 3 } },
            { id: "oily", label: "Shiny by lunchtime", value: "oily", illustration: "sun", scores: { clarity: 3 } },
            { id: "combo", label: "A bit of both", value: "combo", illustration: "heart", scores: { glow: 2, hydrate: 1 } },
            { id: "sensitive", label: "Easily upset", value: "sensitive", illustration: "shield", scores: { calm: 3 } },
          ],
        },
      },
      {
        id: "concerns",
        title: "What would you change first?",
        description: "Pick up to three.",
        input: {
          kind: "choice",
          multiple: true,
          columns: 2,
          options: [
            { id: "dryness", label: "Dryness", value: "dryness", scores: { hydrate: 3 } },
            { id: "dullness", label: "Dullness", value: "dullness", scores: { glow: 3 } },
            { id: "breakouts", label: "Breakouts", value: "breakouts", scores: { clarity: 3 } },
            { id: "lines", label: "Fine lines", value: "lines", scores: { glow: 2, hydrate: 1 } },
            { id: "redness", label: "Redness", value: "redness", scores: { calm: 3 } },
          ],
        },
      },
      {
        id: "effort",
        title: "How much of a routine do you actually want?",
        input: {
          kind: "choice",
          columns: 3,
          options: [
            { id: "minimal", label: "Two steps, tops", value: "minimal", illustration: "clock" },
            { id: "moderate", label: "A few minutes", value: "moderate", illustration: "clock" },
            { id: "full", label: "I enjoy it", value: "full", illustration: "star" },
          ],
        },
      },
    ],
    logic: [
      {
        id: "sensitive-wins",
        label: "Sensitive skin always gets the gentle set",
        when: { field: "skin_type", operator: "=", value: "sensitive" },
        then: { score: { outcome: "calm", points: 4 } },
      },
    ],
    result: {
      kind: "recommendation",
      heading: "Your match",
      outcomes: [
        {
          id: "hydrate",
          title: "The Hydration Set",
          description: "A cream that actually holds water in, plus a serum that helps it stay.",
          bullets: ["Fragrance-free", "Works under makeup", "Two-step routine"],
          illustration: "droplet",
          cta: { label: "Shop the Hydration Set" },
        },
        {
          id: "glow",
          title: "The Glow Set",
          description: "Gentle exfoliation and vitamin C, for skin that's lost its brightness.",
          bullets: ["Visible in two weeks", "Suits most skin types", "Morning routine"],
          illustration: "sun",
          cta: { label: "Shop the Glow Set" },
        },
        {
          id: "clarity",
          title: "The Clarity Set",
          description: "Balances oil without stripping, so skin stops overcompensating.",
          bullets: ["Non-comedogenic", "Salicylic acid", "Twice daily"],
          illustration: "sparkle",
          cta: { label: "Shop the Clarity Set" },
        },
        {
          id: "calm",
          title: "The Calm Set",
          description: "Short ingredient lists and nothing clever, for skin that reacts to everything.",
          bullets: ["Nine ingredients", "No fragrance or essential oils", "Dermatologist tested"],
          illustration: "shield",
          cta: { label: "Shop the Calm Set" },
        },
      ],
      disclaimer: "This isn't medical advice. See a dermatologist for anything persistent.",
    },
    theme: { preset: "soft", brandColour: "#E8607E", radius: "xl", buttonStyle: "soft" },
    settings: {
      leadCapture: {
        mode: "after",
        fields: ["email"],
        heading: "Want 10% off your match?",
        description: "We'll send the code and the routine, then leave you alone.",
      },
      privacyNote: PRIVACY,
    },
  }
);

const planFinder = template(
  {
    slug: "which-plan",
    name: "Which Plan Is Right For Me?",
    type: "quiz",
    tagline: "Answer the pricing-page question everyone gets stuck on.",
    audience: "Any business with more than one plan",
    illustration: "target",
  },
  {
    name: "Which Plan Is Right For Me?",
    type: "quiz",
    intro: {
      heading: "Which plan fits?",
      description: "Four questions, an honest answer — including “the free one is fine”.",
      buttonLabel: "Find my plan",
      illustration: "target",
    },
    steps: [
      {
        id: "team_size",
        title: "How many people are involved?",
        input: {
          kind: "choice",
          columns: 2,
          options: [
            { id: "solo", label: "Just me", value: 1, illustration: "person", scores: { free: 3 } },
            { id: "small", label: "2–10", value: 10, illustration: "people", scores: { pro: 3 } },
            { id: "mid", label: "11–50", value: 50, illustration: "people", scores: { business: 2 } },
            { id: "large", label: "More than 50", value: 100, illustration: "people", scores: { business: 4 } },
          ],
        },
      },
      {
        id: "goals",
        title: "What are you trying to do?",
        description: "Pick everything that applies.",
        input: {
          kind: "choice",
          multiple: true,
          columns: 2,
          options: [
            { id: "try", label: "Just have a look", value: "try", scores: { free: 3 } },
            { id: "leads", label: "Collect leads", value: "leads", scores: { pro: 3 } },
            { id: "brand", label: "Match my branding", value: "brand", scores: { pro: 2 } },
            { id: "scale", label: "Roll it out widely", value: "scale", scores: { business: 3 } },
          ],
        },
      },
      {
        id: "volume",
        title: "Roughly how many people will use it each month?",
        input: { kind: "slider", min: 100, max: 20000, step: 100, defaultValue: 1000, suffix: " visitors" },
      },
      {
        id: "branding",
        title: "Do you need our badge gone?",
        required: false,
        input: { kind: "toggle", onLabel: "Yes, white-label it", offLabel: "The badge is fine" },
      },
    ],
    logic: [
      {
        id: "volume-business",
        label: "High volume needs the top plan",
        when: { field: "volume", operator: ">", value: 10000 },
        then: { score: { outcome: "business", points: 5 } },
      },
      {
        id: "branding-pro",
        label: "Removing the badge is a paid feature",
        when: { field: "branding", operator: "=", value: true },
        then: { score: { outcome: "pro", points: 3 } },
      },
      {
        id: "free-cap",
        label: "The free plan stops at 500 visitors",
        when: { field: "volume", operator: ">", value: 500 },
        then: { score: { outcome: "free", points: -4 } },
      },
    ],
    result: {
      kind: "recommendation",
      heading: "Our honest answer",
      outcomes: [
        {
          id: "free",
          title: "Start on Free",
          description: "You don't need to pay us yet. Come back when you outgrow it.",
          bullets: ["3 widgets", "500 interactions a month", "Hosted links"],
          illustration: "gift",
          cta: { label: "Create a free account" },
        },
        {
          id: "pro",
          title: "Pro is the one",
          description: "Lead capture, your branding, and enough room to stop counting.",
          bullets: ["20 widgets", "10,000 interactions a month", "No badge, full analytics"],
          illustration: "star",
          cta: { label: "Start on Pro" },
        },
        {
          id: "business",
          title: "You want Business",
          description: "Higher limits and the advanced logic that bigger rollouts need.",
          bullets: ["Higher limits", "Advanced logic", "Integrations"],
          illustration: "rocket",
          cta: { label: "Talk to us" },
        },
      ],
    },
    theme: { preset: "minimal", brandColour: "#5B5FEF", radius: "m", buttonStyle: "filled" },
    settings: {
      showBadge: true,
      leadCapture: { mode: "none", fields: ["email"] },
      privacyNote: PRIVACY,
    },
  }
);

/* ------------------------------------------------------------------ */

export const TEMPLATES: TemplateDefinition[] = [
  cleaning,
  photography,
  website,
  roi,
  eventBudget,
  moving,
  skincare,
  planFinder,
];

export function templateBySlug(slug: string): TemplateDefinition | undefined {
  return TEMPLATES.find((entry) => entry.slug === slug);
}

/** Gallery filters (§24). */
export const TEMPLATE_FILTERS = [
  { id: "all", label: "All" },
  { id: "calculator", label: "Calculator" },
  { id: "estimator", label: "Estimator" },
  { id: "quiz", label: "Quiz" },
] as const;

export type TemplateFilter = (typeof TEMPLATE_FILTERS)[number]["id"];

/** The one shown in the homepage hero (§9). */
export const HERO_TEMPLATE_SLUG = "cleaning-estimate";
