import type { BusinessProfile } from "@/lib/domain/profile";
import { missingProductInformation, type Product } from "@/lib/domain/product";
import type { ModuleOutput } from "@/lib/domain/modules";
import {
  audienceShort,
  brandName,
  buildPalette,
  clip,
  isDigital,
  listFrom,
  lower,
  price,
  sentence,
  spell,
} from "./util";

export function mockProductListing(
  profile: BusinessProfile,
  product: Product,
): ModuleOutput<"product_listing"> {
  const name = brandName(profile);
  const audience = audienceShort(profile);
  const digital = isDigital(profile);
  const benefits = listFrom(product.benefits);
  const facts = [...product.verifiedClaims];
  const problem = product.customerProblem ? lower(product.customerProblem.replace(/\.$/, "")) : "";
  const use = product.intendedUse ? lower(product.intendedUse.replace(/\.$/, "")) : "";

  const bullets = [
    ...benefits.slice(0, 4).map((benefit) => ({
      feature: clip(benefit[0]!.toUpperCase() + benefit.slice(1), 120),
      benefit: use ? clip(`So it works for ${use}.`, 240) : "[Say what this means for her day.]",
    })),
    ...(product.materials
      ? [
          {
            feature: clip(product.materials, 120),
            benefit: "[Why this material or format matters.]",
          },
        ]
      : []),
  ];
  while (bullets.length < 2)
    bullets.push({ feature: "[A real feature]", benefit: "[What it does for the customer]" });

  const specs: { label: string; value: string }[] = [];
  if (product.materials)
    specs.push({ label: digital ? "Includes" : "Materials", value: clip(product.materials, 300) });
  if (product.dimensions) specs.push({ label: "Size", value: clip(product.dimensions, 300) });
  if (product.colourOptions)
    specs.push({
      label: spell(profile.market, "colour") === "color" ? "Colors" : "Colours",
      value: clip(product.colourOptions, 300),
    });
  if (product.careInstructions)
    specs.push({ label: "Care", value: clip(product.careInstructions, 300) });
  if (product.shippingInfo)
    specs.push({
      label: digital ? "Delivery" : "Shipping",
      value: clip(product.shippingInfo, 300),
    });
  for (const fact of facts.slice(0, 4))
    specs.push({ label: "Good to know", value: clip(fact, 300) });

  const opener = problem
    ? `If ${problem}, ${product.name} is the fix.`
    : `${product.name}, made for ${audience}.`;
  // Little Offer Kit › "Product description" template: promise, who it's
  // for, what's inside, format and what she'll need, what it's not.
  const promise = problem
    ? `${product.name} helps ${audience} when ${problem}.`
    : `${product.name} helps ${audience} [get what result] [in how long].`;
  const description = [
    sentence(promise),
    `This is for you if:\n- ${problem ? sentence(problem[0]!.toUpperCase() + problem.slice(1)) : "[situation 1]"}\n- ${use ? sentence(`You want it for ${use}`) : "[situation 2]"}\n- [situation 3]`,
    `What's inside:\n${(benefits.length ? benefits.slice(0, 4) : ["[Part 1 — what it helps you do]", "[Part 2]"]).map((b) => `- ${b[0]!.toUpperCase()}${b.slice(1)}`).join("\n")}${product.materials ? `\n- ${digital ? "What you get" : "Made from"}: ${product.materials}` : ""}`,
    facts.length ? facts.map((f) => sentence(f)).join(" ") : "",
    product.careInstructions ? `Care: ${sentence(product.careInstructions)}` : "",
    product.shippingInfo ? sentence(product.shippingInfo) : "[Add delivery details.]",
    "What it's not: [e.g. a custom order / a full system].",
    "Questions before you buy? Email [your email].",
  ]
    .filter(Boolean)
    .join("\n\n");

  const faq = [
    product.dimensions
      ? { question: "What size is it?", answer: clip(sentence(product.dimensions), 800) }
      : { question: "What size is it?", answer: "[Add the dimensions.]" },
    product.shippingInfo
      ? {
          question: digital ? "How do I receive it?" : "When will it arrive?",
          answer: clip(sentence(product.shippingInfo), 800),
        }
      : {
          question: digital ? "How do I receive it?" : "When will it arrive?",
          answer: "[Add your delivery details.]",
        },
  ];
  if (product.careInstructions)
    faq.push({
      question: "How do I care for it?",
      answer: clip(sentence(product.careInstructions), 800),
    });

  const seoTitle = clip(`${product.name} | ${name}`, 70);
  const seoDescription = clip(
    `${product.name} from ${name}${problem ? ` — for when ${problem}` : ""}${product.price !== null ? `. ${price(profile, product)}` : ""}.`,
    160,
  );

  return {
    title: clip(product.name, 120),
    shortDescription: clip(sentence(opener), 400),
    description: clip(description, 3000),
    bullets: bullets.slice(0, 8),
    specifications: specs.slice(0, 15),
    faq,
    seoTitle,
    seoDescription,
    collectionDescription: clip(
      `${product.category ? `${product.category} from ${name}` : `From ${name}`}, made for ${audience}. [Add a line about what ties this collection together.]`,
      600,
    ),
    socialCaption: clip(
      `${opener} ${benefits[0] ? sentence(benefits[0]) : ""} Shop ${product.name} — link in bio.`,
      600,
    ),
    missingInformation: missingProductInformation(product, profile.fulfilment),
  };
}

export function mockImageBriefs(
  profile: BusinessProfile,
  product: Product,
): ModuleOutput<"image_briefs"> {
  const palette = profile.brand?.colourPalette ?? buildPalette(profile);
  const bg = palette[0]!;
  const soft = palette[3] ?? palette[0]!;
  const described = product.imageNotes || product.materials || product.name;
  const digital = isDigital(profile);
  const subject = digital ? `${product.name} shown on a screen or as a printed page` : product.name;

  const base = {
    props: [] as string[],
    avoid: [
      "Adding anything to the product that isn't really there.",
      "Filters that change the product's real colour.",
      "Busy backgrounds that compete with the product.",
    ],
  };

  return {
    accuracyNote:
      "Shoot the real product. Any edited, AI-assisted or mockup image must still match what the customer receives — colour, size, label and finish. AI image tools often get lettering, logos and proportions wrong, so check every image against the product before you publish it, and label illustrative images as such.",
    primary: {
      ...base,
      purpose: "The main listing photo and collection thumbnail.",
      setup: clip(
        `${subject}, centred, filling about 70% of the frame. What it is: ${described}.`,
        800,
      ),
      background: `Plain ${bg.name.toLowerCase()} (${bg.hex}) paper or wall.`,
      lighting:
        "Soft daylight from a window to one side; a white card on the other side to lift shadows.",
      composition: "Straight on or a slight three-quarter angle. Same angle for every product.",
      aspectRatio: "1:1 square (2048 × 2048px)",
      shotList: ["Front", "Three-quarter angle", "Back or alternative side"],
    },
    detail: {
      ...base,
      purpose: "Shows quality and answers “what's it like up close?”",
      setup: clip(
        `Close-ups of ${product.materials ? `the ${lower(product.materials)}` : "the most important detail"} on ${product.name}.`,
        800,
      ),
      background: `Same as the main photo, or ${soft.name.toLowerCase()} (${soft.hex}).`,
      lighting: "Raking side light to show texture; avoid flash.",
      composition: "Fill the frame with one detail per shot. Keep it sharp — tap to focus.",
      aspectRatio: "4:5 portrait (1600 × 2000px)",
      shotList: [
        "Texture or finish",
        "Closure, edge or seam",
        product.dimensions
          ? "Size reference beside a common object"
          : "Size reference (add dimensions to your product first)",
      ],
    },
    lifestyle: {
      ...base,
      props: [
        "Only everyday items that suit your customer — nothing that could be mistaken for part of the product",
      ],
      purpose: `Helps ${audienceShort(profile)} picture it in her own life.`,
      setup: clip(
        `${product.name} in use${product.intendedUse ? `: ${lower(product.intendedUse)}` : ""}. Hands in shot work well if you'd rather not show faces.`,
        800,
      ),
      background: "A real, tidy setting in your palette's tones.",
      lighting: "Natural daylight; shoot mid-morning or late afternoon for softer light.",
      composition:
        "Product in the foreground and in focus; leave space at the top for text if you'll use it as a banner.",
      aspectRatio: "4:5 portrait for product pages; 16:9 landscape for the homepage banner",
      shotList: ["In use", "In context, wider", "A moment just before or after use"],
    },
    instagram: {
      ...base,
      purpose: "A launch post or story graphic.",
      setup: `Your best primary or lifestyle photo, with a short line of text added in Canva.`,
      background: `Photo, or a ${soft.hex} panel for the text.`,
      lighting: "As the source photo.",
      composition:
        "Keep the product in the centre two-thirds — Instagram crops the edges in the grid.",
      aspectRatio:
        "4:5 (1080 × 1350px) for feed; 9:16 (1080 × 1920px) for Stories and Reels covers",
      shotList: ["Feed post", "Story version", "Reel cover"],
    },
    canvaSteps: [
      "Create a design at 1080 × 1350px (Instagram post, portrait).",
      "Upload your own product photo and place it to fill the frame.",
      `Add your brand ${spell(profile.market, "colour")}s to Brand Kit: ${palette.map((p) => p.hex).join(", ")}.`,
      "Add one short line of text — your launch message — in your heading font.",
      "Keep text away from the edges and off the product itself.",
      "Download as PNG. Check it on your phone before posting.",
    ],
    aiEditPrompts: [
      {
        purpose: "Clean up the background of your own photo",
        prompt: `Replace the background with a plain, evenly lit ${bg.name.toLowerCase()} (${bg.hex}) backdrop with a soft natural shadow. Do not change the product in any way — keep its shape, size, colour, texture and any text or logo exactly as in the original.`,
        caution: "Zoom in afterwards: check edges, text and colour haven't shifted.",
      },
      {
        purpose: "Extend a photo to fit a banner",
        prompt:
          "Extend the background on the left and right to make a 16:9 image, matching the existing surface and light. Do not alter, move or add to the product.",
        caution: "Don't use generated scenes as if they were real places or uses.",
      },
    ],
  };
}
