import type { BusinessProfile, BrandBlueprint } from "@/lib/domain/profile";
import {
  FONTS,
  audienceShort,
  brandName,
  buildPalette,
  clip,
  isDigital,
  productsShort,
  sentence,
  spell,
  styleFamily,
  traitWords,
} from "./util";

const TRAIT_PRACTICE: [RegExp, string][] = [
  [/warm|kind|friendly|caring/i, "Write like you're talking to one person. Use 'you'. Thank people properly."],
  [/witty|funny|cheeky|playful|fun/i, "One light line per page is plenty. The joke never gets in the way of the facts."],
  [/calm|gentle|soft|quiet/i, "Short sentences, no exclamation marks in a row, nothing shouty in capitals."],
  [/bold|confident|direct|ambitious/i, "Say the point first. Cut 'just', 'maybe' and 'kind of'."],
  [/clear|honest|transparent|practical/i, "Specifics over adjectives: sizes, materials, timings — the things people actually ask."],
  [/luxe|elegant|refined|premium|sophisticated/i, "Fewer words, chosen carefully. Let space and photography do the selling."],
  [/considered|thoughtful|careful/i, "Explain the why behind a choice — a material, a size, a detail."],
  [/earthy|natural|grounded/i, "Describe texture and process honestly; never imply eco credentials you can't show."],
];

function practiceFor(trait: string): string {
  return (
    TRAIT_PRACTICE.find(([re]) => re.test(trait))?.[1] ??
    `Check every headline, caption and email against “${trait}” before it goes out.`
  );
}

const PHOTO: Record<ReturnType<typeof styleFamily>, string> = {
  minimal:
    "Plain, light backgrounds, soft daylight, one product per frame and plenty of empty space. Consistent angles so the grid looks calm.",
  earthy:
    "Natural light, real textures (linen, wood, paper, stone) and hands at work. Warm tones; nothing staged to look like something it isn't.",
  playful:
    "Bright, even light and colour-blocked backgrounds from the palette. Movement and hands in shot; crop boldly.",
  luxe:
    "Directional soft light with gentle shadow, close crops on detail, one accent colour per image. Fewer, better photos.",
  classic:
    "Clean daylight, neutral backgrounds and a consistent angle for every product, with one lifestyle image per product in a real setting.",
};

export function mockBrandBlueprint(profile: BusinessProfile): BrandBlueprint {
  const name = brandName(profile);
  const audience = audienceShort(profile);
  const products = productsShort(profile);
  const traits = traitWords(profile);
  const family = styleFamily(profile);
  const colour = spell(profile.market, "colour");

  return {
    positioning: clip(
      sentence(
        `${name} makes ${products} for ${audience}${profile.goal ? `, built around one aim: ${profile.goal.replace(/\.$/, "")}` : ""}`,
      ) +
        " The difference to lead with: [the one thing you do that others in your category don't — add it in your own words].",
      600,
    ),
    idealCustomer: clip(
      `${sentence(profile.audience)} She's looking for ${products} and wants to buy from someone who understands her situation. ` +
        `She shops ${isDigital(profile) ? "online and wants instant, simple delivery" : "online and wants to know exactly what arrives and when"}. ` +
        "What stops her buying: unclear details, prices that feel unexplained, and stores that don't feel run by a real person.",
      900,
    ),
    personality: traits.slice(0, 5).map((trait) => ({
      trait: clip(trait[0]!.toUpperCase() + trait.slice(1), 60),
      inPractice: practiceFor(trait),
    })),
    colourPalette: buildPalette(profile),
    typography: FONTS[family],
    copyTone: {
      summary: clip(
        `${traits.slice(0, 3).join(", ")}. ${name} sounds like a person, not a company: specific, useful and quietly sure of what it makes.`,
        500,
      ),
      doSay: [
        `“Made for ${clip(audience, 60)}.”`,
        "Plain descriptions of what it is, what it's made of and how it arrives.",
        "The reason behind each design choice, in one sentence.",
      ],
      avoid: [
        "Hype words: elevate, unlock, game-changer, must-have.",
        "Claims you can't back up — reviews, awards, eco or health promises.",
        "Pressure: countdowns, stock scares and invented deadlines.",
      ],
    },
    photography: PHOTO[family] + ` Keep every image within the ${colour} palette above so the store looks like one brand.`,
    consistency: [
      `Use the brand name exactly as “${name}” everywhere.`,
      `Stick to the ${colour} palette; one accent per image or section.`,
      "Two fonts maximum, the same on Shopify, Canva and email.",
      "Every product photo shot from the same main angle with the same light.",
      "Read every caption aloud — if it doesn't sound like you, rewrite it.",
    ],
  };
}
