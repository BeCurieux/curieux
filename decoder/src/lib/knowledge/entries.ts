/**
 * The ingredient knowledge base.
 *
 * BRIEF.md §11 wants "the ~300 most-flagged additives/ingredients with
 * plain-English explainers, sourced and reviewed — this is founder work and the
 * beginning of the data moat", and §13 calls the result the asset a buyer
 * cannot prompt into existence.
 *
 * **This file is a seed, not the 300.** It covers every axis in the schema and
 * every one of the five launch niches with enough depth to score real labels,
 * and `scripts/knowledge.ts` reports the count and the coverage so the gap is
 * visible rather than implied. Saying so here is the same habit as the rest of
 * the repository: a cap that announces itself beats a cap that is discovered.
 *
 * ## Two conventions that are load-bearing
 *
 * **`url` is null nearly everywhere, on purpose.** Every `cite` below is a
 * statement I can stand behind; a URL is a different kind of claim — that a
 * specific page exists and says this today — and inventing one in a file whose
 * entire job is to be trustworthy would be the product's own kill scenario in
 * miniature. Attaching verified links is founder review work, and the schema
 * accepts null so the gap is honest rather than filled with something
 * plausible.
 *
 * **`strength: "preference"` is used freely and is not a weakness.** §10.2
 * forbids medical claims, so where there is no regulatory position and no
 * settled evidence, the entry says exactly that: the user avoids it, we flag
 * it because they said so, and we assert nothing about the world. That is the
 * honest register for most of the clean-label axis, and pretending otherwise
 * is what gets an app an FTC letter.
 */

import type {
  Allergen,
  Avoidance,
  Axis,
  Concern,
  Intolerance,
  KnowledgeEntryInput,
  LifeStage,
  Protocol,
  Source,
} from "@/lib/schema";

/** Bump when entries change. Recorded on every verdict. */
export const KNOWLEDGE_VERSION = "kb-2026-08-16";

/* -------------------------------------------------------------------------- */
/* Sources                                                                     */
/* -------------------------------------------------------------------------- */

const src = (body: string, cite: string, url: string | null = null): Source => ({ body, cite, url });

const FALCPA = src(
  "US Food and Drug Administration",
  "FALCPA, as amended by the FASTER Act, requires the nine major food allergens to be declared on packaged food labels sold in the US.",
);
const EU_AZO = src(
  "European Commission",
  'Regulation (EC) No 1333/2008 Annex V requires foods containing these colours to carry the words "may have an adverse effect on activity and attention in children".',
);
const CA_AB418 = src(
  "State of California",
  "The California Food Safety Act (AB 418, 2023) prohibits the manufacture and sale of food containing brominated vegetable oil, potassium bromate, propylparaben or Red 3 in California from 2027.",
);
const EFSA_TIO2 = src(
  "European Food Safety Authority",
  "EFSA's 2021 re-evaluation concluded that titanium dioxide can no longer be considered safe as a food additive, and the EU withdrew its authorisation for food use in 2022. It remains permitted in the US.",
);
const FDA_RED3 = src(
  "US Food and Drug Administration",
  "The FDA revoked the colour additive authorisation for FD&C Red No. 3 in food in January 2025, with a compliance date in January 2027.",
);
const FDA_BVO = src(
  "US Food and Drug Administration",
  "The FDA revoked the regulation authorising brominated vegetable oil in food in July 2024.",
);
const FDA_PHO = src(
  "US Food and Drug Administration",
  'The FDA determined in 2015 that partially hydrogenated oils are no longer "generally recognised as safe" for use in human food; the compliance period closed in 2021.',
);
const FDA_SULFITE = src(
  "US Food and Drug Administration",
  "Sulfites must be declared on the label when present at 10 parts per million or more.",
);
const FDA_MSG = src(
  "US Food and Drug Administration",
  'The FDA classifies monosodium glutamate as generally recognised as safe, and requires it to be declared by name on the ingredient list. It does not permit "no MSG" claims on foods containing naturally occurring glutamates.',
);
const FDA_FLAVOR = src(
  "US Code of Federal Regulations",
  '21 CFR 101.22 permits flavouring substances to be declared collectively as "natural flavor" or "artificial flavor" without naming the constituents.',
);
const DSHEA_BLEND = src(
  "US Food and Drug Administration",
  "21 CFR 101.36 permits a proprietary blend to declare the total weight of the blend without disclosing the quantity of each individual ingredient.",
);
const ACOG_CAFFEINE = src(
  "American College of Obstetricians and Gynecologists",
  "ACOG advises that during pregnancy caffeine intake be limited to under 200 mg per day.",
);
const FDA_PREG_DAIRY = src(
  "US Food and Drug Administration",
  "The FDA advises pregnant people to avoid unpasteurised (raw) milk and soft cheeses made from it.",
);
const FDA_MERCURY = src(
  "US Food and Drug Administration / Environmental Protection Agency",
  'Joint FDA/EPA advice places shark, swordfish, king mackerel, tilefish, marlin, orange roughy and bigeye tuna on the "choices to avoid" list for people who are pregnant or breastfeeding.',
);
const MONASH = src(
  "Monash University FODMAP Program",
  "Monash, which developed the low-FODMAP protocol and maintains its food composition data, lists this among the high-FODMAP ingredients the protocol restricts.",
);
const JECFA_ASPARTAME = src(
  "Joint FAO/WHO Expert Committee on Food Additives",
  "JECFA reaffirmed the acceptable daily intake for aspartame at 40 mg/kg of body weight in 2023.",
);
const EFSA_CARRAGEENAN = src(
  "European Food Safety Authority",
  "EFSA's re-evaluation kept carrageenan authorised while noting that the available data did not allow a full assessment, and called for a lower molecular-weight specification.",
);
const FDA_NITRITE = src(
  "US Code of Federal Regulations",
  "Sodium and potassium nitrite are permitted as curing agents at limited levels and must be declared on the ingredient list.",
);
const VEGAN_SOC = src(
  "The Vegan Society",
  "Listed among the animal-derived ingredients that commonly appear on labels without an obvious animal name.",
);

/* -------------------------------------------------------------------------- */
/* Axis shorthands                                                             */
/* -------------------------------------------------------------------------- */

const allergen = (value: Allergen): Axis => ({ kind: "allergen", value });
const avoid = (value: Avoidance): Axis => ({ kind: "avoidance", value });
const protocol = (value: Protocol): Axis => ({ kind: "protocol", value });
const stage = (value: LifeStage): Axis => ({ kind: "life-stage", value });
const intolerance = (value: Intolerance): Axis => ({ kind: "intolerance", value });

/**
 * An allergen concern. Always red, always regulatory — the label is legally
 * required to declare it, which is the only reason we can say anything about
 * it at all.
 *
 * `lookFor` is deliberately not a substitution suggestion here. Telling
 * somebody with a peanut allergy what to buy instead is advice about a
 * different label we have not read; the only correct instruction is to check
 * the packaging.
 */
const allergenConcern = (value: Allergen, food: string): Concern => ({
  axis: allergen(value),
  severity: "red",
  strength: "regulatory",
  note: `Your profile lists ${value.replace("-", " ")}. This label declares ${food}.`,
  lookFor: "Check the packaging itself before eating this — labels change, and this reading is from a photograph.",
  sources: [FALCPA],
});

/* -------------------------------------------------------------------------- */
/* The entries                                                                 */
/* -------------------------------------------------------------------------- */

export const ENTRIES: KnowledgeEntryInput[] = [
  /* ---- Umbrella terms. Always amber. The label does not say. ------------- */
  {
    id: "natural-flavors",
    names: ["natural flavors", "natural flavours", "natural flavoring", "natural flavouring", "flavoring", "flavouring", "flavour", "flavor"],
    eNumber: null,
    plain: "A collective name for flavouring substances. The label is not required to name them.",
    umbrella: true,
    concerns: [],
  },
  {
    id: "artificial-flavors",
    names: ["artificial flavors", "artificial flavours", "artificial flavoring", "artificial flavouring"],
    eNumber: null,
    plain: "A collective name for synthetic flavouring substances. The label is not required to name them.",
    umbrella: true,
    concerns: [],
  },
  {
    id: "spices",
    names: ["spices", "spice", "seasoning", "seasonings"],
    eNumber: null,
    plain: "A collective name for spices. The individual spices are not required to be named.",
    umbrella: true,
    concerns: [],
  },
  {
    id: "proprietary-blend",
    // Not bare "blend". A "Protein Blend (Milk Protein Isolate, Whey Protein
    // Concentrate)" names its contents and is not hiding anything — matching it
    // put a proprietary-blend caveat on a label that has no proprietary blend,
    // which is the product being wrong in the direction it can least afford.
    names: ["proprietary blend", "proprietary formula", "proprietary complex", "proprietary matrix"],
    eNumber: null,
    plain: "A named mix whose ingredients are listed without saying how much of each is in it.",
    umbrella: true,
    umbrellaNote: "The label names what is in this blend, but not how much of each — so there is no way to read the dose.",
    concerns: [],
  },

  /* ---- Allergens --------------------------------------------------------- */
  {
    id: "peanut",
    // Both spellings of groundnut. The two-word form also has to be listed
    // explicitly, because "ground" is a qualifier the matcher strips from the
    // front of an ingredient — which would leave "nuts" and find nothing.
    names: [
      "peanut",
      "peanuts",
      "peanut butter",
      "peanut oil",
      "peanut flour",
      "peanut protein",
      "groundnut",
      "groundnuts",
      "ground nut",
      "ground nuts",
      "arachis oil",
      "arachis hypogaea",
      "beer nuts",
      "monkey nuts",
    ],
    eNumber: null,
    plain: "Peanut, or an ingredient made from it.",
    umbrella: false,
    concerns: [allergenConcern("peanut", "peanut")],
  },
  {
    id: "tree-nut",
    names: ["almond", "almonds", "almond flour", "cashew", "cashews", "walnut", "walnuts", "pecan", "pecans", "pistachio", "pistachios", "hazelnut", "hazelnuts", "macadamia", "brazil nut", "brazil nuts", "pine nut", "pine nuts", "chestnut", "praline", "marzipan", "nougat", "gianduja"],
    eNumber: null,
    plain: "A tree nut, or an ingredient made from one.",
    umbrella: false,
    concerns: [allergenConcern("tree-nut", "a tree nut")],
  },
  {
    id: "coconut",
    names: ["coconut", "coconut oil", "coconut milk", "coconut cream", "coconut flour", "desiccated coconut", "creamed coconut"],
    eNumber: null,
    plain: "Coconut. US labelling rules classify it as a tree nut, though botanically it is a drupe.",
    umbrella: false,
    concerns: [
      {
        axis: allergen("tree-nut"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile lists tree nuts, and US labelling counts coconut as one — so it is flagged here. Whether it matters for you is a question for your allergist, not for a photograph of a label.",
        lookFor: "Check the packaging itself before eating this — labels change, and this reading is from a photograph.",
        sources: [FALCPA],
      },
    ],
  },
  {
    id: "milk",
    names: ["milk", "milk powder", "skim milk", "skimmed milk", "whole milk", "buttermilk", "butter", "butterfat", "cream", "cheese", "yogurt", "yoghurt", "whey", "whey protein", "whey protein concentrate", "whey protein isolate", "casein", "caseinate", "sodium caseinate", "calcium caseinate", "lactose", "ghee", "curd", "milk solids", "milkfat", "condensed milk", "evaporated milk", "custard", "nonfat dry milk"],
    eNumber: null,
    plain: "Milk, or an ingredient made from milk.",
    umbrella: false,
    concerns: [
      allergenConcern("milk", "milk"),
      {
        axis: protocol("vegan"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is vegan. This is a dairy ingredient.",
        lookFor: "A version made with oat, soy, almond or coconut in place of the dairy.",
        sources: [VEGAN_SOC],
      },
      {
        axis: protocol("vegetarian"),
        severity: "yellow",
        strength: "preference",
        note: "Dairy — fine on most vegetarian definitions, flagged in case yours excludes it.",
        lookFor: null,
        sources: [],
      },
    ],
  },
  {
    id: "lactose-ingredient",
    names: ["lactose", "milk sugar"],
    eNumber: null,
    plain: "The sugar naturally present in milk.",
    umbrella: false,
    concerns: [
      {
        axis: intolerance("lactose"),
        severity: "red",
        strength: "established",
        note: "Your profile lists lactose intolerance. This label declares lactose.",
        lookFor: "A lactose-free version, or one where the dairy is replaced by a plant milk.",
        sources: [FALCPA],
      },
    ],
  },
  {
    id: "egg",
    names: ["egg", "eggs", "egg white", "egg yolk", "albumen", "albumin", "ovalbumin", "egg powder", "dried egg", "mayonnaise", "meringue", "lysozyme"],
    eNumber: null,
    plain: "Egg, or an ingredient made from egg.",
    umbrella: false,
    concerns: [
      allergenConcern("egg", "egg"),
      {
        axis: protocol("vegan"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is vegan. This is an egg ingredient.",
        lookFor: "A version bound with aquafaba, flax or starch instead of egg.",
        sources: [VEGAN_SOC],
      },
    ],
  },
  {
    id: "wheat",
    names: ["wheat", "wheat flour", "flour", "enriched flour", "wheat starch", "wheat protein", "durum", "semolina", "spelt", "farro", "einkorn", "kamut", "couscous", "bulgur", "seitan", "vital wheat gluten", "graham flour"],
    eNumber: null,
    plain: "Wheat, or an ingredient milled from it.",
    umbrella: false,
    concerns: [
      allergenConcern("wheat", "wheat"),
      {
        axis: intolerance("gluten"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile avoids gluten. Wheat is a gluten grain.",
        lookFor: 'A version labelled "gluten-free", or one built on rice, corn, buckwheat or oat flour.',
        sources: [FALCPA],
      },
      {
        axis: protocol("keto"),
        severity: "red",
        strength: "preference",
        note: "Your profile is keto. Wheat flour is a starch.",
        lookFor: "A version made with almond, coconut or lupin flour.",
        sources: [],
      },
      {
        axis: protocol("carnivore"),
        severity: "red",
        strength: "preference",
        note: "Your profile is carnivore. This is a grain ingredient.",
        lookFor: "A single-ingredient meat, fish or egg product.",
        sources: [],
      },
      {
        axis: avoid("seed-oils"),
        severity: "yellow",
        strength: "preference",
        note: "Not a seed oil — listed here because wheat germ oil sometimes gets grouped with them. Flagged only so the reason is visible.",
        lookFor: null,
        sources: [],
      },
    ],
  },
  {
    id: "barley",
    names: ["barley", "malt", "malt extract", "malted barley", "malt syrup", "malt vinegar", "brewer's yeast", "brewers yeast"],
    eNumber: null,
    plain: "Barley, or an ingredient made from it. Barley is a gluten grain but is not one of the nine US major allergens.",
    umbrella: false,
    concerns: [
      {
        axis: intolerance("gluten"),
        severity: "red",
        strength: "established",
        note: "Your profile avoids gluten. Barley and malt are gluten grains — and unlike wheat, they are not required to be highlighted as an allergen on a US label.",
        lookFor: 'A version labelled "gluten-free"; in drinks, one malted with sorghum or rice.',
        sources: [FALCPA],
      },
    ],
  },
  {
    id: "rye",
    names: ["rye", "rye flour", "pumpernickel", "triticale"],
    eNumber: null,
    plain: "Rye, a gluten grain.",
    umbrella: false,
    concerns: [
      {
        axis: intolerance("gluten"),
        severity: "red",
        strength: "established",
        note: "Your profile avoids gluten. Rye is a gluten grain.",
        lookFor: 'A version labelled "gluten-free".',
        sources: [FALCPA],
      },
    ],
  },
  {
    id: "soy",
    names: ["soy", "soya", "soybean", "soybeans", "soy protein", "soy protein isolate", "soy flour", "soy sauce", "tofu", "tempeh", "edamame", "miso", "textured vegetable protein", "tvp", "hydrolyzed soy protein"],
    eNumber: null,
    plain: "Soy, or an ingredient made from soybeans.",
    umbrella: false,
    concerns: [allergenConcern("soy", "soy")],
  },
  {
    id: "sesame",
    names: ["sesame", "sesame seed", "sesame seeds", "sesame oil", "tahini", "benne", "gingelly", "til", "halva", "hummus"],
    eNumber: null,
    plain: "Sesame, or an ingredient made from it.",
    umbrella: false,
    concerns: [allergenConcern("sesame", "sesame")],
  },
  {
    id: "fish",
    names: ["fish", "anchovy", "anchovies", "cod", "salmon", "tuna", "sardine", "sardines", "tilapia", "haddock", "pollock", "fish sauce", "worcestershire sauce", "fish oil", "surimi", "isinglass"],
    eNumber: null,
    plain: "Fish, or an ingredient made from fish.",
    umbrella: false,
    concerns: [
      allergenConcern("fish", "fish"),
      {
        axis: protocol("vegan"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is vegan. This is a fish ingredient.",
        lookFor: "A version using seaweed, miso or mushroom for the savoury note.",
        sources: [VEGAN_SOC],
      },
      {
        axis: protocol("vegetarian"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is vegetarian. This is a fish ingredient.",
        lookFor: "A version using seaweed, miso or mushroom for the savoury note.",
        sources: [VEGAN_SOC],
      },
    ],
  },
  {
    id: "shellfish",
    names: ["shrimp", "prawn", "prawns", "crab", "lobster", "crayfish", "crawfish", "langoustine", "krill", "shellfish", "crustacean", "oyster sauce", "oyster", "clam", "mussel", "scallop", "squid", "calamari", "octopus"],
    eNumber: null,
    plain: "Shellfish, or an ingredient made from shellfish.",
    umbrella: false,
    concerns: [
      allergenConcern("shellfish", "shellfish"),
      {
        axis: protocol("vegan"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is vegan. This is a shellfish ingredient.",
        lookFor: "A version using seaweed or mushroom for the savoury note.",
        sources: [VEGAN_SOC],
      },
    ],
  },

  /* ---- Hidden animal ingredients. §4 ICP 4. ------------------------------ */
  {
    id: "gelatin",
    names: ["gelatin", "gelatine", "hydrolyzed collagen", "collagen", "bovine gelatin", "porcine gelatin"],
    eNumber: null,
    plain: "A setting agent made by boiling animal skin, bone or connective tissue.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("vegan"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is vegan. Gelatin is made from animals.",
        lookFor: "A version set with pectin, agar or carrageenan.",
        sources: [VEGAN_SOC],
      },
      {
        axis: protocol("vegetarian"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is vegetarian. Gelatin is made from animals.",
        lookFor: "A version set with pectin, agar or carrageenan.",
        sources: [VEGAN_SOC],
      },
      {
        axis: protocol("halal"),
        severity: "amber",
        strength: "regulatory",
        note: "Your profile is halal. The label does not say which animal this gelatin came from, or how it was slaughtered.",
        lookFor: null,
        sources: [VEGAN_SOC],
      },
    ],
  },
  {
    id: "carmine",
    names: ["carmine", "cochineal", "cochineal extract", "carminic acid", "crimson lake", "natural red 4"],
    eNumber: "E120",
    plain: "A red colour made from cochineal insects.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("vegan"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is vegan. Carmine is made from insects.",
        lookFor: "A version coloured with beetroot, paprika or anthocyanin.",
        sources: [VEGAN_SOC],
      },
      {
        axis: protocol("vegetarian"),
        severity: "amber",
        strength: "preference",
        note: "Carmine is insect-derived — flagged because vegetarian definitions differ on it.",
        lookFor: null,
        sources: [VEGAN_SOC],
      },
    ],
  },
  {
    id: "shellac",
    names: ["shellac", "confectioner's glaze", "confectioners glaze", "resinous glaze", "pharmaceutical glaze"],
    eNumber: "E904",
    plain: "A glaze made from a resin secreted by the lac insect.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("vegan"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is vegan. Shellac comes from insects.",
        lookFor: "A version glazed with carnauba wax.",
        sources: [VEGAN_SOC],
      },
    ],
  },
  {
    id: "l-cysteine",
    names: ["l-cysteine", "cysteine", "e920"],
    eNumber: "E920",
    plain: "A dough conditioner. It can be made from feathers or hair, or produced by fermentation — the label does not say which.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("vegan"),
        severity: "amber",
        strength: "regulatory",
        note: "Your profile is vegan. This can be animal-derived or fermentation-derived, and this label does not say which.",
        lookFor: null,
        sources: [VEGAN_SOC],
      },
    ],
  },
  {
    id: "mono-and-diglycerides",
    names: ["mono and diglycerides", "mono- and diglycerides", "monoglycerides", "diglycerides", "mono-diglycerides", "e471"],
    eNumber: "E471",
    plain: "An emulsifier that keeps fat and water mixed. Made from either plant or animal fat.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("vegan"),
        severity: "amber",
        strength: "regulatory",
        note: "Your profile is vegan. These can be made from plant or animal fat, and this label does not say which.",
        lookFor: null,
        sources: [VEGAN_SOC],
      },
    ],
  },

  /* ---- Colours. §4 ICP 2. ------------------------------------------------ */
  {
    id: "red-40",
    names: ["red 40", "red no. 40", "fd&c red no. 40", "fd&c red 40", "allura red", "allura red ac", "red 40 lake"],
    eNumber: "E129",
    plain: "A synthetic red colour.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-colours"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile avoids artificial colours. In the EU this colour carries a mandatory warning on the label; in the US it does not.",
        lookFor: "A version coloured with beetroot, paprika extract or anthocyanin from fruit.",
        sources: [EU_AZO],
      },
    ],
  },
  {
    id: "yellow-5",
    names: ["yellow 5", "yellow no. 5", "fd&c yellow no. 5", "fd&c yellow 5", "tartrazine", "yellow 5 lake"],
    eNumber: "E102",
    plain: "A synthetic yellow colour.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-colours"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile avoids artificial colours. In the EU this colour carries a mandatory warning on the label; in the US it does not.",
        lookFor: "A version coloured with turmeric, annatto or safflower.",
        sources: [EU_AZO],
      },
    ],
  },
  {
    id: "yellow-6",
    names: ["yellow 6", "yellow no. 6", "fd&c yellow no. 6", "fd&c yellow 6", "sunset yellow", "sunset yellow fcf", "yellow 6 lake"],
    eNumber: "E110",
    plain: "A synthetic orange-yellow colour.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-colours"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile avoids artificial colours. In the EU this colour carries a mandatory warning on the label; in the US it does not.",
        lookFor: "A version coloured with annatto, paprika or carrot concentrate.",
        sources: [EU_AZO],
      },
    ],
  },
  {
    id: "red-3",
    names: ["red 3", "red no. 3", "fd&c red no. 3", "fd&c red 3", "erythrosine", "erythrosin"],
    eNumber: "E127",
    plain: "A synthetic pink-red colour that US regulators have withdrawn from food use.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-colours"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile avoids artificial colours. US authorisation for this colour in food has been revoked, with a compliance date in January 2027 — so it can still appear on shelves until then.",
        lookFor: "A version coloured with beetroot or anthocyanin from fruit.",
        sources: [FDA_RED3, CA_AB418],
      },
    ],
  },
  {
    id: "blue-1",
    names: ["blue 1", "blue no. 1", "fd&c blue no. 1", "fd&c blue 1", "brilliant blue", "brilliant blue fcf"],
    eNumber: "E133",
    plain: "A synthetic blue colour.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-colours"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids artificial colours. This one is a synthetic dye.",
        lookFor: "A version coloured with spirulina extract.",
        sources: [],
      },
    ],
  },
  {
    id: "blue-2",
    names: ["blue 2", "blue no. 2", "fd&c blue no. 2", "fd&c blue 2", "indigotine", "indigo carmine"],
    eNumber: "E132",
    plain: "A synthetic blue colour.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-colours"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids artificial colours. This one is a synthetic dye.",
        lookFor: "A version coloured with spirulina extract or butterfly pea.",
        sources: [],
      },
    ],
  },
  {
    id: "titanium-dioxide",
    names: ["titanium dioxide", "titanium oxide", "ci 77891"],
    eNumber: "E171",
    plain: "A bright white pigment used to make coatings and icings opaque.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("titanium-dioxide"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile avoids titanium dioxide. It is banned as a food additive in the EU and still permitted in the US — this is a case where the two regulators disagree.",
        lookFor: "A version left uncoated, or whitened with rice starch or calcium carbonate.",
        sources: [EFSA_TIO2],
      },
      {
        axis: avoid("artificial-colours"),
        severity: "amber",
        strength: "regulatory",
        note: "A colour additive rather than a dye — flagged for your artificial-colours profile so the reason is visible.",
        lookFor: null,
        sources: [EFSA_TIO2],
      },
    ],
  },

  /* ---- Sweeteners -------------------------------------------------------- */
  {
    id: "aspartame",
    names: ["aspartame", "nutrasweet", "equal"],
    eNumber: "E951",
    plain: "A synthetic sweetener roughly 200 times as sweet as sugar.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-sweeteners"),
        severity: "red",
        strength: "contested",
        note: "Your profile avoids artificial sweeteners. This one is well studied and the expert bodies do not agree on how to read the evidence.",
        lookFor: "A version sweetened with sugar, monk fruit or stevia, or an unsweetened one.",
        sources: [JECFA_ASPARTAME],
      },
    ],
  },
  {
    id: "sucralose",
    names: ["sucralose", "splenda"],
    eNumber: "E955",
    plain: "A synthetic sweetener made by modifying sugar.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-sweeteners"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids artificial sweeteners.",
        lookFor: "A version sweetened with sugar, monk fruit or stevia, or an unsweetened one.",
        sources: [],
      },
    ],
  },
  {
    id: "acesulfame-k",
    names: ["acesulfame potassium", "acesulfame k", "ace-k", "acesulfame-k"],
    eNumber: "E950",
    plain: "A synthetic sweetener, usually blended with another one.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-sweeteners"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids artificial sweeteners.",
        lookFor: "A version sweetened with sugar, monk fruit or stevia, or an unsweetened one.",
        sources: [],
      },
    ],
  },
  {
    id: "saccharin",
    names: ["saccharin", "sodium saccharin", "sweet'n low"],
    eNumber: "E954",
    plain: "One of the oldest synthetic sweeteners.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-sweeteners"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids artificial sweeteners.",
        lookFor: "A version sweetened with sugar, monk fruit or stevia, or an unsweetened one.",
        sources: [],
      },
    ],
  },
  {
    id: "sorbitol",
    names: ["sorbitol", "glucitol"],
    eNumber: "E420",
    plain: "A sugar alcohol used as a sweetener and to keep things moist.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("low-fodmap"),
        severity: "red",
        strength: "established",
        note: "Your profile is low-FODMAP. Sorbitol is a polyol, one of the FODMAP groups the protocol restricts.",
        lookFor: "A version sweetened with sugar, glucose or maple syrup.",
        sources: [MONASH],
      },
    ],
  },
  {
    id: "mannitol",
    names: ["mannitol"],
    eNumber: "E421",
    plain: "A sugar alcohol used as a sweetener and bulking agent.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("low-fodmap"),
        severity: "red",
        strength: "established",
        note: "Your profile is low-FODMAP. Mannitol is a polyol, one of the FODMAP groups the protocol restricts.",
        lookFor: "A version sweetened with sugar, glucose or maple syrup.",
        sources: [MONASH],
      },
    ],
  },

  /* ---- Sugars and starches ----------------------------------------------- */
  {
    id: "hfcs",
    names: ["high fructose corn syrup", "high-fructose corn syrup", "hfcs", "corn syrup", "glucose-fructose syrup", "isoglucose"],
    eNumber: null,
    plain: "A liquid sweetener made from corn starch.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("added-sugar"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids added sugar. This is an added sweetener.",
        lookFor: "A version sweetened with fruit alone, or an unsweetened one.",
        sources: [],
      },
      {
        axis: protocol("low-fodmap"),
        severity: "red",
        strength: "established",
        note: "Your profile is low-FODMAP. This syrup carries excess fructose, one of the FODMAP groups the protocol restricts.",
        lookFor: "A version sweetened with plain sugar, glucose or maple syrup.",
        sources: [MONASH],
      },
      {
        axis: protocol("keto"),
        severity: "red",
        strength: "preference",
        note: "Your profile is keto. This is a sugar syrup.",
        lookFor: "A version sweetened with erythritol, monk fruit or allulose.",
        sources: [],
      },
    ],
  },
  {
    id: "sugar",
    names: ["sugar", "cane sugar", "brown sugar", "invert sugar", "sucrose", "dextrose", "glucose", "fructose", "corn sugar", "beet sugar", "raw sugar", "turbinado", "molasses", "honey", "agave", "agave nectar", "agave syrup", "brown rice syrup", "fruit juice concentrate", "maple syrup", "coconut sugar"],
    eNumber: null,
    plain: "An added sweetener.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("added-sugar"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids added sugar. This is an added sweetener.",
        lookFor: "A version sweetened with whole fruit alone, or an unsweetened one.",
        sources: [],
      },
      {
        axis: protocol("keto"),
        severity: "red",
        strength: "preference",
        note: "Your profile is keto. This is a sugar.",
        lookFor: "A version sweetened with erythritol, monk fruit or allulose.",
        sources: [],
      },
      {
        axis: protocol("carnivore"),
        severity: "red",
        strength: "preference",
        note: "Your profile is carnivore. This is a plant-derived sweetener.",
        lookFor: "A single-ingredient meat, fish or egg product.",
        sources: [],
      },
    ],
  },
  {
    id: "maltodextrin",
    names: ["maltodextrin", "malto dextrin"],
    eNumber: null,
    plain: "A starch broken down into a fine white powder. Used as a filler, thickener and carrier.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("added-sugar"),
        severity: "yellow",
        strength: "preference",
        note: 'Not sugar on the label, but it behaves like one — flagged for your added-sugar profile because it is the usual reason "no added sugar" products still taste sweet and bulky.',
        lookFor: null,
        sources: [],
      },
      {
        axis: protocol("keto"),
        severity: "red",
        strength: "preference",
        note: "Your profile is keto. Maltodextrin is a rapidly digested starch.",
        lookFor: "A version bulked with inulin-free fibre, almond flour or nothing at all.",
        sources: [],
      },
    ],
  },
  {
    id: "inulin",
    names: ["inulin", "chicory root", "chicory root fiber", "chicory root fibre", "chicory root extract", "oligofructose", "fructooligosaccharides", "fos"],
    eNumber: null,
    plain: "A plant fibre, usually from chicory root, added to raise the fibre number.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("low-fodmap"),
        severity: "red",
        strength: "established",
        note: "Your profile is low-FODMAP. Inulin and its relatives are fructans, one of the FODMAP groups the protocol restricts.",
        lookFor: "A version whose fibre comes from oats, rice bran or psyllium.",
        sources: [MONASH],
      },
    ],
  },

  /* ---- Fats. §4 ICP 2 and CLAUDE.md collision 3. ------------------------- */
  {
    id: "seed-oil",
    names: ["soybean oil", "sunflower oil", "safflower oil", "canola oil", "rapeseed oil", "corn oil", "cottonseed oil", "grapeseed oil", "rice bran oil", "vegetable oil", "high oleic sunflower oil", "high oleic safflower oil"],
    eNumber: null,
    plain: "An oil pressed or extracted from seeds.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("seed-oils"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids seed oils. This is one of the cooking oils that term usually means.",
        lookFor: "A version fried or dressed in olive, avocado, coconut oil, butter or tallow.",
        sources: [],
      },
    ],
  },
  {
    id: "sunflower-lecithin",
    names: ["sunflower lecithin", "soy lecithin", "soya lecithin", "lecithin", "rapeseed lecithin"],
    eNumber: "E322",
    plain: "An emulsifier that keeps fat and water from separating. Used in tiny amounts.",
    umbrella: false,
    concerns: [
      /**
       * CLAUDE.md collision 3, in code.
       *
       * The brief's own hero screenshot reds sunflower lecithin on a seed-oil
       * profile. It is a phospholipid fraction used well under 1%, not one of
       * the frying oils that audience avoids, and redding it would red most
       * chocolate, protein powder and nut butter on the shelf. So it is amber
       * and it explains itself, which is what the same brief asks for six
       * sections earlier: "never a bare bad."
       */
      {
        axis: avoid("seed-oils"),
        severity: "amber",
        strength: "preference",
        note: "Lecithin comes from the same seed, but it is an emulsifier used in tiny amounts rather than one of the cooking oils a seed-oil profile is usually avoiding. Flagged so you can decide, not scored as if it were the oil.",
        lookFor: null,
        sources: [],
      },
      /** Soy lecithin and the soy allergen share a name list, so the allergen
       *  concern has to live here too. Highly refined lecithin is often
       *  tolerated, but that is a clinical judgement and not ours to make: the
       *  label says soy, so the label gets flagged. */
      {
        axis: allergen("soy"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile lists soy. Soy lecithin is declared as a soy ingredient on this label.",
        lookFor: "Check the packaging itself before eating this — labels change, and this reading is from a photograph.",
        sources: [FALCPA],
      },
    ],
  },
  {
    id: "partially-hydrogenated",
    names: ["partially hydrogenated oil", "partially hydrogenated soybean oil", "partially hydrogenated cottonseed oil", "partially hydrogenated palm oil", "shortening"],
    eNumber: null,
    plain: "An oil hardened by adding hydrogen. US regulators withdrew its safe-ingredient status.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("seed-oils"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile avoids seed oils, and this is a stronger case than most: US regulators removed partially hydrogenated oils from the generally-recognised-as-safe list in 2015.",
        lookFor: "A version made with butter, coconut oil or a non-hydrogenated fat.",
        sources: [FDA_PHO],
      },
    ],
  },
  {
    id: "bvo",
    names: ["brominated vegetable oil", "bvo"],
    eNumber: "E443",
    plain: "An oil treated with bromine, formerly used to keep citrus flavour evenly mixed in soft drinks.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-preservatives"),
        severity: "red",
        strength: "regulatory",
        note: "US authorisation for this ingredient in food was revoked in 2024, and California legislated against it separately.",
        lookFor: "A drink that lists no emulsifier, or uses gum arabic or sucrose acetate isobutyrate.",
        sources: [FDA_BVO, CA_AB418],
      },
    ],
  },

  /* ---- Preservatives and processing aids --------------------------------- */
  {
    id: "bha",
    names: ["bha", "butylated hydroxyanisole"],
    eNumber: "E320",
    plain: "A synthetic antioxidant that stops fats going rancid.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-preservatives"),
        severity: "red",
        strength: "contested",
        note: "Your profile avoids artificial preservatives. Regulators in different regions have reached different conclusions about this one.",
        lookFor: "A version preserved with rosemary extract or mixed tocopherols (vitamin E).",
        sources: [
          src(
            "US Food and Drug Administration",
            "BHA is permitted as a food additive at specified levels under 21 CFR 172.110.",
          ),
        ],
      },
    ],
  },
  {
    id: "bht",
    names: ["bht", "butylated hydroxytoluene"],
    eNumber: "E321",
    plain: "A synthetic antioxidant that stops fats going rancid.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-preservatives"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids artificial preservatives.",
        lookFor: "A version preserved with rosemary extract or mixed tocopherols (vitamin E).",
        sources: [],
      },
    ],
  },
  {
    id: "tbhq",
    names: ["tbhq", "tertiary butylhydroquinone", "tert-butylhydroquinone"],
    eNumber: "E319",
    plain: "A synthetic antioxidant used in fried and packaged foods.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-preservatives"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids artificial preservatives.",
        lookFor: "A version preserved with rosemary extract or mixed tocopherols (vitamin E).",
        sources: [],
      },
    ],
  },
  {
    id: "sodium-benzoate",
    names: ["sodium benzoate", "benzoic acid", "potassium benzoate"],
    eNumber: "E211",
    plain: "A preservative that stops mould and yeast growing, common in acidic drinks.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-preservatives"),
        severity: "red",
        strength: "preference",
        note: "Your profile avoids artificial preservatives.",
        lookFor: "A refrigerated or short-shelf-life version, which usually needs no preservative.",
        sources: [],
      },
    ],
  },
  {
    id: "propylparaben",
    names: ["propylparaben", "propyl paraben", "propyl p-hydroxybenzoate"],
    eNumber: "E216",
    plain: "A preservative. California has legislated to remove it from food sold in the state.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-preservatives"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile avoids artificial preservatives. California legislated against this one specifically, with effect from 2027.",
        lookFor: "A version preserved with calcium propionate, or a refrigerated one.",
        sources: [CA_AB418],
      },
    ],
  },
  {
    id: "potassium-bromate",
    names: ["potassium bromate", "bromated flour", "bromated wheat flour"],
    eNumber: "E924",
    plain: "A flour treatment that strengthens dough. Banned in the EU, UK and Canada, and legislated against in California.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("artificial-preservatives"),
        severity: "red",
        strength: "regulatory",
        note: "Several regulators have prohibited this flour treatment, and California legislated against it with effect from 2027. It remains permitted federally in the US.",
        lookFor: 'A bread whose flour is listed as "unbromated", or one leavened without a flour treatment.',
        sources: [CA_AB418],
      },
    ],
  },
  {
    id: "nitrite",
    names: ["sodium nitrite", "potassium nitrite", "sodium nitrate", "potassium nitrate", "celery powder", "celery juice powder", "cultured celery extract"],
    eNumber: "E250",
    plain: "A curing salt that keeps cured meat pink and stops spoilage. Celery powder is the same chemistry from a plant source.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("nitrites"),
        severity: "red",
        strength: "regulatory",
        note: 'Your profile avoids nitrites. Worth knowing: cured meats labelled "uncured" or "no nitrites added" are usually cured with celery powder, which is nitrite from a plant.',
        lookFor: "Fresh meat rather than cured, or a cured product that lists no nitrite and no celery powder.",
        sources: [FDA_NITRITE],
      },
    ],
  },
  {
    id: "sulfites",
    names: ["sulfites", "sulphites", "sulfur dioxide", "sulphur dioxide", "sodium sulfite", "sodium bisulfite", "sodium metabisulfite", "potassium metabisulfite", "potassium bisulfite"],
    eNumber: "E220",
    plain: "A preservative used in dried fruit, wine and some processed potato products.",
    umbrella: false,
    concerns: [
      {
        axis: intolerance("sulfite"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile lists sulfites. US labels must declare them at 10 parts per million or more.",
        lookFor: 'Dried fruit labelled "unsulphured", which is browner and just as good.',
        sources: [FDA_SULFITE],
      },
    ],
  },
  {
    id: "carrageenan",
    names: ["carrageenan", "irish moss extract"],
    eNumber: "E407",
    plain: "A thickener extracted from red seaweed, common in plant milks and cream.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("carrageenan"),
        severity: "red",
        strength: "contested",
        note: "Your profile avoids carrageenan. It remains authorised, and the reviewing bodies have noted gaps in the data rather than settling the question.",
        lookFor: "A plant milk thickened with gellan gum, or one with no thickener at all.",
        sources: [EFSA_CARRAGEENAN],
      },
    ],
  },
  {
    id: "msg",
    names: ["monosodium glutamate", "msg", "glutamic acid", "monopotassium glutamate", "autolyzed yeast extract", "yeast extract", "hydrolyzed vegetable protein", "hydrolysed vegetable protein"],
    eNumber: "E621",
    plain: "A savoury flavour enhancer. Yeast extract and hydrolysed protein deliver the same compound under different names.",
    umbrella: false,
    concerns: [
      {
        axis: avoid("msg"),
        severity: "red",
        strength: "preference",
        note: 'Your profile avoids MSG. Worth knowing: a product can say "no MSG added" and still list yeast extract or hydrolysed protein, which carry the same compound.',
        lookFor: "A version seasoned with mushroom, tomato, miso or plain salt.",
        sources: [FDA_MSG],
      },
    ],
  },

  /* ---- Pregnancy. §4 ICP 3. --------------------------------------------- */
  {
    id: "caffeine",
    names: ["caffeine", "anhydrous caffeine", "guarana", "guarana extract", "green tea extract", "yerba mate"],
    eNumber: null,
    plain: "A stimulant. Guarana and some extracts are concentrated sources of it.",
    umbrella: false,
    concerns: [
      {
        axis: stage("pregnancy"),
        severity: "amber",
        strength: "established",
        note: "Your profile is pregnancy. ACOG advises staying under 200 mg of caffeine a day — this label declares caffeine but not how much, so it counts towards that total by an amount the label does not say.",
        lookFor: null,
        sources: [ACOG_CAFFEINE],
      },
      {
        axis: stage("breastfeeding"),
        severity: "yellow",
        strength: "preference",
        note: "Your profile is breastfeeding. Flagged so the caffeine is visible; the label does not say how much.",
        lookFor: null,
        sources: [],
      },
    ],
  },
  {
    id: "unpasteurised-dairy",
    names: ["raw milk", "unpasteurized milk", "unpasteurised milk", "raw milk cheese", "unpasteurized cheese", "unpasteurised cheese", "queso fresco", "brie", "camembert", "roquefort", "gorgonzola", "feta"],
    eNumber: null,
    plain: "Milk or cheese that has not been heat-treated, or a soft cheese often made that way.",
    umbrella: false,
    concerns: [
      {
        axis: stage("pregnancy"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is pregnancy. US food-safety advice puts unpasteurised milk and the soft cheeses made from it on the avoid list. If this one is made from pasteurised milk the packaging will say so.",
        lookFor: "The same cheese made from pasteurised milk — most US supermarket versions are.",
        sources: [FDA_PREG_DAIRY],
      },
    ],
  },
  {
    id: "high-mercury-fish",
    names: ["shark", "swordfish", "king mackerel", "tilefish", "marlin", "orange roughy", "bigeye tuna"],
    eNumber: null,
    plain: "A fish that US advice places on the avoid list during pregnancy.",
    umbrella: false,
    concerns: [
      {
        axis: stage("pregnancy"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is pregnancy. Joint FDA and EPA advice places this fish on the choices-to-avoid list.",
        lookFor: 'A fish from the same advice\'s "best choices" list — salmon, sardines, cod, tilapia or canned light tuna.',
        sources: [FDA_MERCURY],
      },
      {
        axis: stage("breastfeeding"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is breastfeeding. Joint FDA and EPA advice places this fish on the choices-to-avoid list.",
        lookFor: 'A fish from the same advice\'s "best choices" list — salmon, sardines, cod, tilapia or canned light tuna.',
        sources: [FDA_MERCURY],
      },
    ],
  },
  {
    id: "alcohol",
    names: ["alcohol", "ethanol", "ethyl alcohol", "wine", "beer", "rum", "brandy", "liqueur", "bourbon", "whisky", "whiskey", "vodka"],
    eNumber: null,
    plain: "An alcoholic ingredient.",
    umbrella: false,
    concerns: [
      {
        axis: stage("pregnancy"),
        severity: "red",
        strength: "regulatory",
        note: "Your profile is pregnancy. This label declares an alcoholic ingredient.",
        lookFor: "A version made without alcohol — many extracts and sauces have one.",
        sources: [
          src(
            "US Surgeon General",
            "US public-health advice is that no amount of alcohol is considered safe during pregnancy.",
          ),
        ],
      },
      {
        axis: protocol("halal"),
        severity: "red",
        strength: "preference",
        note: "Your profile is halal. This label declares an alcoholic ingredient.",
        lookFor: "A version made without alcohol.",
        sources: [],
      },
    ],
  },

  /* ---- Supplements. §4 ICP 5. ------------------------------------------- */
  {
    id: "vitamin-d3",
    names: ["vitamin d3", "cholecalciferol"],
    eNumber: null,
    plain: "The form of vitamin D usually made from lanolin, the grease in sheep's wool. A lichen-derived version exists.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("vegan"),
        severity: "amber",
        strength: "regulatory",
        note: "Your profile is vegan. D3 is usually made from lanolin; the lichen-derived version says so on the label, and this one does not.",
        lookFor: null,
        sources: [VEGAN_SOC],
      },
    ],
  },
  {
    id: "magnesium-stearate",
    names: ["magnesium stearate", "stearic acid", "vegetable stearate"],
    eNumber: "E470b",
    plain: "A lubricant that stops powder sticking to tablet machinery. Can be plant or animal derived.",
    umbrella: false,
    concerns: [
      {
        axis: protocol("vegan"),
        severity: "amber",
        strength: "regulatory",
        note: "Your profile is vegan. Stearates can be plant or animal derived, and this label does not say which.",
        lookFor: null,
        sources: [VEGAN_SOC],
      },
    ],
  },
];

/**
 * What a `proprietary blend` hides, stated once so the renderer and the
 * scorer agree. Supplements are ICP 5 and this is the whole complaint.
 */
export const PROPRIETARY_BLEND_CAVEAT =
  "This lists a proprietary blend, so the label names the ingredients but not how much of each — there is no way to tell the dose from the packaging.";

export const PROPRIETARY_BLEND_SOURCE = DSHEA_BLEND;
export const FLAVOR_SOURCE = FDA_FLAVOR;
