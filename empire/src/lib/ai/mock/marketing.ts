import type { BusinessProfile } from "@/lib/domain/profile";
import type { Product } from "@/lib/domain/product";
import type { ModuleOutput } from "@/lib/domain/modules";
import { fillHook, hooksFor, type HookGoal } from "@/content/hooks";
import { audienceShort, brandName, clip, isDigital, lower, productsShort, sentence } from "./util";

// The offline marketing writer, following Her Little Empire's methods
// (src/content/methodology.ts): Little Offer Kit's launch email, Sell It
// Simply's story / teach / invite sequence, and the Faceless Content System
// with the 30-Day Plan's launch week and real hooks from 100 Faceless Hooks.

function heroOf(products: Product[]) {
  return products[0]?.name ?? "[your first product]";
}

/** Capital Case hashtags, as the 30-Day Plan's accessibility rules ask. */
function capitalTag(value: string) {
  const words = value
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
  return `#${words.join("")}`.slice(0, 40);
}

function problemOf(products: Product[], fallback: string) {
  const p = products[0]?.customerProblem;
  return p ? lower(p.replace(/\.$/, "")) : fallback;
}

export function mockEmailSequence(
  profile: BusinessProfile,
  products: Product[],
): ModuleOutput<"email_sequence"> {
  const name = brandName(profile);
  const audience = audienceShort(profile);
  const what = productsShort(profile);
  const hero = heroOf(products);
  const first = products[0];
  const problem = problemOf(products, "");
  const delivery = isDigital(profile)
    ? "It's an instant download."
    : "[Add your delivery details.]";
  const footer =
    "\n\n—\n[Your name], " +
    name +
    "\n[Contact address where the law requires it — it does in the US]\nUnsubscribe: [link]";
  const inside = first?.benefits
    ? first.benefits
        .split(/,|\n/)
        .map((b) => b.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((b) => `- ${b}`)
        .join("\n")
    : "- [What's inside, part 1]\n- [Part 2]\n- [Part 3]";

  return {
    // Little Offer Kit › Scripts › "Email to friends or your list".
    launchAnnouncement: {
      headline: clip(`I made something for ${audience}`, 160),
      body: clip(
        `Hi [name],\n\nI've finally finished something I've been meaning to make: ${hero}.\n\nIt's for ${audience}${problem ? ` — for when ${problem}` : ""}. Inside:\n${inside}\n\nIt's [price] here: [link]\n\nIf it's not for you but you know someone it would help, I'd be so grateful if you passed it on. And if you have any thoughts on it, just hit reply — honest feedback helps a lot.\n\nThank you,\n[Your name]`,
        1500,
      ),
    },
    // Sell It Simply › "deliver, story, teach, invite" (delivery is the receipt).
    emails: [
      {
        sendTiming: "Day 2 or 3",
        subject: "Why I made this",
        previewText: clip(problem ? `For when ${problem}.` : `The thinking behind ${name}.`, 160),
        body: clip(
          `Hi [first name],\n\n[Two or three honest sentences about the moment you had this problem yourself.]\n\n[One sentence on what you tried that didn't work.]\n\n[One sentence on what finally helped — the idea behind ${hero}.]\n\nHas this happened to you? Hit reply and tell me — I read every reply.${footer}`,
          3000,
        ),
        cta: "Reply and tell me",
      },
      {
        sendTiming: "Day 4 or 5",
        subject: clip(
          problem ? `One thing that helps when ${problem}` : `One useful thing about ${what}`,
          120,
        ),
        previewText: "A tip that works on its own.",
        body: clip(
          `Hi [first name],\n\nHere's one thing that helps${problem ? ` when ${problem}` : ""}:\n\n1. [Step one]\n2. [Step two]\n3. [Step three]\n\nTry it this week. If it helps, you'll like ${hero}, which ${first?.benefits ? `is ${lower(first.benefits.split(/,|\n/)[0]!.trim())}` : "[does the bigger job]"} — but the tip works on its own.${footer}`,
          3000,
        ),
        cta: "Try the tip",
      },
      {
        sendTiming: "Day 6 or 7",
        subject: clip(`${hero}, if you'd like it`, 120),
        previewText: "No pressure — here's what it is and who it's for.",
        body: clip(
          `Hi [first name],\n\n${hero} is the next step. It's for ${audience}${problem ? ` and helps when ${problem}` : ""}.\n\nInside:\n${inside}\n\nIt's [price] and you can get it here: [link]. ${delivery}\n\nIt's not for you if [honest limit].\n\nAnd if now isn't the time, that's completely fine.${footer}`,
          3000,
        ),
        cta: `Get ${clip(hero, 40)}`,
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
  const problem = problemOf(products, `finding ${what} that fits`);
  const fill = {
    topic: what,
    product: hero,
    audience,
    who: audience,
    "business name": name,
    "offer name": hero,
  };
  // Real hooks from 100 Faceless Hooks, one per goal, picked deterministically.
  const seed = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  const hook = (goal: HookGoal, offset = 0) => {
    const list = hooksFor(goal);
    return clip(fillHook(list[(seed + offset) % list.length]!.text, fill), 200);
  };
  const tags = [
    capitalTag(name),
    capitalTag(profile.category),
    "#SmallBusiness",
    "#ShopSmall",
  ].filter((t, i, a) => t.length > 2 && a.indexOf(t) === i);

  // Faceless Content System › Module 2 caption template:
  // hook / one or two sentences of real detail / the lesson / one next step.
  const caption = (h: string, detail: string, lesson: string, next: string) =>
    clip(`${h}\n\n${detail}\n\n${lesson}\n\n${next}`, 1200);

  const reel = (title: string, h: string, beats: string[], onScreenText: string, cap: string) => ({
    title,
    hook: h,
    beats,
    onScreenText: clip(onScreenText, 300),
    caption: clip(cap, 800),
  });

  const stop = hook("Stop the scroll");
  const save = hook("Make them save");
  const trust = hook("Build trust while faceless");
  const sell = hook("Soft sell / lead to the offer");
  const share = hook("Make them share");

  return {
    reels: [
      reel(
        "Launch day (Sell)",
        stop,
        [
          "Text on screen: what it is",
          "Hands with the product",
          "Who it's for",
          "Price and 'link in bio'",
        ],
        `${hero} — for ${audience}`,
        caption(
          stop,
          `${name} is open. ${sentence(`${what} for ${audience}`)}`,
          "Made for the moment it's needed.",
          "Tap the link in bio to see it.",
        ),
      ),
      reel(
        "The moment it helps (Teach)",
        save,
        [
          "Text: the moment it hurts, in her words",
          "Show the product solving it",
          "One practical tip",
          "End card with the CTA",
        ],
        `For when ${problem}`,
        caption(
          save,
          `[One or two sentences of real, specific detail about ${problem}.]`,
          "[The lesson, in one line.]",
          "Save this for later.",
        ),
      ),
      reel(
        "A peek inside (Show)",
        hook("Make them save", 1),
        [
          "Slow pan across the product",
          "Close-up of a real detail",
          "Size or scale",
          "Everything she gets",
        ],
        "What's inside",
        caption(
          "What's inside, up close.",
          products[0]?.materials
            ? sentence(products[0].materials)
            : "[A real detail about what's inside.]",
          "What you see is what you get.",
          "Comment a question and I'll answer it.",
        ),
      ),
      reel(
        "How it's made (Trust)",
        trust,
        ["Materials or tools", "Hands at work", "The finished piece", "Packing or delivering"],
        `How ${name} comes together`,
        caption(
          trust,
          "[One honest detail about your process.]",
          "Real work, shown — no face needed.",
          "Send this to someone who'd like it.",
        ),
      ),
      reel(
        "For / not for (Sell)",
        sell,
        ["Text: who it's for", "Text: who it's not for", "The product", "Price and link"],
        "For you if… / Not for you if…",
        caption(
          sell,
          `It's for ${audience}. It's not for you if [honest mismatch].`,
          "Honest beats pushy.",
          "Link in bio if it's you.",
        ),
      ),
    ],
    captions: [
      {
        caption: caption(
          stop,
          `${name} is open — ${what} for ${audience}.`,
          "[Why it exists, in one line.]",
          "Have a look: link in bio.",
        ),
        hashtags: tags,
      },
      {
        caption: caption(
          "Why I started this.",
          "[Two honest sentences about why you started.]",
          "[What you care about, in one line.]",
          "Reply and tell me if this is you too.",
        ),
        hashtags: tags,
      },
      {
        caption: caption(
          save,
          products[0]?.benefits ? sentence(products[0].benefits) : "[What it does, simply.]",
          "[The lesson, in one line.]",
          "Save this for later.",
        ),
        hashtags: tags,
      },
      {
        caption: caption(
          "Your questions, answered.",
          isDigital(profile)
            ? "Delivery: instant download."
            : "Delivery: [your real delivery times].",
          "Refund policy: [your real policy].",
          "Ask anything below.",
        ),
        hashtags: tags,
      },
      {
        caption: caption(
          share,
          "Thank you for a kind first week. [Share something real — a first order, a kind message, with permission.]",
          "Small shops grow by word of mouth.",
          "Send this to someone who'd like it.",
        ),
        hashtags: tags,
      },
    ],
    carousels: [
      {
        title: `What's inside ${hero}`,
        slides: [
          `What's inside ${hero}`,
          "[Part 1 and what it helps her do]",
          "[Part 2]",
          "[Part 3]",
          "Format and size",
          "Price and link",
        ],
      },
      {
        title: `Is ${hero} for you?`,
        slides: [
          `If ${problem}…`,
          "…you're not alone",
          "This is for you if…",
          "This is NOT for you if…",
          "Link in bio",
        ],
      },
      {
        title: "Your questions, answered",
        slides: [
          "Questions people ask",
          isDigital(profile) ? "How do downloads work?" : "How long does delivery take?",
          "What's your refund policy?",
          "[A real question you've had]",
          "Still wondering? Send a message",
        ],
      },
    ],
    ctas: [
      "Tap the link in bio",
      "Save this for later",
      "Send this to someone who'd like it",
      "Reply and tell me",
    ],
    // 30-Day Faceless Content Plan, days 23–29: launch day to the recap.
    calendar: [
      {
        day: 1,
        channel: "Reel (text) · Sell + launch email",
        content: "Launch day: what it is, who it's for, price, link in bio.",
        goal: "Say clearly what you offer and where to find it.",
      },
      {
        day: 2,
        channel: "Carousel · Sell",
        content: `What's inside ${hero}; price and link on the last slide.`,
        goal: "Show exactly what she gets.",
      },
      {
        day: 3,
        channel: "Stories · Sell",
        content: "Offer Q&A with a question sticker; answer refunds with your real policy.",
        goal: "Remove buying doubts.",
      },
      {
        day: 4,
        channel: "Reel (b-roll) · Show + story email",
        content: "A peek inside: hands, close-ups, real details.",
        goal: "Let people see the product.",
      },
      {
        day: 5,
        channel: "Carousel · Trust",
        content: "Your own real work, with permission — or a useful free tip if you have none yet.",
        goal: "Build trust without your face.",
      },
      {
        day: 6,
        channel: "Reel (text) · Sell + teach email",
        content: "For you if / not for you if.",
        goal: "Help the right people say yes.",
      },
      {
        day: 7,
        channel: "Stories · Sell + invite email",
        content: "One gentle reminder. Countdown sticker only for a real deadline.",
        goal: "Remind once, kindly.",
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
      { question: "What's your refund policy?", answer: "[State your real policy.]" },
    ],
  };
}
