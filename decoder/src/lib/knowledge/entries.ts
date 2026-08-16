/**
 * The ingredient graph.
 *
 * BRIEF.md §14 asks for identity, classification, relationships, evidence and
 * uncertainty per ingredient, and §15 says the ontology and the alias graph —
 * not a table of 300 rows — are what compounds.
 *
 * So an entry here says what something *is*, never what to think about it. The
 * opinion lives in the user's rules and nowhere else, which is §17 Rule 4
 * ("no universal morality score") expressed as a data model rather than as a
 * style guide: there is no field in which this file could store a judgement
 * even if somebody wanted to.
 *
 * **This is a seed, not §18's 300–500.** `pnpm knowledge` prints the count, the
 * per-class coverage and the classes that nothing reaches yet, so the gap is a
 * number somebody has to look at rather than an impression.
 *
 * ## Why `url` is null nearly everywhere, on purpose
 *
 * Every `cite` is a statement that can be stood behind. A URL is a different
 * kind of claim — that a specific page exists and says this today — and
 * inventing one in the file whose entire job is trustworthiness would be this
 * product's own failure mode in miniature. §16 puts the source in front of the
 * user on every tap, so the links have to be real ones. Attaching them is
 * founder review work, and the schema accepts null so the gap stays honest.
 */

import type { Evidence, Jurisdiction, KnowledgeEntryInput, Uncertainty, UncertaintyKind } from "@/lib/schema";

/** Bump when entries change. Recorded on every verdict and every dispute. */
export const KNOWLEDGE_VERSION = "kb-2026-08-16b";

/* -------------------------------------------------------------------------- */
/* Evidence                                                                    */
/* -------------------------------------------------------------------------- */

const ev = (
  body: string,
  cite: string,
  jurisdiction: Jurisdiction,
  strength: Evidence["strength"],
  lastReviewed: string,
): Evidence => ({ body, cite, jurisdiction, strength, lastReviewed, url: null });

const FALCPA = ev(
  "US Food and Drug Administration",
  "FALCPA, as amended by the FASTER Act, requires the nine major food allergens to be declared on packaged food labels sold in the US.",
  "US",
  "regulatory",
  "2026-08-16",
);
const EU_AZO = ev(
  "European Commission",
  'Regulation (EC) No 1333/2008 Annex V requires foods containing this colour to carry the words "may have an adverse effect on activity and attention in children".',
  "EU",
  "regulatory",
  "2026-08-16",
);
const CA_AB418 = ev(
  "State of California",
  "The California Food Safety Act (AB 418, 2023) prohibits the manufacture and sale of food containing brominated vegetable oil, potassium bromate, propylparaben or Red 3 in California from 2027.",
  "US",
  "regulatory",
  "2026-08-16",
);
const EFSA_TIO2 = ev(
  "European Food Safety Authority",
  "EFSA's 2021 re-evaluation concluded that titanium dioxide can no longer be considered safe as a food additive, and the EU withdrew its authorisation for food use in 2022. It remains permitted in the US.",
  "EU",
  "regulatory",
  "2026-08-16",
);
const FDA_RED3 = ev(
  "US Food and Drug Administration",
  "The FDA revoked the colour additive authorisation for FD&C Red No. 3 in food in January 2025, with a compliance date in January 2027.",
  "US",
  "regulatory",
  "2026-08-16",
);
const FDA_BVO = ev(
  "US Food and Drug Administration",
  "The FDA revoked the regulation authorising brominated vegetable oil in food in July 2024.",
  "US",
  "regulatory",
  "2026-08-16",
);
const FDA_PHO = ev(
  "US Food and Drug Administration",
  'The FDA determined in 2015 that partially hydrogenated oils are no longer "generally recognised as safe" for use in human food; the compliance period closed in 2021.',
  "US",
  "regulatory",
  "2026-08-16",
);
const FDA_SULFITE = ev(
  "US Food and Drug Administration",
  "Sulfites must be declared on the label when present at 10 parts per million or more.",
  "US",
  "regulatory",
  "2026-08-16",
);
const FDA_MSG = ev(
  "US Food and Drug Administration",
  'The FDA classifies monosodium glutamate as generally recognised as safe and requires it to be declared by name. It does not permit "no MSG" claims on foods containing naturally occurring glutamates.',
  "US",
  "regulatory",
  "2026-08-16",
);
const CFR_FLAVOR = ev(
  "US Code of Federal Regulations",
  '21 CFR 101.22 permits flavouring substances to be declared collectively as "natural flavor" or "artificial flavor" without naming the constituents.',
  "US",
  "regulatory",
  "2026-08-16",
);
const CFR_BLEND = ev(
  "US Food and Drug Administration",
  "21 CFR 101.36 permits a proprietary blend to declare the total weight of the blend without disclosing the quantity of each individual ingredient.",
  "US",
  "regulatory",
  "2026-08-16",
);
const ACOG_CAFFEINE = ev(
  "American College of Obstetricians and Gynecologists",
  "ACOG advises that during pregnancy caffeine intake be limited to under 200 mg per day.",
  "US",
  "established",
  "2026-08-16",
);
const FDA_PREG_DAIRY = ev(
  "US Food and Drug Administration",
  "The FDA advises pregnant people to avoid unpasteurised (raw) milk and soft cheeses made from it.",
  "US",
  "regulatory",
  "2026-08-16",
);
const FDA_MERCURY = ev(
  "US Food and Drug Administration / Environmental Protection Agency",
  'Joint FDA/EPA advice places shark, swordfish, king mackerel, tilefish, marlin, orange roughy and bigeye tuna on the "choices to avoid" list for people who are pregnant or breastfeeding.',
  "US",
  "regulatory",
  "2026-08-16",
);
const MONASH = ev(
  "Monash University FODMAP Program",
  "Monash, which developed the low-FODMAP protocol and maintains its food composition data, lists this among the high-FODMAP ingredients the protocol restricts.",
  "AU",
  "established",
  "2026-08-16",
);
const JECFA_ASPARTAME = ev(
  "Joint FAO/WHO Expert Committee on Food Additives",
  "JECFA reaffirmed the acceptable daily intake for aspartame at 40 mg/kg of body weight in 2023.",
  "international",
  "contested",
  "2026-08-16",
);
const EFSA_CARRAGEENAN = ev(
  "European Food Safety Authority",
  "EFSA's re-evaluation kept carrageenan authorised while noting that the available data did not allow a full assessment, and called for a lower molecular-weight specification.",
  "EU",
  "contested",
  "2026-08-16",
);
const CFR_NITRITE = ev(
  "US Code of Federal Regulations",
  "Sodium and potassium nitrite are permitted as curing agents at limited levels and must be declared on the ingredient list.",
  "US",
  "regulatory",
  "2026-08-16",
);
const VEGAN_SOC = ev(
  "The Vegan Society",
  "Listed among the animal-derived ingredients that commonly appear on labels without an obvious animal name.",
  "UK",
  "established",
  "2026-08-16",
);
const SURGEON_GENERAL = ev(
  "US Surgeon General",
  "US public-health advice is that no amount of alcohol is considered safe during pregnancy.",
  "US",
  "regulatory",
  "2026-08-16",
);

/* -------------------------------------------------------------------------- */
/* Uncertainty                                                                 */
/* -------------------------------------------------------------------------- */

const unc = (kind: UncertaintyKind, note: string, affects: Uncertainty["affects"] = []): Uncertainty => ({
  kind,
  note,
  affects,
});

const UMBRELLA_FLAVOUR = unc(
  "umbrella-term",
  "The label doesn't tell us exactly what's included, so we can't completely check this against your rules.",
);
// Doubt about provenance only. These are still definitely emulsifiers, dough
// conditioners and anti-caking agents — a rule about those is not in doubt.
const ANIMAL_OR_PLANT = unc(
  "may-be-animal-or-plant",
  "This can be made from either plant or animal sources, and the label doesn't say which.",
  ["animal-derived"],
);
const SPECIES_UNKNOWN = unc("species-not-disclosed", "The label doesn't say which animal this came from.", [
  "meat",
  "pork-derived",
]);

/* -------------------------------------------------------------------------- */
/* The entries                                                                 */
/* -------------------------------------------------------------------------- */

export const ENTRIES: KnowledgeEntryInput[] = [
  /* ---- Umbrella terms ---------------------------------------------------- */
  {
    id: "natural-flavors",
    canonical: "Natural flavours",
    names: ["natural flavors", "natural flavours", "natural flavoring", "natural flavouring", "flavoring", "flavouring", "flavour", "flavor"],
    plain: "A collective name for flavouring substances. The label is not required to name them.",
    classes: ["umbrella-term", "additive"],
    evidence: [CFR_FLAVOR],
    uncertainty: [UMBRELLA_FLAVOUR],
  },
  {
    id: "artificial-flavors",
    canonical: "Artificial flavours",
    names: ["artificial flavors", "artificial flavours", "artificial flavoring", "artificial flavouring"],
    plain: "A collective name for synthetic flavouring substances. The label is not required to name them.",
    classes: ["umbrella-term", "additive"],
    evidence: [CFR_FLAVOR],
    uncertainty: [UMBRELLA_FLAVOUR],
  },
  {
    id: "spices",
    canonical: "Spices",
    names: ["spices", "spice", "seasoning", "seasonings"],
    plain: "A collective name for spices. The individual spices are not required to be named.",
    classes: ["umbrella-term"],
    evidence: [CFR_FLAVOR],
    uncertainty: [UMBRELLA_FLAVOUR],
  },
  {
    id: "proprietary-blend",
    canonical: "Proprietary blend",
    // Not bare "blend": a "Protein Blend (Milk Protein Isolate, Whey Protein
    // Concentrate)" names its contents and hides nothing.
    names: ["proprietary blend", "proprietary formula", "proprietary complex", "proprietary matrix"],
    plain: "A named mix that lists its ingredients without saying how much of each is in it.",
    classes: ["umbrella-term"],
    evidence: [CFR_BLEND],
    uncertainty: [
      unc(
        "dose-not-disclosed",
        "The label names what's in this blend but not how much of each, so there's no way to read the dose.",
      ),
    ],
  },

  /* ---- Allergens and provenance ------------------------------------------ */
  {
    id: "peanut",
    canonical: "Peanut",
    names: ["peanut", "peanuts", "peanut butter", "peanut oil", "peanut flour", "peanut protein", "groundnut", "groundnuts", "ground nut", "ground nuts", "arachis oil", "arachis hypogaea", "beer nuts", "monkey nuts"],
    plain: "Peanut, or an ingredient made from it.",
    classes: ["allergen-peanut", "plant-derived"],
    evidence: [FALCPA],
  },
  {
    id: "tree-nut",
    canonical: "Tree nut",
    names: ["almond", "almonds", "almond flour", "almond butter", "cashew", "cashews", "walnut", "walnuts", "pecan", "pecans", "pistachio", "pistachios", "hazelnut", "hazelnuts", "macadamia", "brazil nut", "brazil nuts", "pine nut", "pine nuts", "chestnut", "praline", "marzipan", "nougat", "gianduja"],
    plain: "A tree nut, or an ingredient made from one.",
    classes: ["allergen-tree-nut", "plant-derived"],
    evidence: [FALCPA],
  },
  {
    id: "coconut",
    canonical: "Coconut",
    names: ["coconut", "coconut oil", "coconut milk", "coconut cream", "coconut flour", "desiccated coconut", "creamed coconut", "coconut butter"],
    plain: "Coconut. US labelling rules classify it as a tree nut, though botanically it is a drupe.",
    // Both classes, and this is the point of having them separate: a tree-nut
    // rule matches it because US labelling says so, and a seed-oil rule does
    // not, because coconut oil is a fruit oil.
    classes: ["allergen-tree-nut", "oil-fruit", "plant-derived"],
    evidence: [FALCPA],
  },
  {
    id: "milk",
    canonical: "Milk",
    names: ["milk", "milk powder", "skim milk", "skimmed milk", "whole milk", "buttermilk", "butter", "butterfat", "cream", "cheese", "yogurt", "yoghurt", "whey", "whey protein", "whey protein concentrate", "whey protein isolate", "casein", "caseinate", "sodium caseinate", "calcium caseinate", "milk protein", "milk protein isolate", "ghee", "curd", "milk solids", "milkfat", "condensed milk", "evaporated milk", "custard", "nonfat dry milk"],
    plain: "Milk, or an ingredient made from milk.",
    classes: ["allergen-milk", "dairy", "animal-derived"],
    evidence: [FALCPA, VEGAN_SOC],
  },
  {
    id: "lactose",
    canonical: "Lactose",
    names: ["lactose", "milk sugar"],
    plain: "The sugar naturally present in milk.",
    classes: ["allergen-milk", "dairy", "animal-derived"],
    evidence: [FALCPA],
  },
  {
    id: "egg",
    canonical: "Egg",
    names: ["egg", "eggs", "egg white", "egg yolk", "albumen", "albumin", "ovalbumin", "egg powder", "dried egg", "mayonnaise", "meringue", "lysozyme"],
    plain: "Egg, or an ingredient made from egg.",
    classes: ["allergen-egg", "egg", "animal-derived"],
    evidence: [FALCPA, VEGAN_SOC],
  },
  {
    id: "wheat",
    canonical: "Wheat",
    names: ["wheat", "wheat flour", "flour", "enriched flour", "wheat starch", "wheat protein", "durum", "semolina", "spelt", "farro", "einkorn", "kamut", "couscous", "bulgur", "seitan", "vital wheat gluten", "graham flour"],
    plain: "Wheat, or an ingredient milled from it.",
    classes: ["allergen-wheat", "gluten-grain", "grain", "plant-derived"],
    evidence: [FALCPA],
  },
  {
    id: "barley",
    canonical: "Barley",
    names: ["barley", "malt", "malt extract", "malted barley", "malt syrup", "malt vinegar", "brewers yeast", "brewer's yeast"],
    plain: "Barley, or an ingredient made from it. It is a gluten grain but not one of the nine US major allergens, so it need not be highlighted as one.",
    classes: ["gluten-grain", "grain", "plant-derived"],
    evidence: [FALCPA],
  },
  {
    id: "rye",
    canonical: "Rye",
    names: ["rye", "rye flour", "pumpernickel", "triticale"],
    plain: "Rye, a gluten grain.",
    classes: ["gluten-grain", "grain", "plant-derived"],
    evidence: [FALCPA],
  },
  {
    id: "soy",
    canonical: "Soy",
    names: ["soy", "soya", "soybean", "soybeans", "soy protein", "soy protein isolate", "soy flour", "soy sauce", "tofu", "tempeh", "edamame", "miso", "textured vegetable protein", "tvp", "hydrolyzed soy protein"],
    plain: "Soy, or an ingredient made from soybeans.",
    classes: ["allergen-soy", "plant-derived"],
    evidence: [FALCPA],
  },
  {
    id: "sesame",
    canonical: "Sesame",
    names: ["sesame", "sesame seed", "sesame seeds", "sesame oil", "tahini", "benne", "gingelly", "til", "halva", "hummus"],
    plain: "Sesame, or an ingredient made from it.",
    classes: ["allergen-sesame", "plant-derived"],
    evidence: [FALCPA],
  },
  {
    id: "fish",
    canonical: "Fish",
    names: ["fish", "anchovy", "anchovies", "cod", "salmon", "tuna", "sardine", "sardines", "tilapia", "haddock", "pollock", "fish sauce", "worcestershire sauce", "fish oil", "surimi", "isinglass"],
    plain: "Fish, or an ingredient made from fish.",
    classes: ["allergen-fish", "fish", "animal-derived"],
    evidence: [FALCPA, VEGAN_SOC],
  },
  {
    id: "shellfish",
    canonical: "Shellfish",
    names: ["shrimp", "prawn", "prawns", "crab", "lobster", "crayfish", "crawfish", "langoustine", "krill", "krill oil", "shellfish", "crustacean", "oyster sauce", "oyster", "clam", "mussel", "scallop", "squid", "calamari", "octopus"],
    plain: "Shellfish, or an ingredient made from shellfish.",
    classes: ["allergen-shellfish", "shellfish", "animal-derived"],
    evidence: [FALCPA, VEGAN_SOC],
  },
  {
    id: "pork",
    canonical: "Pork",
    names: ["pork", "bacon", "ham", "lard", "pancetta", "prosciutto", "gammon", "pork gelatin", "pork fat"],
    plain: "Pork, or an ingredient made from it.",
    classes: ["pork-derived", "meat", "animal-derived", "fat-animal"],
    evidence: [VEGAN_SOC],
  },

  /* ---- Hidden animal ingredients — §23's vegan creator message ----------- */
  {
    id: "gelatin",
    canonical: "Gelatin",
    names: ["gelatin", "gelatine", "hydrolyzed collagen", "collagen", "bovine gelatin", "porcine gelatin"],
    plain: "A setting agent made by boiling animal skin, bone or connective tissue.",
    classes: ["animal-derived", "thickener"],
    evidence: [VEGAN_SOC],
    // §14 names this exact case: "gelatin → animal-derived → potential species
    // uncertainty". It matters for a halal or kosher rule, where the answer
    // depends on an animal the label does not name.
    uncertainty: [SPECIES_UNKNOWN],
  },
  {
    id: "carmine",
    canonical: "Carmine",
    names: ["carmine", "cochineal", "cochineal extract", "carminic acid", "crimson lake", "natural red 4"],
    eNumber: "E120",
    plain: "A red colour made from cochineal insects.",
    classes: ["insect-derived", "animal-derived", "colour", "colour-natural"],
    evidence: [VEGAN_SOC],
  },
  {
    id: "shellac",
    canonical: "Shellac",
    names: ["shellac", "confectioners glaze", "confectioner's glaze", "resinous glaze", "pharmaceutical glaze"],
    eNumber: "E904",
    plain: "A glaze made from a resin secreted by the lac insect.",
    classes: ["insect-derived", "animal-derived", "additive"],
    evidence: [VEGAN_SOC],
  },
  {
    id: "l-cysteine",
    canonical: "L-cysteine",
    names: ["l-cysteine", "cysteine"],
    eNumber: "E920",
    plain: "A dough conditioner. It can be made from feathers or hair, or produced by fermentation.",
    classes: ["flour-treatment", "additive"],
    evidence: [VEGAN_SOC],
    uncertainty: [ANIMAL_OR_PLANT],
  },
  {
    id: "mono-and-diglycerides",
    canonical: "Mono- and diglycerides",
    names: ["mono and diglycerides", "mono- and diglycerides", "monoglycerides", "diglycerides", "mono-diglycerides"],
    eNumber: "E471",
    plain: "An emulsifier that keeps fat and water mixed. Made from either plant or animal fat.",
    classes: ["emulsifier", "additive"],
    evidence: [VEGAN_SOC],
    uncertainty: [ANIMAL_OR_PLANT],
  },
  {
    id: "vitamin-d3",
    canonical: "Vitamin D3",
    names: ["vitamin d3", "cholecalciferol"],
    plain: "The form of vitamin D usually made from lanolin, the grease in sheep's wool. A lichen-derived version exists.",
    classes: ["additive"],
    evidence: [VEGAN_SOC],
    uncertainty: [
      unc(
        "source-not-disclosed",
        "D3 is usually made from lanolin; the lichen-derived version normally says so on the label, and this one doesn't.",
        ["animal-derived"],
      ),
    ],
  },
  {
    id: "magnesium-stearate",
    canonical: "Magnesium stearate",
    names: ["magnesium stearate", "stearic acid", "vegetable stearate"],
    eNumber: "E470b",
    plain: "A lubricant that stops powder sticking to tablet machinery. Can be plant or animal derived.",
    classes: ["anti-caking", "additive"],
    evidence: [VEGAN_SOC],
    uncertainty: [ANIMAL_OR_PLANT],
  },

  /* ---- Colours — §5 ICP 1 ------------------------------------------------ */
  {
    id: "red-40",
    canonical: "Red 40",
    names: ["red 40", "red no. 40", "fd&c red no. 40", "fd&c red 40", "allura red", "allura red ac", "red 40 lake"],
    eNumber: "E129",
    plain: "A synthetic red colour.",
    classes: ["colour-synthetic", "colour", "additive"],
    evidence: [EU_AZO],
  },
  {
    id: "yellow-5",
    canonical: "Yellow 5",
    names: ["yellow 5", "yellow no. 5", "fd&c yellow no. 5", "fd&c yellow 5", "tartrazine", "yellow 5 lake"],
    eNumber: "E102",
    plain: "A synthetic yellow colour.",
    classes: ["colour-synthetic", "colour", "additive"],
    evidence: [EU_AZO],
  },
  {
    id: "yellow-6",
    canonical: "Yellow 6",
    names: ["yellow 6", "yellow no. 6", "fd&c yellow no. 6", "fd&c yellow 6", "sunset yellow", "sunset yellow fcf", "yellow 6 lake"],
    eNumber: "E110",
    plain: "A synthetic orange-yellow colour.",
    classes: ["colour-synthetic", "colour", "additive"],
    evidence: [EU_AZO],
  },
  {
    id: "red-3",
    canonical: "Red 3",
    names: ["red 3", "red no. 3", "fd&c red no. 3", "fd&c red 3", "erythrosine", "erythrosin"],
    eNumber: "E127",
    plain: "A synthetic pink-red colour whose US authorisation for food has been revoked, with a compliance date in 2027.",
    classes: ["colour-synthetic", "colour", "additive"],
    evidence: [FDA_RED3, CA_AB418],
  },
  {
    id: "blue-1",
    canonical: "Blue 1",
    names: ["blue 1", "blue no. 1", "fd&c blue no. 1", "fd&c blue 1", "brilliant blue", "brilliant blue fcf"],
    eNumber: "E133",
    plain: "A synthetic blue colour.",
    classes: ["colour-synthetic", "colour", "additive"],
  },
  {
    id: "blue-2",
    canonical: "Blue 2",
    names: ["blue 2", "blue no. 2", "fd&c blue no. 2", "fd&c blue 2", "indigotine", "indigo carmine"],
    eNumber: "E132",
    plain: "A synthetic blue colour.",
    classes: ["colour-synthetic", "colour", "additive"],
  },
  {
    id: "titanium-dioxide",
    canonical: "Titanium dioxide",
    names: ["titanium dioxide", "titanium oxide", "ci 77891"],
    eNumber: "E171",
    plain: "A bright white pigment used to make coatings and icings opaque. Banned as a food additive in the EU, permitted in the US.",
    classes: ["colour", "additive"],
    evidence: [EFSA_TIO2],
  },

  /* ---- Sweeteners -------------------------------------------------------- */
  {
    id: "aspartame",
    canonical: "Aspartame",
    names: ["aspartame", "nutrasweet"],
    eNumber: "E951",
    plain: "A synthetic sweetener roughly 200 times as sweet as sugar.",
    classes: ["sweetener-artificial", "sweetener", "additive"],
    evidence: [JECFA_ASPARTAME],
  },
  {
    id: "sucralose",
    canonical: "Sucralose",
    names: ["sucralose", "splenda"],
    eNumber: "E955",
    plain: "A synthetic sweetener made by modifying sugar.",
    classes: ["sweetener-artificial", "sweetener", "additive"],
  },
  {
    id: "acesulfame-k",
    canonical: "Acesulfame potassium",
    names: ["acesulfame potassium", "acesulfame k", "ace-k", "acesulfame-k"],
    eNumber: "E950",
    plain: "A synthetic sweetener, usually blended with another one.",
    classes: ["sweetener-artificial", "sweetener", "additive"],
  },
  {
    id: "saccharin",
    canonical: "Saccharin",
    names: ["saccharin", "sodium saccharin"],
    eNumber: "E954",
    plain: "One of the oldest synthetic sweeteners.",
    classes: ["sweetener-artificial", "sweetener", "additive"],
  },
  {
    id: "sorbitol",
    canonical: "Sorbitol",
    names: ["sorbitol", "glucitol"],
    eNumber: "E420",
    plain: "A sugar alcohol used as a sweetener and to keep things moist.",
    classes: ["sweetener-sugar-alcohol", "sweetener", "high-fodmap", "additive"],
    evidence: [MONASH],
  },
  {
    id: "mannitol",
    canonical: "Mannitol",
    names: ["mannitol"],
    eNumber: "E421",
    plain: "A sugar alcohol used as a sweetener and bulking agent.",
    classes: ["sweetener-sugar-alcohol", "sweetener", "high-fodmap", "additive"],
    evidence: [MONASH],
  },
  {
    id: "maltitol",
    canonical: "Maltitol",
    names: ["maltitol", "maltitol syrup"],
    eNumber: "E965",
    plain: "A sugar alcohol used in sugar-free confectionery.",
    classes: ["sweetener-sugar-alcohol", "sweetener", "high-fodmap", "additive"],
    evidence: [MONASH],
  },
  {
    id: "erythritol",
    canonical: "Erythritol",
    names: ["erythritol"],
    eNumber: "E968",
    plain: "A sugar alcohol, often paired with stevia or monk fruit.",
    classes: ["sweetener-sugar-alcohol", "sweetener", "additive"],
  },
  {
    id: "stevia",
    canonical: "Stevia",
    names: ["stevia", "steviol glycosides", "rebaudioside a", "reb a"],
    eNumber: "E960",
    plain: "A sweetener extracted from the stevia leaf.",
    classes: ["sweetener-plant", "sweetener", "plant-derived"],
  },
  {
    id: "monk-fruit",
    canonical: "Monk fruit",
    names: ["monk fruit", "monk fruit extract", "luo han guo", "mogroside"],
    plain: "A sweetener extracted from monk fruit.",
    classes: ["sweetener-plant", "sweetener", "plant-derived"],
  },

  /* ---- Sugars and starches ----------------------------------------------- */
  {
    id: "hfcs",
    canonical: "High-fructose corn syrup",
    names: ["high fructose corn syrup", "high-fructose corn syrup", "hfcs", "corn syrup", "glucose-fructose syrup", "isoglucose"],
    plain: "A liquid sweetener made from corn starch.",
    classes: ["sugar-added", "sweetener", "high-fodmap", "plant-derived"],
    evidence: [MONASH],
  },
  {
    id: "sugar",
    canonical: "Sugar",
    names: ["sugar", "cane sugar", "brown sugar", "invert sugar", "sucrose", "dextrose", "glucose", "fructose", "corn sugar", "beet sugar", "raw sugar", "turbinado", "molasses", "honey", "agave", "agave nectar", "agave syrup", "brown rice syrup", "fruit juice concentrate", "maple syrup", "coconut sugar", "date syrup"],
    plain: "An added sweetener.",
    classes: ["sugar-added", "sweetener"],
  },
  {
    id: "maltodextrin",
    canonical: "Maltodextrin",
    names: ["maltodextrin", "malto dextrin"],
    plain: "A starch broken down into a fine white powder, used as a filler, thickener and carrier. It is not a sugar on the label but behaves like one.",
    classes: ["starch-refined", "additive", "plant-derived"],
  },
  {
    id: "modified-starch",
    canonical: "Modified starch",
    names: ["modified corn starch", "modified starch", "modified food starch", "modified tapioca starch"],
    plain: "A starch treated to change how it thickens or holds together.",
    classes: ["starch-refined", "thickener", "additive", "plant-derived"],
  },
  {
    id: "inulin",
    canonical: "Inulin",
    names: ["inulin", "chicory root", "chicory root fiber", "chicory root fibre", "chicory root extract", "oligofructose", "fructooligosaccharides", "fos"],
    plain: "A plant fibre, usually from chicory root, added to raise the fibre number.",
    classes: ["high-fodmap", "plant-derived"],
    evidence: [MONASH],
  },

  /* ---- Fats and oils ----------------------------------------------------- */
  {
    id: "seed-oil",
    canonical: "Seed oil",
    names: ["soybean oil", "sunflower oil", "safflower oil", "canola oil", "rapeseed oil", "corn oil", "cottonseed oil", "grapeseed oil", "rice bran oil", "vegetable oil", "high oleic sunflower oil", "high oleic safflower oil"],
    plain: "An oil pressed or extracted from seeds.",
    classes: ["oil-seed", "oil-vegetable", "oil", "plant-derived"],
  },
  {
    id: "olive-oil",
    canonical: "Olive oil",
    names: ["olive oil", "extra virgin olive oil", "virgin olive oil", "pomace oil"],
    plain: "An oil pressed from olives.",
    classes: ["oil-fruit", "oil-vegetable", "oil", "plant-derived"],
  },
  {
    id: "avocado-oil",
    canonical: "Avocado oil",
    names: ["avocado oil"],
    plain: "An oil pressed from avocado flesh.",
    classes: ["oil-fruit", "oil-vegetable", "oil", "plant-derived"],
  },
  {
    id: "palm-oil",
    canonical: "Palm oil",
    names: ["palm oil", "palm kernel oil", "palm fruit oil", "palmitate"],
    plain: "An oil from the fruit or kernel of the oil palm.",
    classes: ["oil-fruit", "oil-vegetable", "oil", "plant-derived"],
  },
  {
    id: "lecithin",
    canonical: "Lecithin",
    names: ["sunflower lecithin", "soy lecithin", "soya lecithin", "lecithin", "rapeseed lecithin"],
    eNumber: "E322",
    plain: "An emulsifier that stops fat and water separating. Used in very small amounts.",
    // Classed as an emulsifier, not as a seed oil — the distinction the whole
    // seed-oil audience is defined by, and the reason `oil-seed` and `oil-fruit`
    // are siblings rather than parent and child in `classes.ts`.
    // Classed as an emulsifier and nothing else, with no uncertainty attached.
    // It is not a seed oil, so a seed-oil rule simply does not reach it — which
    // is the class tree doing the work, and better than a note explaining why a
    // match the user did not want happened anyway.
    classes: ["emulsifier", "additive", "plant-derived"],
  },
  {
    id: "partially-hydrogenated",
    canonical: "Partially hydrogenated oil",
    names: ["partially hydrogenated oil", "partially hydrogenated soybean oil", "partially hydrogenated cottonseed oil", "partially hydrogenated palm oil", "shortening"],
    plain: "An oil hardened by adding hydrogen. US regulators withdrew its safe-ingredient status in 2015.",
    classes: ["oil-hydrogenated", "oil", "plant-derived"],
    evidence: [FDA_PHO],
  },
  {
    id: "bvo",
    canonical: "Brominated vegetable oil",
    names: ["brominated vegetable oil", "bvo"],
    eNumber: "E443",
    plain: "An oil treated with bromine, formerly used to keep citrus flavour evenly mixed in soft drinks. Its US authorisation was revoked in 2024.",
    classes: ["emulsifier", "oil", "additive"],
    evidence: [FDA_BVO, CA_AB418],
  },
  {
    id: "tallow",
    canonical: "Tallow",
    names: ["tallow", "beef tallow", "suet", "schmaltz", "duck fat"],
    plain: "A rendered animal fat.",
    classes: ["fat-animal", "oil", "meat", "animal-derived"],
    evidence: [VEGAN_SOC],
  },

  /* ---- Preservatives and processing aids --------------------------------- */
  {
    id: "bha",
    canonical: "BHA",
    names: ["bha", "butylated hydroxyanisole"],
    eNumber: "E320",
    plain: "A synthetic antioxidant that stops fats going rancid.",
    classes: ["antioxidant-synthetic", "preservative", "additive"],
    evidence: [
      ev(
        "US Food and Drug Administration",
        "BHA is permitted as a food additive at specified levels under 21 CFR 172.110.",
        "US",
        "regulatory",
        "2026-08-16",
      ),
    ],
  },
  {
    id: "bht",
    canonical: "BHT",
    names: ["bht", "butylated hydroxytoluene"],
    eNumber: "E321",
    plain: "A synthetic antioxidant that stops fats going rancid.",
    classes: ["antioxidant-synthetic", "preservative", "additive"],
  },
  {
    id: "tbhq",
    canonical: "TBHQ",
    names: ["tbhq", "tertiary butylhydroquinone", "tert-butylhydroquinone"],
    eNumber: "E319",
    plain: "A synthetic antioxidant used in fried and packaged foods.",
    classes: ["antioxidant-synthetic", "preservative", "additive"],
  },
  {
    id: "sodium-benzoate",
    canonical: "Sodium benzoate",
    names: ["sodium benzoate", "benzoic acid", "potassium benzoate"],
    eNumber: "E211",
    plain: "A preservative that stops mould and yeast growing, common in acidic drinks.",
    classes: ["preservative", "additive"],
  },
  {
    id: "potassium-sorbate",
    canonical: "Potassium sorbate",
    names: ["potassium sorbate", "sorbic acid"],
    eNumber: "E202",
    plain: "A preservative that slows mould and yeast.",
    classes: ["preservative", "additive"],
  },
  {
    id: "propylparaben",
    canonical: "Propylparaben",
    names: ["propylparaben", "propyl paraben", "propyl p-hydroxybenzoate"],
    eNumber: "E216",
    plain: "A preservative. California has legislated to remove it from food sold in the state from 2027.",
    classes: ["preservative", "additive"],
    evidence: [CA_AB418],
  },
  {
    id: "potassium-bromate",
    canonical: "Potassium bromate",
    names: ["potassium bromate", "bromated flour", "bromated wheat flour"],
    eNumber: "E924",
    plain: "A flour treatment that strengthens dough. Prohibited in the EU, UK and Canada, and legislated against in California from 2027.",
    classes: ["flour-treatment", "additive"],
    evidence: [CA_AB418],
  },
  {
    id: "nitrite",
    canonical: "Nitrite",
    names: ["sodium nitrite", "potassium nitrite", "sodium nitrate", "potassium nitrate", "celery powder", "celery juice powder", "cultured celery extract"],
    eNumber: "E250",
    plain: 'A curing salt that keeps cured meat pink and slows spoilage. Celery powder is the same chemistry from a plant source, which is how "uncured" products are cured.',
    classes: ["nitrite-source", "preservative", "additive"],
    evidence: [CFR_NITRITE],
  },
  {
    id: "sulfites",
    canonical: "Sulfites",
    names: ["sulfites", "sulphites", "sulfur dioxide", "sulphur dioxide", "sodium sulfite", "sodium bisulfite", "sodium metabisulfite", "potassium metabisulfite", "potassium bisulfite"],
    eNumber: "E220",
    plain: "A preservative used in dried fruit, wine and some processed potato products.",
    classes: ["sulfite-source", "preservative", "additive"],
    evidence: [FDA_SULFITE],
  },
  {
    id: "carrageenan",
    canonical: "Carrageenan",
    names: ["carrageenan", "irish moss extract"],
    eNumber: "E407",
    plain: "A thickener extracted from red seaweed, common in plant milks and cream.",
    classes: ["thickener", "additive", "plant-derived"],
    evidence: [EFSA_CARRAGEENAN],
  },
  {
    id: "xanthan-gum",
    canonical: "Xanthan gum",
    names: ["xanthan gum", "xanthan"],
    eNumber: "E415",
    plain: "A thickener produced by fermentation.",
    classes: ["thickener", "additive"],
  },
  {
    id: "gellan-gum",
    canonical: "Gellan gum",
    names: ["gellan gum", "gellan"],
    eNumber: "E418",
    plain: "A thickener produced by fermentation, common in plant milks.",
    classes: ["thickener", "additive"],
  },
  {
    id: "polysorbate-80",
    canonical: "Polysorbate 80",
    names: ["polysorbate 80", "polysorbate 60", "polysorbate", "tween 80"],
    eNumber: "E433",
    plain: "A synthetic emulsifier used to keep oil and water mixed.",
    classes: ["emulsifier", "additive"],
  },
  {
    id: "msg",
    canonical: "Monosodium glutamate",
    names: ["monosodium glutamate", "msg", "glutamic acid", "monopotassium glutamate", "autolyzed yeast extract", "yeast extract", "hydrolyzed vegetable protein", "hydrolysed vegetable protein"],
    eNumber: "E621",
    plain: 'A savoury flavour enhancer. Yeast extract and hydrolysed protein carry the same compound, which is how a product can say "no MSG added" and still taste of it.',
    classes: ["flavour-enhancer", "additive"],
    evidence: [FDA_MSG],
  },
  {
    id: "silicon-dioxide",
    canonical: "Silicon dioxide",
    names: ["silicon dioxide", "silica", "silicon dioxide anticaking"],
    eNumber: "E551",
    plain: "An anti-caking agent that stops powder clumping.",
    classes: ["anti-caking", "additive"],
  },

  /* ---- Caffeine, alcohol, pregnancy checks ------------------------------- */
  {
    id: "caffeine",
    canonical: "Caffeine",
    names: ["caffeine", "anhydrous caffeine", "caffeine anhydrous", "guarana", "guarana extract", "green tea extract", "yerba mate", "coffee extract"],
    plain: "A stimulant. Guarana and some extracts are concentrated sources of it.",
    classes: ["caffeine-source"],
    evidence: [ACOG_CAFFEINE],
    uncertainty: [
      // Doubt about the amount, never about whether caffeine is present. A rule
      // that flags caffeine is answered by the label; a rule about how much
      // would not be, and there is no such rule.
      unc("dose-not-disclosed", "The label declares caffeine but not how much, so there's no way to read the amount.", []),
    ],
  },
  {
    id: "alcohol",
    canonical: "Alcohol",
    names: ["alcohol", "ethanol", "ethyl alcohol", "wine", "beer", "rum", "brandy", "liqueur", "bourbon", "whisky", "whiskey", "vodka"],
    plain: "An alcoholic ingredient.",
    classes: ["alcohol"],
    evidence: [SURGEON_GENERAL],
  },
  {
    id: "unpasteurised-dairy",
    canonical: "Unpasteurised dairy",
    names: ["raw milk", "unpasteurized milk", "unpasteurised milk", "raw milk cheese", "unpasteurized cheese", "unpasteurised cheese", "queso fresco", "brie", "camembert", "roquefort", "gorgonzola", "feta"],
    plain: "Milk or cheese that has not been heat-treated, or a soft cheese often made that way. US food-safety advice puts these on the avoid list during pregnancy.",
    classes: ["allergen-milk", "dairy", "animal-derived"],
    evidence: [FDA_PREG_DAIRY],
    uncertainty: [
      // It is dairy and an allergen either way; what the label may not settle is
      // whether it is pasteurised, which no class here represents.
      unc(
        "insufficient-label-information",
        "Many of these cheeses are made from pasteurised milk in the US; if this one is, the packaging will say so.",
        [],
      ),
    ],
  },
  {
    id: "high-mercury-fish",
    canonical: "High-mercury fish",
    names: ["shark", "swordfish", "king mackerel", "tilefish", "marlin", "orange roughy", "bigeye tuna"],
    plain: 'A fish that joint FDA and EPA advice places on the "choices to avoid" list for people who are pregnant or breastfeeding.',
    classes: ["allergen-fish", "fish", "animal-derived"],
    evidence: [FDA_MERCURY],
  },
];
