import type { BusinessProfile } from "@/lib/domain/profile";
import type { Product } from "@/lib/domain/product";
import {
  SIDEKICK_PROMPT_KEYS,
  SIDEKICK_PROMPT_TITLES,
  type ModuleOutput,
  type SidekickPromptKey,
} from "@/lib/domain/modules";
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
} from "./util";

/** "A serif such as Lora or Cormorant" → "Lora". */
export function fontName(direction: string, fallback: string): string {
  return direction.match(/such as ([A-Z][A-Za-z ]*?)(?= or|,|\.| at|$)/)?.[1]?.trim() ?? fallback;
}

function look(profile: BusinessProfile) {
  const palette = profile.brand?.colourPalette ?? buildPalette(profile);
  const fonts = profile.brand?.typography ?? FONTS[styleFamily(profile)];
  const [bg, text, accent, soft] = [
    palette[0]!,
    palette[1]!,
    palette[2] ?? palette[1]!,
    palette[3] ?? palette[0]!,
  ];
  return { palette, fonts, bg, text, accent, soft };
}

export function mockThemeBrief(
  profile: BusinessProfile,
  products: Product[],
): ModuleOutput<"theme_brief"> {
  const name = brandName(profile);
  const audience = audienceShort(profile);
  const { bg, text, accent, fonts } = look(profile);
  const digital = isDigital(profile);
  const colour = spell(profile.market, "colour");
  const hero = products[0]?.name ?? "[your hero product]";

  return {
    homepageObjective: sentence(
      `Within five seconds, ${audience} should know what ${name} sells, who it's for and where to tap to buy. The main job of the homepage is to get her to a product page`,
    ),
    customerPositioning: clip(
      profile.brand?.positioning ?? sentence(`${name}: ${productsShort(profile)} for ${audience}`),
      600,
    ),
    visualDirection: clip(
      `Background ${bg.hex}, text ${text.hex}, buttons and links ${accent.hex}. Headings: ${fonts.headings} Body: ${fonts.body} ` +
        "Lots of space between sections, large product photos, no more than one accent per section.",
      900,
    ),
    navigation: [
      {
        label: "Shop",
        purpose: "All products, or your main collection. The first thing in the menu.",
      },
      {
        label: "About",
        purpose: `Who is behind ${name} and why it exists. Builds trust for a new brand.`,
      },
      {
        label: digital ? "How it works" : "Shipping & returns",
        purpose: digital
          ? "How downloads are delivered and used."
          : "Your real delivery times, costs and returns policy.",
      },
      {
        label: "Contact",
        purpose: "A real way to reach you. Essential for a store nobody has heard of yet.",
      },
    ],
    homepageSections: [
      {
        section: "Announcement bar",
        purpose: "One useful message.",
        content: digital
          ? "Instant download on every order."
          : "[Your shipping message — only if true, e.g. your real free-shipping threshold]",
      },
      {
        section: "Hero (image banner)",
        purpose: "Say what you sell and who it's for.",
        content:
          "Headline, one supporting line, one button to Shop. A real photo of your product, not stock.",
      },
      {
        section: "Featured collection",
        purpose: "Get her to a product fast.",
        content: `Your best sellers or launch range, starting with ${hero}. 4–8 products.`,
      },
      {
        section: "Benefits (multicolumn)",
        purpose: "Answer “why this one?”",
        content: "Three short benefits you can back up — from your verified facts only.",
      },
      {
        section: "About (image with text)",
        purpose: "Show there's a real person here.",
        content: `A photo and a short story of why ${name} exists.`,
      },
      {
        section: "FAQ (collapsible content)",
        purpose: "Remove buying doubts.",
        content: digital
          ? "Delivery, file formats, licence, refunds."
          : "Delivery times, sizing, care, returns.",
      },
      {
        section: "Email signup",
        purpose: "Catch people who aren't ready yet.",
        content:
          "Invite them to hear about launches. No fake discount unless you really offer one.",
      },
    ],
    productPage: [
      "Large, consistent product photos first, with a zoomable detail shot.",
      "Price, options and the Add to cart button visible without scrolling on mobile.",
      digital
        ? "Say exactly what's included and how it's delivered, near the button."
        : "Real delivery times and costs near the button — or a link to your shipping page.",
      "Short description up top; full details, specifications and care in collapsible tabs below.",
      "FAQ for the product's two or three most common questions.",
    ],
    mobile: [
      "Check every page at phone width before publishing — most of your visitors will be on a phone.",
      "Hero headline readable without zooming; button at least 44px tall.",
      "No text baked into images (it won't resize and screen readers can't read it).",
      "Menu has four items or fewer.",
    ],
    conversion: [
      "One main call to action per section.",
      "Clear prices — no surprise costs at checkout.",
      "Run a real test order before launch.",
      "Don't add countdown timers or stock counters unless they reflect reality.",
    ],
    accessibility: [
      `Body text in ${text.hex} on ${bg.hex}; check any other ${colour} pairing reaches a 4.5:1 contrast ratio.`,
      "Write alt text for every product image describing what's actually in it.",
      "Body text at least 16px; don't use light grey for paragraphs.",
      "Links and buttons say where they go (“Shop the aprons”, not “Click here”).",
    ],
    trust: [
      "Shipping, refund, privacy and terms pages, linked in the footer.",
      "A real contact email and, if you're comfortable, your location.",
      "Your own photos of your own products.",
      "Reviews only once real customers have left them — never placeholders or invented ones.",
    ],
  };
}

type Prompt = ModuleOutput<"theme_prompts">["prompts"][number];

export function mockThemePrompts(
  profile: BusinessProfile,
  products: Product[],
  sampleOnly: boolean,
): ModuleOutput<"theme_prompts"> {
  const name = brandName(profile);
  const audience = audienceShort(profile);
  const { bg, text, accent, soft, fonts } = look(profile);
  const digital = isDigital(profile);
  const colour = spell(profile.market, "colour");
  const hero = products[0]?.name ?? "[your hero product]";

  const prompts: Record<SidekickPromptKey, Omit<Prompt, "key" | "title">> = {
    global_design: {
      whereToUse:
        "Online Store → Themes → Customize (on a duplicate of your theme), then open Sidekick.",
      whatItChanges: `Theme settings: ${colour} scheme, fonts and button style across the whole store.`,
      themeDependency: `Every theme names its settings differently. Sidekick can usually change ${colour}s and fonts in theme settings; if it can't, it will tell you where to change them yourself.`,
      prompt: `In my theme settings, update the ${colour} scheme for ${name}: background ${bg.hex}, text ${text.hex}, buttons and links ${accent.hex}, secondary section background ${soft.hex}. Set headings to ${fontName(fonts.headings, "a serif from the font library")} and body text to ${fontName(fonts.body, "a clean sans-serif")}. Make buttons solid with text in ${bg.hex}. Don't change any section content and don't publish.`,
      verify: [
        `Button text is readable on ${accent.hex}.`,
        "Fonts changed on headings, body, buttons and the menu.",
        "Checkout still looks right (it uses some theme colours).",
      ],
      review: "Preview the homepage, a product page and the cart on desktop and on phone width.",
      manualAdjustments: "possible",
      manualNote:
        "Font names may not match exactly — pick the closest one in Shopify's font picker.",
    },
    hero: {
      whereToUse: "Theme editor → Home page, with the hero or image banner section selected.",
      whatItChanges:
        "The first section on your homepage: headline, supporting text, button and image.",
      themeDependency:
        "Works best with an Image banner or Slideshow section. Image uploads are done by you.",
      prompt: `Update my homepage hero for ${name}. Headline: “[paste your hero headline from Homepage copy]”. Supporting text: “[paste your subheadline]”. One button labelled “Shop now” linking to my main collection. Use a ${bg.hex} or image background with text in ${text.hex}. Keep it to one slide. Leave the image for me to upload.`,
      verify: [
        "Headline isn't cut off on a phone.",
        "Button goes to the right collection.",
        "Text is readable over the image — add an overlay if not.",
      ],
      review: "Look at it on a phone first. Can you tell what the store sells in five seconds?",
      manualAdjustments: "likely",
      manualNote: "You'll upload your own photo and may need to adjust the overlay or focal point.",
    },
    announcement_bar: {
      whereToUse: "Theme editor → Header group → Announcement bar.",
      whatItChanges: "The thin message bar at the very top of every page.",
      themeDependency:
        "Most free themes include an announcement bar; a few put it in the header settings.",
      prompt: `Set my announcement bar to one message: “${digital ? "Instant download on every order" : "[your real shipping message]"}”. Background ${soft.hex}, text ${text.hex}. No scrolling or rotating messages.`,
      verify: [
        "The message is true today.",
        "It's readable on a phone (short enough to fit on one line).",
      ],
      review: "Check it on the homepage and a product page.",
      manualAdjustments: "unlikely",
      manualNote: "If your theme rotates messages, turn rotation off in the section settings.",
    },
    featured: {
      whereToUse: "Theme editor → Home page → Featured collection section.",
      whatItChanges: "The product grid on your homepage.",
      themeDependency: "Needs a collection to exist first (Products → Collections).",
      prompt: `Add a Featured collection section below the hero showing my launch collection, ${products.length > 0 ? `starting with ${hero}` : "four products"}. Heading: “Shop the collection”. Show four products on desktop and two per row on mobile, with a “View all” button.`,
      verify: [
        "The right collection is selected.",
        "Product images are the same shape (crop consistently).",
      ],
      review: "Tap through to a product from the homepage on your phone.",
      manualAdjustments: "possible",
      manualNote: "Create and fill the collection yourself if Sidekick can't.",
    },
    benefits: {
      whereToUse: "Theme editor → Home page → add a Multicolumn (or Icons with text) section.",
      whatItChanges: "Adds three short benefit columns.",
      themeDependency: "Section names vary: Multicolumn, Icons with text, or Text columns.",
      prompt: `Add a Multicolumn section after the featured collection with three columns for ${name}. Use the three value props from my Homepage copy as the headings and text. No images, ${soft.hex} background, centred text.`,
      verify: [
        "Every benefit is true and backed by your verified facts.",
        "Columns stack neatly on mobile.",
      ],
      review: "Read each benefit aloud. Would a customer believe it?",
      manualAdjustments: "possible",
      manualNote: "Paste the text yourself if Sidekick writes its own — use yours.",
    },
    product_page: {
      whereToUse: "Theme editor → Products → Default product template.",
      whatItChanges: "The layout of every product page.",
      themeDependency:
        "Changes the default template, so every product inherits it. Some blocks only exist in some themes.",
      prompt: `On my default product template, put the price and Add to cart button directly under the title, then a short description, then collapsible tabs for “Details”, ${digital ? "“What's included”" : "“Shipping & returns”"} and “Care”. Remove any placeholder review stars or badges. Don't change my product data.`,
      verify: [
        "Add to cart is visible without scrolling on a phone.",
        "No placeholder reviews, ratings or badges.",
        "Tabs show the right content.",
      ],
      review: "Open two different products and check both look right.",
      manualAdjustments: "likely",
      manualNote: "You'll add the tab content per product, or link tabs to a page.",
    },
    faq: {
      whereToUse: "Theme editor → Home page (or a new FAQ page) → Collapsible content section.",
      whatItChanges: "Adds a question-and-answer section.",
      themeDependency: "Free Shopify themes call this “Collapsible content”.",
      prompt: `Add a Collapsible content section titled “Questions, answered” with the FAQ from my Homepage copy. One row per question, all closed by default.`,
      verify: [
        "Every answer matches your real policies.",
        "Nothing promises delivery times you haven't confirmed.",
      ],
      review: "Ask someone who doesn't know your business to read it.",
      manualAdjustments: "possible",
      manualNote: "Long answers may need trimming to look tidy.",
    },
    about: {
      whereToUse: "Theme editor → Home page → Image with text section (and your About page).",
      whatItChanges: "A short story section with a photo.",
      themeDependency: "Image with text exists in most themes; you upload the image.",
      prompt: `Add an Image with text section near the end of the homepage. Heading: “Hello, we're ${name}”. Text: “[paste your About blurb from Homepage copy]”. Button “Read our story” linking to my About page. Image on the left on desktop.`,
      verify: ["The story is accurate.", "The photo is yours."],
      review: "Does it sound like you? Edit until it does.",
      manualAdjustments: "likely",
      manualNote: "Upload your own photo; write your About page if you haven't.",
    },
    email_signup: {
      whereToUse: "Theme editor → Home page → Email signup (Newsletter) section.",
      whatItChanges: "Adds a signup form connected to Shopify Customers / Shopify Email.",
      themeDependency: "Built into free themes. Third-party email apps may need their own form.",
      prompt: `Add an Email signup section before the footer. Heading: “[paste your signup headline]”. Text: “[paste your signup text]”. Background ${soft.hex}. Don't add a discount or popup.`,
      verify: [
        "Sign up with your own email and check it appears in Customers.",
        "No discount is promised unless you've set one up.",
      ],
      review: "Test the form on your phone.",
      manualAdjustments: "unlikely",
      manualNote: "If you use Klaviyo or Mailchimp, use their form instead.",
    },
    footer_nav: {
      whereToUse: "Online Store → Navigation for menus, then Theme editor → Footer.",
      whatItChanges: "Main menu and footer links.",
      themeDependency:
        "Menus live in Navigation, not the theme. Sidekick can help you create them.",
      prompt: `Create a main menu with: Shop, About, ${digital ? "How it works" : "Shipping & returns"}, Contact. Create a footer menu with: Shipping policy, Refund policy, Privacy policy, Terms of service, Contact. Show the footer menu and my social links in the footer, with “© ${name}”.`,
      verify: ["Every link goes to a real page.", "Your policy pages exist (Settings → Policies)."],
      review: "Click every menu and footer link on desktop and phone.",
      manualAdjustments: "possible",
      manualNote: "Policy pages must be written or generated in Settings → Policies first.",
    },
  };

  const keys = sampleOnly ? (["global_design"] as const) : SIDEKICK_PROMPT_KEYS;
  return {
    beforeYouStart: [
      "Duplicate your live theme first (Online Store → Themes → ⋯ → Duplicate) and make every change on the copy.",
      "Sidekick suggests changes; you approve them. Read what it plans before saying yes.",
      "Do one prompt at a time and preview after each.",
      "Never publish until you've checked the copy on a phone and a laptop.",
      `These prompts use ${name}'s details for ${audience}. Edit anything that isn't quite right first.`,
    ],
    prompts: keys.map((key) => ({
      key,
      title: SIDEKICK_PROMPT_TITLES[key],
      ...prompts[key],
      prompt: clip(prompts[key].prompt, 2500),
    })),
  };
}

export function mockHomepageCopy(
  profile: BusinessProfile,
  products: Product[],
): ModuleOutput<"homepage_copy"> {
  const name = brandName(profile);
  const audience = audienceShort(profile);
  const productsText = productsShort(profile);
  const digital = isDigital(profile);
  const facts = profile.verifiedClaims;
  const needs: string[] = [];
  if (!digital)
    needs.push("Your delivery times and shipping costs (for the announcement bar and FAQ).");
  needs.push("Your returns or refund policy in a sentence.");
  needs.push("The one thing that makes you different, in your words, for the hero.");
  if (facts.length < 3)
    needs.push(
      "More verified facts (materials, where it's made, how) to strengthen the value props.",
    );

  const valueProps = (
    facts.length > 0
      ? facts.slice(0, 3)
      : ["[A benefit you can prove]", "[How it's made or sourced]", "[How it arrives]"]
  ).map((fact) => ({
    title: clip(fact, 80),
    body:
      facts.length > 0
        ? sentence(`${fact} — and we can tell you exactly what that means`)
        : "Replace with something true and specific.",
  }));
  while (valueProps.length < 2)
    valueProps.push({
      title: "[Another proven benefit]",
      body: "Replace with something true and specific.",
    });

  return {
    announcementBar: digital
      ? "Instant download — straight to your inbox."
      : "[Your real shipping message]",
    heroHeadline: clip(
      `${productsText[0]!.toUpperCase()}${productsText.slice(1)}, made for ${audience}`,
      120,
    ),
    heroSubheadline: clip(
      sentence(
        profile.brand?.positioning ??
          `${name} is for ${audience}. [Add the difference you lead with]`,
      ),
      300,
    ),
    primaryCta: "Shop now",
    secondaryCta: "Our story",
    valueProps,
    featuredCollectionIntro: clip(
      products.length > 0
        ? `Start with ${products
            .map((p) => p.name)
            .slice(0, 3)
            .join(", ")} — the pieces we're launching with.`
        : "The pieces we're launching with. [Name your first products here.]",
      400,
    ),
    aboutBlurb: clip(
      `${name} started because ${audience} deserved ${productsText} that actually fit their lives. [Add your own story: why you started, who makes it, what you care about.]`,
      1200,
    ),
    emailSignupHeadline: `Hear about ${name} first`,
    emailSignupBody:
      "New releases and the occasional behind-the-scenes note. No spam, unsubscribe any time.",
    faq: digital
      ? [
          {
            question: "How do I get my files?",
            answer:
              "[Explain how downloads are delivered — e.g. a link on the order page and by email.]",
          },
          {
            question: "Can I get a refund?",
            answer: "[State your refund policy for digital products.]",
          },
          { question: "Can I share or resell it?", answer: "[State your licence terms.]" },
        ]
      : [
          {
            question: "How long does delivery take?",
            answer: "[Add your real processing and delivery times.]",
          },
          { question: "What's your returns policy?", answer: "[State your returns policy.]" },
          {
            question: "How do I look after it?",
            answer: "[Add care instructions, or say they're on each product page.]",
          },
        ],
    footerTagline: clip(`${name} — ${productsText} for ${audience}.`, 160),
    needsYourInput: needs,
  };
}
