import type { BusinessProfile } from "@/lib/domain/profile";
import type { Product } from "@/lib/domain/product";
import type { ModuleOutput } from "@/lib/domain/modules";
import { audienceShort, brandName, clip, isDigital, lower, productsShort, sentence } from "./util";

function heroOf(products: Product[]) {
  return products[0]?.name ?? "[your first product]";
}

function slugTag(value: string) {
  return `#${value.replace(/[^a-z0-9]+/gi, "").toLowerCase()}`.slice(0, 40);
}

export function mockEmailSequence(
  profile: BusinessProfile,
  products: Product[],
): ModuleOutput<"email_sequence"> {
  const name = brandName(profile);
  const audience = audienceShort(profile);
  const what = productsShort(profile);
  const hero = heroOf(products);
  const problem = products[0]?.customerProblem
    ? lower(products[0].customerProblem.replace(/\.$/, ""))
    : "";
  const delivery = isDigital(profile)
    ? "It's an instant download."
    : "[Add your delivery details.]";

  return {
    launchAnnouncement: {
      headline: clip(`${name} is open`, 160),
      body: clip(
        `${name} is open. We make ${what} for ${audience}.\n\nFirst up: ${hero}.${problem ? ` It's for when ${problem}.` : ""}\n\n[One line on why you started.]\n\nShop now at [your store link].`,
        1500,
      ),
    },
    emails: [
      {
        sendTiming: "Launch day, morning",
        subject: clip(`${name} is open`, 120),
        previewText: clip(`${what[0]!.toUpperCase()}${what.slice(1)}, made for ${audience}.`, 160),
        body: clip(
          `Hello,\n\nToday's the day — ${name} is open.\n\n[Two or three sentences on why you started ${name} and who it's for. Real and specific beats polished.]\n\nWe're launching with ${
            products.length > 1
              ? products
                  .slice(0, 3)
                  .map((p) => p.name)
                  .join(", ")
              : hero
          }.\n\nThank you for being here from the start.\n\n[Your name]`,
          3000,
        ),
        cta: "Visit the shop",
      },
      {
        sendTiming: "Launch day + 2",
        subject: clip(`Why we made ${hero}`, 120),
        previewText: problem ? clip(`For when ${problem}.`, 160) : "The thinking behind it.",
        body: clip(
          `Hello again,\n\n${problem ? sentence(`If ${problem}, this one's for you`) : "[Describe the problem it solves.]"}\n\n${products[0]?.benefits ? sentence(products[0].benefits) : "[What it does, in plain words.]"}\n\n${products[0]?.materials ? sentence(`${isDigital(profile) ? "What's included" : "Made from"}: ${products[0].materials}`) : ""}\n\n${delivery}\n\n[Your name]`,
          3000,
        ),
        cta: `Shop ${clip(hero, 40)}`,
      },
      {
        sendTiming: "Launch day + 6",
        subject: "A few questions, answered",
        previewText: "Delivery, returns and the bits people ask.",
        body: clip(
          `Hello,\n\nA quick round-up of what people have asked since launch:\n\n• Delivery: ${isDigital(profile) ? "instant download after checkout." : "[your real delivery times]"}\n• Returns: [your returns or refund policy]\n• [Another real question you've had]\n\nIf you've got a question, just reply — it comes straight to me.\n\n[Your name]`,
          3000,
        ),
        cta: "Browse the collection",
      },
    ],
  };
}

export function mockSocialContent(
  profile: BusinessProfile,
  products: Product[],
): ModuleOutput<"social_content"> {
  const name = brandName(profile);
  const audience = audienceShort(profile);
  const what = productsShort(profile);
  const hero = heroOf(products);
  const problem = products[0]?.customerProblem
    ? lower(products[0].customerProblem.replace(/\.$/, ""))
    : `finding ${what} that fits your life`;
  const tags = [slugTag(name), slugTag(profile.category), "#smallbusiness", "#shopsmall"].filter(
    (t, i, a) => t.length > 2 && a.indexOf(t) === i,
  );

  const reel = (
    title: string,
    hook: string,
    beats: string[],
    onScreenText: string,
    caption: string,
  ) => ({
    title,
    hook: clip(hook, 200),
    beats,
    onScreenText: clip(onScreenText, 300),
    caption: clip(caption, 800),
  });

  return {
    reels: [
      reel(
        "Behind the launch",
        `I'm launching ${name} and here's why.`,
        [
          "Hands setting up the product on a table",
          "Close-up detail",
          "Packing an order (or the download screen)",
          "Product hero shot",
        ],
        `${name} — open now`,
        `${name} is open. ${sentence(`${what} for ${audience}`)} Link in bio.`,
      ),
      reel(
        "The problem",
        `If ${problem}, watch this.`,
        [
          "Show the problem (text on screen)",
          "Introduce the product",
          "Show it solving the problem",
          "End on the product",
        ],
        `For when ${problem}`,
        `Made for the moment when ${problem}. Meet ${hero}.`,
      ),
      reel(
        "Up close",
        "Let me show you the details.",
        [
          "Slow pan across the product",
          "Texture or feature close-up",
          "Size or scale shot",
          "Final full shot",
        ],
        "The details",
        `A closer look at ${hero}. ${products[0]?.materials ? sentence(products[0].materials) : "[Add a real detail.]"}`,
      ),
      reel(
        "How it's made",
        `How ${name} comes together.`,
        [
          "Materials or tools",
          "A step of the process",
          "The finished product",
          "Packing or delivering",
        ],
        "From idea to your door",
        `Here's a little of how ${name} is made. [Add one honest detail about your process.]`,
      ),
      reel(
        "Three things to know",
        `Three things to know about ${hero}.`,
        [
          "Text: 1 — [first fact]",
          "Text: 2 — [second fact]",
          "Text: 3 — [third fact]",
          "Product shot + CTA",
        ],
        "3 things to know",
        `Three things people ask about ${hero}. Anything else? Ask in the comments.`,
      ),
    ],
    captions: [
      {
        caption: `${name} is open. ${sentence(`We make ${what} for ${audience}`)} Have a look — link in bio.`,
        hashtags: tags,
      },
      {
        caption: `${sentence(`Why ${name} exists`)} [Two honest sentences about why you started.]`,
        hashtags: tags,
      },
      {
        caption: `Meet ${hero}. ${products[0]?.benefits ? sentence(products[0].benefits) : "[What it does, simply.]"}`,
        hashtags: tags,
      },
      {
        caption: `${isDigital(profile) ? "Download it today, use it today." : "[Your real delivery message.]"} Questions? Pop them below.`,
        hashtags: tags,
      },
      {
        caption: `Thank you for the launch-week love. [Share something real — a first order, a kind message.]`,
        hashtags: tags,
      },
    ],
    carousels: [
      {
        title: `Welcome to ${name}`,
        slides: [
          `Hello, we're ${name}`,
          `We make ${what}`,
          `For ${audience}`,
          "Here's what we're launching with",
          "Shop — link in bio",
        ],
      },
      {
        title: `Is ${hero} for you?`,
        slides: [
          `If ${problem}…`,
          "…you're not alone",
          `${hero} was made for this`,
          "Here's how it works",
          "Find it in our shop",
        ],
      },
      {
        title: "Your questions, answered",
        slides: [
          "Questions we get asked",
          isDigital(profile) ? "How do downloads work?" : "How long does delivery take?",
          "What's your returns policy?",
          "[A real question you've had]",
          "Still wondering? DM us",
        ],
      },
    ],
    ctas: [
      "Shop the launch — link in bio",
      "Tap to see the details",
      "Save this for later",
      "Send this to a friend who needs it",
    ],
    calendar: [
      {
        day: 1,
        channel: "Instagram Reel + Email",
        content: "Behind the launch Reel; launch email 1.",
        goal: "Announce the store.",
      },
      {
        day: 2,
        channel: "Instagram post",
        content: `Meet ${hero} caption.`,
        goal: "Introduce the hero product.",
      },
      {
        day: 3,
        channel: "Instagram Reel + Email",
        content: "The problem Reel; email 2.",
        goal: "Connect the product to her problem.",
      },
      {
        day: 4,
        channel: "Instagram carousel",
        content: `Welcome to ${name} carousel.`,
        goal: "Explain the brand to new followers.",
      },
      {
        day: 5,
        channel: "Instagram Reel",
        content: "Up close Reel.",
        goal: "Show quality and detail.",
      },
      {
        day: 6,
        channel: "Stories + carousel",
        content: "Your questions, answered carousel; Q&A sticker in Stories.",
        goal: "Remove buying doubts.",
      },
      {
        day: 7,
        channel: "Instagram post + Email",
        content: "Thank-you caption; email 3.",
        goal: "Thank early customers and remind others.",
      },
    ],
    faq: [
      {
        question: `What does ${name} sell?`,
        answer: sentence(`${what[0]!.toUpperCase()}${what.slice(1)} for ${audience}`),
      },
      {
        question: isDigital(profile) ? "How do I get my files?" : "How long is delivery?",
        answer: isDigital(profile) ? "[Explain delivery.]" : "[Add your delivery times.]",
      },
      { question: "What's your returns policy?", answer: "[State your policy.]" },
    ],
  };
}
