/**
 * Catalogue Genome — taxonomy v1.
 *
 * The fixed, versioned merchandising ontology from `docs/HANDOFF.md` §6. This
 * file is the source of truth: the classifier's JSON schema, its zod
 * validator, the labelling page's controls and the `taxonomy_values` rows in
 * the database are all generated from it, so none of them can drift from the
 * others.
 *
 * **Released value IDs are never renamed, removed or added to in place.**
 * `tests/genome-v1-taxonomy.test.ts` holds the complete v1 ID list as a
 * literal and fails on any difference. A change to the ontology is a new file
 * (`v2`), because every stored value and every outcome logged against it keeps
 * the version it was made under.
 *
 * **The definitions below are what the labellers read.** The two external
 * merchandisers label "from the spec only", and the labelling page shows these
 * strings as that spec. They were written from the handoff's dimension table
 * and boundary rules. Where the full Genome v1 Specification words a
 * definition differently, the spec wins, and the text should be copied in here
 * *before* labelling starts. A definition changed mid-labelling invalidates
 * the agreement measured on it.
 *
 * `unknown` is added to every dimension by construction. It is always a legal
 * answer, and forcing a value on thin evidence is an error, not a
 * best-effort (HANDOFF §6.1 rule 2).
 */

export const TAXONOMY_VERSION = "genome_taxonomy_v1" as const;
export type TaxonomyVersion = typeof TAXONOMY_VERSION;

export const UNKNOWN = "unknown" as const;

export type Layer = "global" | "merchant_relative";

/** Who is allowed to set a dimension, before any merchant override. */
export type Derivation = "model" | "deterministic" | "merchant_declared";

export interface ValueDef {
  readonly id: string;
  readonly label: string;
  readonly definition: string;
}

export interface DimensionDef {
  readonly id: string;
  readonly label: string;
  readonly layer: Layer;
  readonly cardinality: "single" | "multi";
  /** Only for multi-label dimensions that the spec caps. */
  readonly maxLabels?: number;
  readonly derivation: Derivation;
  readonly question: string;
  /** The permitted values, not including `unknown`. Empty for `known_pairings`. */
  readonly values: readonly ValueDef[];
  /** Rules the classifier and the labellers both apply. */
  readonly boundaryRules: readonly string[];
  /**
   * Excluded from cross-merchant learning regardless of confidence.
   * `style_register` is provisional until it passes the agreement gate;
   * `margin_band` is never eligible.
   */
  readonly crossMerchantExcluded?: "provisional" | "never";
  /** Values are product references rather than taxonomy values. */
  readonly productRefs?: true;
}

const v = (id: string, label: string, definition: string): ValueDef => ({ id, label, definition });

/** Rules that apply to every model-classified dimension. */
export const GLOBAL_BOUNDARY_RULES = [
  "Classify from what the listing states or clearly shows. If the evidence is thin or genuinely split, answer unknown. A forced value is an error, not a best effort.",
  "Colour never implies audience or use context. A pink product is not therefore for women; a navy one is not therefore nautical.",
  "Seasonal or campaign copy alone does not make an occasion fit. 'Perfect for Father's Day!' on a stapler does not make it a Father's Day product.",
  "Occasion timing and hemisphere are not part of the label. Christmas is christmas_holiday whether it falls in summer or winter; the POP decides when.",
  "Judge the product, not the store. Classify each product as if it were the only thing the store sold.",
] as const;

export const DIMENSIONS = [
  {
    id: "occasion_fit",
    label: "Occasion fit",
    layer: "global",
    cardinality: "multi",
    derivation: "model",
    question: "Which occasions would a merchandiser confidently build a shop around this product for?",
    values: [
      v("everyday", "Everyday", "Bought for ordinary use with no particular occasion in mind. Most products fit this, alongside or instead of an occasion."),
      v("mothers_day", "Mother's Day", "A natural Mother's Day pick: something a merchandiser would put in a Mother's Day edit without needing to explain why."),
      v("fathers_day", "Father's Day", "A natural Father's Day pick: something a merchandiser would put in a Father's Day edit without needing to explain why."),
      v("christmas_holiday", "Christmas / holiday", "Suits end-of-year gifting or holiday use: gifts, stocking fillers, festive entertaining, decorations."),
      v("valentines", "Valentine's", "Suits a romantic gift or a Valentine's edit."),
      v("birthday", "Birthday", "A sound birthday present for someone the buyer knows."),
      v("summer_travel", "Summer / travel", "Suits summer holidays, trips or warm-weather getaways: packing, beach, travel comfort."),
    ],
    boundaryRules: [
      "Choose every occasion that genuinely applies, and none that only the product copy claims.",
      "everyday can sit alongside an occasion when the product is also an ordinary purchase.",
    ],
  },
  {
    id: "gift_role",
    label: "Gift role",
    layer: "global",
    cardinality: "single",
    derivation: "model",
    question: "If this is bought as a gift, what is the dominant reason someone gives it?",
    values: [
      v("practical", "Practical", "Given because it will be used: a useful, well-made thing the recipient needs or would reach for."),
      v("indulgent", "Indulgent", "Given as a treat: something nicer than the recipient would buy themselves."),
      v("novelty", "Novelty", "Given for the laugh, the surprise or the talking point more than the use."),
      v("not_giftable", "Not giftable", "Not a sensible gift: replacement parts, highly personal fit or consumables nobody gives, refills, utility items."),
    ],
    boundaryRules: [
      "Pick the dominant reason. If practical and indulgent are genuinely balanced, answer unknown rather than choosing.",
    ],
  },
  {
    id: "use_context",
    label: "Use context",
    layer: "global",
    cardinality: "multi",
    maxLabels: 3,
    derivation: "model",
    question: "Where or in what setting is this product used? At most three.",
    values: [
      v("home", "Home", "Used in or around the home: living, cooking, sleeping, household tasks."),
      v("outdoor", "Outdoor", "Used outdoors on land: garden, camping, hiking, the yard, the workshop outside."),
      v("water_coastal", "Water / coastal", "Used on or near water: boating, sailing, swimming, the beach, fishing."),
      v("travel", "Travel", "Used while travelling or designed to be packed and carried."),
      v("work", "Work", "Used for work: office, trade, desk, commute to a job."),
      v("social_evening", "Social / evening", "Used when going out, hosting, dining or at evening events."),
      v("fitness", "Fitness", "Used for exercise, sport or training."),
      v("personal_care", "Personal care", "Used on the body for grooming, skincare, hygiene or wellbeing."),
    ],
    boundaryRules: [
      "At most three, most characteristic first. If the product has no characteristic setting, answer unknown rather than listing every possibility.",
    ],
  },
  {
    id: "seasonality",
    label: "Seasonality",
    layer: "global",
    cardinality: "single",
    derivation: "model",
    question: "Is this product tied to a season of use?",
    values: [
      v("warm_weather", "Warm weather", "Mainly used or worn in warm weather."),
      v("cold_weather", "Cold weather", "Mainly used or worn in cold weather."),
      v("all_season", "All season", "Used year-round; the season does not change whether someone reaches for it."),
    ],
    boundaryRules: [
      "Season of use, not season of sale. A Christmas gift used year-round is all_season.",
    ],
  },
  {
    id: "audience_fit",
    label: "Audience fit",
    layer: "global",
    cardinality: "multi",
    derivation: "model",
    question: "Who is this product made for, as the listing and catalogue data show it?",
    values: [
      v("women", "Women", "Made or cut for women, as the listing, sizing or category states."),
      v("men", "Men", "Made or cut for men, as the listing, sizing or category states."),
      v("unisex_adult", "Unisex adult", "For adults of any gender."),
      v("kids", "Kids", "For children, from toddler to early teens."),
      v("baby", "Baby", "For babies and infants."),
      v("household", "Household", "For a home or household rather than a person: shared, used by whoever lives there."),
    ],
    boundaryRules: [
      "Audience comes from the listing's words, sizing, category and tags. Never from colour, never from the model's own sense of who would like it.",
    ],
  },
  {
    id: "item_type",
    label: "Item type",
    layer: "global",
    cardinality: "single",
    derivation: "model",
    question: "What kind of item is this within a purchase?",
    values: [
      v("core_item", "Core item", "A primary purchase that stands on its own."),
      v("accessory", "Accessory", "Complements or attaches to a core item; rarely the reason for the order."),
      v("consumable", "Consumable", "Used up and re-bought: food, refills, skincare, candles."),
      v("set_bundle", "Set / bundle", "Several items sold together as one product."),
    ],
    boundaryRules: [
      "A Shopify bundle product is always set_bundle; that is set by rule, not by the model.",
    ],
  },
  {
    id: "style_register",
    label: "Style register",
    layer: "global",
    cardinality: "single",
    derivation: "model",
    question: "What register does this product's style sit in?",
    values: [
      v("casual", "Casual", "Relaxed, everyday, unfussy."),
      v("elevated_casual", "Elevated casual", "Relaxed but considered; smarter materials or finish without being formal."),
      v("formal", "Formal", "For occasions with a dress code or a formal setting."),
      v("playful", "Playful", "Fun, bright, humorous or whimsical in design."),
      v("functional", "Functional", "Design follows use; style is not the point."),
    ],
    boundaryRules: [],
    crossMerchantExcluded: "provisional",
  },
  {
    id: "price_band",
    label: "Price band",
    layer: "global",
    cardinality: "single",
    derivation: "deterministic",
    question: "Where does the default variant's pre-discount price sit against the reference bands for its category and currency?",
    values: [
      v("budget", "Budget", "At or below the category's budget ceiling."),
      v("mid", "Mid", "Above budget, at or below the mid ceiling."),
      v("premium", "Premium", "Above mid, at or below the premium ceiling."),
      v("luxury", "Luxury", "Above the premium ceiling."),
    ],
    boundaryRules: [],
  },
  {
    id: "price_position",
    label: "Price position",
    layer: "merchant_relative",
    cardinality: "single",
    derivation: "deterministic",
    question: "Where does this product's price sit within its own store?",
    values: [
      v("entry", "Entry", "Bottom 25% of its comparison set."),
      v("mid", "Mid", "Middle 50% of its comparison set."),
      v("premium", "Premium", "Top 25% of its comparison set."),
    ],
    boundaryRules: [],
  },
  {
    id: "assortment_role",
    label: "Assortment role",
    layer: "merchant_relative",
    cardinality: "single",
    derivation: "deterministic",
    question: "What job does this product do in the merchant's range?",
    values: [
      v("hero", "Hero", "Can lead a shop on its own."),
      v("supporting", "Supporting", "Earns a place beside a hero."),
      v("add_on", "Add-on", "Added once the shopper has decided."),
      v("neutral", "Neutral", "No role established yet."),
    ],
    boundaryRules: ["Raw sales never set this."],
  },
  {
    id: "inventory_depth",
    label: "Inventory depth",
    layer: "merchant_relative",
    cardinality: "single",
    derivation: "deterministic",
    question: "How much stock cover does this product have?",
    values: [
      v("low", "Low", "Under 14 days of cover, or below the merchant's minimum."),
      v("normal", "Normal", "Between low and high."),
      v("high", "High", "Over 90 days of cover."),
    ],
    boundaryRules: [],
  },
  {
    id: "margin_band",
    label: "Margin band",
    layer: "merchant_relative",
    cardinality: "single",
    derivation: "deterministic",
    question: "What margin does the merchant make on this product?",
    values: [
      v("low", "Low", "Under 40%."),
      v("mid", "Mid", "40% to 60%."),
      v("high", "High", "Over 60%."),
    ],
    boundaryRules: ["From Shopify cost per item only. Never estimated."],
    crossMerchantExcluded: "never",
  },
  {
    id: "known_pairings",
    label: "Known pairings",
    layer: "merchant_relative",
    cardinality: "multi",
    derivation: "merchant_declared",
    question: "Which of the merchant's products does this one go with?",
    values: [],
    boundaryRules: ["Merchant-declared only. A pairing the model suggests is shown to the merchant and never stored."],
    productRefs: true,
  },
] as const satisfies readonly DimensionDef[];

export type DimensionId = (typeof DIMENSIONS)[number]["id"];

export const MODEL_DIMENSIONS = DIMENSIONS.filter((d) => d.derivation === "model").map((d) => d.id) as ModelDimensionId[];
export type ModelDimensionId = Extract<(typeof DIMENSIONS)[number], { derivation: "model" }>["id"];

export function dimension(id: DimensionId): DimensionDef {
  const found = DIMENSIONS.find((d) => d.id === id);
  if (!found) throw new Error(`No such dimension in ${TAXONOMY_VERSION}: ${id}`);
  return found;
}

export function isDimensionId(id: string): id is DimensionId {
  return DIMENSIONS.some((d) => d.id === id);
}

/** Permitted values for a dimension, `unknown` included. Empty for product-ref dimensions. */
export function permittedValues(id: DimensionId): string[] {
  const def = dimension(id);
  if (def.productRefs) return [];
  return [...def.values.map((x) => x.id), UNKNOWN];
}

export function isPermitted(id: DimensionId, value: string): boolean {
  return permittedValues(id).includes(value);
}

/** The stable, never-renamed identifier: `gift_role:practical`. */
export function valueId(dim: DimensionId, value: string): string {
  return `${dim}:${value}`;
}

/** Every value ID in this version, `unknown` included, in declaration order. */
export function allValueIds(): string[] {
  return DIMENSIONS.flatMap((d) => permittedValues(d.id).map((value) => valueId(d.id, value)));
}

// ---------------------------------------------------------------- category

/**
 * The parent category, which is not a Genome dimension.
 *
 * It exists for two jobs: to pick the `price_band_references` row a product is
 * banded against, and to stratify the gold set across ≥5 categories. The
 * classifier supplies it in the same call as the dimensions. It is stored with
 * the product rather than as a Genome value, so nothing downstream can mistake
 * it for part of the ontology the agreement gate measures.
 */
export const PARENT_CATEGORIES = [
  "apparel",
  "footwear",
  "jewellery_accessories",
  "bags_luggage",
  "beauty_personal_care",
  "home_living",
  "kitchen_dining",
  "food_drink",
  "outdoor_sports",
  "tools_hardware",
  "kids_baby",
  "stationery_books_gifts",
  "tech_electronics",
  "pets",
  "other",
] as const;
export type ParentCategory = (typeof PARENT_CATEGORIES)[number];
