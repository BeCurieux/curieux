import type { ModuleKey } from "@/lib/domain/modules";

// Where each generator's method comes from.
//
// Every method below is reconstructed from Her Little Empire's own product
// documents (audited 22 October 2026; content/REGISTER.md), in their words,
// with the source named against each step. Nothing is added from outside
// them except where a module has no source at all, and those are marked.
//
// status:
//   source  — the method comes from the documents.
//   partial — built from the documents, with gaps the founder must fill
//             (listed in `gaps`); the studio says so.
//   studio  — Empire Studio's own method (founder's decision): written for
//             this tool under Her Little Empire's rules, borrowing named
//             steps from the documents, but not claimed to come from any
//             one product.
//   interim — no Her Little Empire method exists for this yet; a general
//             method runs under the brand's rules, and the studio says so.
//
// Every generation records the method's status and version in its input
// snapshot, so outputs made before a method changes can be found later.

export interface Methodology {
  status: "interim" | "partial" | "studio" | "source";
  version: string;
  /** Asset ids in content/register.json this method comes from. */
  sources: string[];
  /** What the documents don't cover yet (founder to supply). */
  gaps: string[];
  instructions: string;
}

/** Rules repeated across three or more products; every generator inherits them. */
export const HOUSE_RULES = `Her Little Empire house rules (Little Offer Kit, Sell It Simply, Brand-in-a-Box, First 5 Customers, Faceless Not Anonymous):
- No income claims, no "passive income", no fake scarcity or countdowns, no fake "was" prices, no fake reviews.
- Testimonials only when real, with permission, in the person's exact words.
- A founding or launch price must be real: say who gets it and when it ends.
- Label figures FACT, EST or UNKNOWN; don't state a figure you can't back up ("If you can't link to it, leave it out").
- Any AI-generated person or voice must be labelled; never present one as the founder or a real customer.
- Write the way you'd text a friend: plain, specific, warm, no hype. Say the result, not the feature.`;

export const METHODOLOGY: Record<ModuleKey, Methodology> = {
  brand_blueprint: {
    status: "studio",
    version: "studio-1",
    sources: ["sell-it-simply-workbook", "little-offer-kit", "ai-business-assistant-pack"],
    gaps: [
      "How to choose the brand's accent colour.",
      "A voice and tone rubric beyond 'describe your voice in three words'.",
      "Photo direction beyond natural light, a clean background and showing hands, desk or process.",
      "Which promise formula to use (five versions exist across the products).",
    ],
    instructions: `Empire Studio's own brand method. Build the blueprint in this order.
1. Her words first (Sell It Simply › Position: "Find her words"): use the customer's own phrases where she gave any; sort them into "the moment it hurts", "the worry underneath" and "what she wishes would happen". The most repeated phrases become headline and subject-line material.
2. Ideal customer (AI Business Assistant Pack 1.1): one paragraph — her situation, what she's struggling with, what she's already tried, and what would make her say yes.
3. Positioning (Sell It Simply › "My positioning card"): who it's for in one line, the moment it helps, why it's better for her than the generic version, the catch to handle, who it is NOT for. Then the promise: "I help [who, specifically] get [result] without [the thing they dread]."
4. Personality and tone (Sell It Simply › "Faceless, but still a person"): the voice in three words (for example "calm, practical, kind") and one honest line about why the business exists. Default tone if she gives none: "warm, plain, friendly, no hype" (AI Business Assistant Pack › About me).
5. Palette (Little Offer Kit › "Simple design rules"): three colours — one accent that carries the brand and is used everywhere, plus a light neutral (cream) and a near-black. Prefer colours she named. Dark text on light backgrounds.
6. Typography (Little Offer Kit): two fonts at most — an elegant serif for headings and a clean sans for body text.
7. Photography (Sell It Simply › Images; Get Found): the real product, hands, desk or process; natural light; a clean background. No stock photos of people. Never the founder's face unless she wants it; never children's faces or anything that locates a home.
8. Consistency (Little Offer Kit; Sell It Simply): use the colours the same way everywhere; colours, fonts and tone match across shop, posts and emails.
9. Honesty (house rules): real quotes only, with permission; real founding offers only; a "usually" price only if it's the real price.`,
  },
  theme_brief: {
    status: "partial",
    version: "hle-1",
    sources: ["sell-it-simply-workbook", "little-offer-kit", "faceless-not-anonymous-workbook"],
    gaps: ["No Her Little Empire document covers Shopify store setup yet."],
    instructions: `Plan a beginner-friendly Shopify homepage a free theme can build with standard sections, checked against Her Little Empire's page rules.
- Every page must answer (Sell It Simply › "Five-question page check"): What is it, and who is it for? What will she have? What exactly does she get? Is it right for her, or not ("not for you if")? What happens after she pays?
- Read it "as if you were a tired parent scrolling at 9pm: does it say what it is in 5 seconds?" (Little Offer Kit › sales page).
- Design rules (Little Offer Kit › "Simple design rules"): two fonts at most; three colours (one main, one accent, one neutral) used the same way on every page; lots of white space; one idea per section; short headings that say what the section does; dark text on light backgrounds.
- Trust (Faceless Not Anonymous › Trust stack): same business name everywhere and a business number where it applies; a real contact email and reply time; clear refund, privacy and terms pages; real previews of what she gets; who it is and isn't for.
- "Fix the page before you chase traffic" (Sell It Simply): read it on a phone as a stranger would; remove anything that isn't the promise, the problem, what's inside, who it's for, questions, or the buy button; test-purchase before launch.`,
  },
  theme_prompts: {
    status: "interim",
    version: "interim-2",
    sources: ["sell-it-simply-workbook", "little-offer-kit"],
    gaps: [
      "No Her Little Empire method for Shopify Sidekick exists yet. Prompts follow the brand's page and design rules (above) until one is written.",
    ],
    instructions: `Write prompts for Shopify Sidekick in the theme editor. Each prompt asks for one change, names the section type, gives the exact copy and colours to use, and stops short of publishing. Apply Her Little Empire's page rules: say what it is and who it's for in the first screen; two fonts and three colours used consistently; one idea per section; dark text on light backgrounds; no fake reviews, badges, countdowns or stock counters. Tell her what to check afterwards and how likely it is she'll need to adjust by hand.`,
  },
  homepage_copy: {
    status: "source",
    version: "hle-1",
    sources: ["sell-it-simply-workbook", "little-offer-kit"],
    gaps: [],
    instructions: `Follow Sell It Simply's "sales page, in six parts", with Little Offer Kit's additions.
1. Promise (hero): "[Result] for [who] — [in how long / without what]." Sub-line: one sentence on the moment it helps, in her words. The headline says the result, not just the business name.
2. Problem: "If [specific moment in her words], you're not alone." One or two sentences on the worry underneath.
3. What's inside (value props): what she gets, said as results, not features.
4. Who it's for: "This is for you if…" and "This is NOT for you if…".
5. Why we made it (about): two or three honest sentences on the problem she kept seeing and how this helps. No income claims (Little Offer Kit).
6. Questions (FAQ): how she gets it, what she needs, and the refund note — her real policy only; leave a [placeholder] if unknown.
7. Buy: one clear button; say what happens after she pays.
Email signup: invite people to hear about new things; no fake discount. Every line must survive the 5-second test: what it is and who it's for.`,
  },
  product_listing: {
    status: "source",
    version: "hle-1",
    sources: [
      "little-offer-kit",
      "sell-it-simply-workbook",
      "get-found",
      "ai-business-assistant-pack",
    ],
    gaps: [
      "Get Found has no Shopify page and no guidance on collection descriptions or meta description length.",
    ],
    instructions: `Follow Little Offer Kit's product description template and Get Found's search rules.
- Title (Get Found; Little Offer Kit): plain words that say what it is, then who it's for — "what it is plus who it's for". Write for a buyer, not a computer. No keyword stuffing, no inaccurate words.
- Promise (Little Offer Kit): "[Product] helps [who] [get what result] in [how long]." Use only results the facts support.
- Description structure (Little Offer Kit › Product description): the promise; "This is for you if:" (three situations); "What's inside:" (each part and what it helps her do); format and what she'll need; "What it's not"; how to ask a question.
- Benefits (AI Business Assistant Pack 2.4): for each feature, the practical benefit to her customer in one short sentence. Avoid exaggerated claims. "Do not invent features" (5.1).
- FAQ (AI Business Assistant Pack 2.5): price, timing, delivery, what happens if something goes wrong; mark any answer that depends on her policies with [CHECK] rather than inventing it.
- SEO (Get Found › Google): a clear, unique title that accurately says what's on the page; a short meta description in the customer's own words; list the different words people use for the same thing.
- Price by the size of the result, not the number of pages (Little Offer Kit). Never show a "was" price unless it was a real price.
- Flag every missing fact instead of filling it in.`,
  },
  image_briefs: {
    status: "source",
    version: "hle-1",
    sources: [
      "sell-it-simply-workbook",
      "little-offer-kit",
      "get-found",
      "faceless-content-system-workbook",
    ],
    gaps: [
      "Shot lists in the documents are written for digital products; physical-product guidance is limited to natural light and a clean background.",
    ],
    instructions: `Use Sell It Simply's six-image shot list and honesty test.
- Shot list: cover or hero shot; the real thing up close (real inside pages for digital products); in use; a filled-in or finished example; everything she gets; size and format.
- Honesty test: the image shows something the buyer actually gets; if props, frames or printing aren't included, the image or caption says so; colours match the real product; no reviews, badges or buyer counts that aren't real; disclose AI where the platform requires it (Etsy does). "Preview images match exactly what the buyer gets" (Little Offer Kit).
- Light and setting: natural light on a clean background (Get Found); "printed page near a window, daylight" (Sell It Simply).
- Faceless filming (Faceless Content System): hands, desk, process; check every frame for private details — names, addresses, children's faces, school logos, other people's screens.
- Never: stock photos of people (the brand is faceless), AI-generated people presented as real, luxury props, anyone presented as the founder who isn't.
- Platform sizes: Instagram Reels 9:16; Pinterest 2:3; keep cover text in the middle so grid crops don't cut it.`,
  },
  email_sequence: {
    status: "source",
    version: "hle-1",
    sources: ["little-offer-kit", "sell-it-simply-workbook", "first-5-customers"],
    gaps: [
      "The mapping of these templates to 'announcement + three emails' is proposed; the founder to confirm.",
    ],
    instructions: `Launch announcement (Little Offer Kit › "Email to friends or your list"): what it is, the format, who it helps and the result, three short bullets of what's inside, the price and link, and an honest ask to pass it on or reply with feedback. If there's a launch price, Sell It Simply's honest version: say the regular price and the real date and time it changes.
Then Sell It Simply's sequence — "deliver, story, teach, invite":
1. Story: "Why I made this" — two or three honest sentences about the moment she had this problem, one on what didn't work, one on what finally helped. Invite a reply.
2. Teach: one useful thing for her customer's moment, in three to five short steps; it must work on its own. Mention the product only after the tip.
3. Invite: the product as the next step — format, who it's for, result, what's inside, price and link, an honest "not for you if", and "if now isn't the time, that's completely fine".
Every email (Sell It Simply): her name or business name, a way to reply, a working unsubscribe link, a postal address where the law requires it (it does in the US), and a subject line that honestly matches the email. One call to action each. No countdowns or invented deadlines.`,
  },
  social_content: {
    status: "source",
    version: "hle-1",
    sources: [
      "faceless-content-system-workbook",
      "30-day-faceless-content-plan",
      "100-faceless-hooks",
      "faceless-not-anonymous-workbook",
      "comment-to-dm-kit",
    ],
    gaps: [
      "Reel length isn't stated in any document.",
      "The 30-Day Plan assumes a service or digital product; physical-product launch days are adapted.",
    ],
    instructions: `Faceless, not anonymous: "Faceless means you choose not to show your face. Anonymous means nobody can tell who is responsible. Be the first, never the second." Trust comes from showing real work, a clear method and honest limits.
- Post types (30-Day Plan › weekly rhythm): Teach (a useful tip, steps or checklist), Trust (who you are and how you work, without your face), Show (process, workspace or product), Sell (what you offer, the price and where to find it).
- Formats (Faceless Content System › "Six faceless formats"): text-on-screen reel, hands and b-roll, screen recording, voice-over, carousel, quote; plus Stories (3–5 frames, one interactive sticker).
- From hook to post (100 Faceless Hooks, 7 steps): choose the goal (stop the scroll, save, comment, share, trust, sell or story); pick a hook for that goal; fill every blank with something specific; the post must deliver exactly what the hook says; hook on slide 1 or the first frame; one call to action at the end, just one.
- Caption (Faceless Content System › Module 2): the hook; one or two sentences of real, specific detail; the lesson in one line; one next step.
- Carousels: strong first slide, one idea per slide, a clear last slide with a CTA.
- Seven-day launch (30-Day Plan days 23–29): launch day — what it is, who it's for, price, link; what's inside; offer Q&A with her real refund policy; a peek inside; real work only (or a useful free resource if she has no real work to show yet); for / not for; a gentle recap — "one reminder only", countdown sticker only for a real deadline.
- Hashtags: 3–5 that describe the post, Capital Case (#SmallBusinessTips). Keyword in the first line where it reads naturally.
- Accessibility: captions checked, alt text ("[Type of image] showing [what's in it]. Text reads: …"), big high-contrast text, no fast flashing.
- Never: engagement bait, misleading hooks, money promises, fake stats, fake urgency, invented comments or results, a story that isn't hers, AI people unlabelled.`,
  },
};
