import type { BusinessProfile } from "@/lib/domain/profile";

// The launch checklist, adapted to the business.
//
// Deterministic on purpose: it's the same good advice every time, costs
// nothing to produce and can't hallucinate. It adapts to what she sells
// (physical, digital or both) and how far along she is. Interim content —
// the Business Starter System's own checklist will replace or extend it
// once supplied (content/register.json, "business-starter-system").
//
// Ticking every box doesn't make a store compliant; the workspace says so.
// Every task starts "not started", whatever her stage: we never assume
// something has been done.

export interface ChecklistTask {
  key: string;
  category: string;
  label: string;
  what: string;
  why: string;
  output: string;
  tool: string;
  /** Where it applies. Omitted means everywhere. */
  fulfilment?: ("physical" | "digital" | "both")[];
}

export const CATEGORIES = [
  "Product readiness",
  "Photography and visual assets",
  "Pricing",
  "Policies",
  "Payments",
  "Shipping or digital delivery",
  "Website",
  "Product descriptions",
  "Email marketing",
  "Social content",
  "Test purchase",
  "Launch readiness",
  "Early performance review",
] as const;

const PHYSICAL: ChecklistTask["fulfilment"] = ["physical", "both"];
const DIGITAL: ChecklistTask["fulfilment"] = ["digital", "both"];

export const TASKS: ChecklistTask[] = [
  {
    key: "product-final",
    category: "Product readiness",
    label: "Confirm your launch products",
    what: "Decide exactly which products (and variants) are in the launch.",
    why: "A small, finished range beats a big, half-ready one.",
    output: "A list of launch products with variants.",
    tool: "Empire Studio → Products",
  },
  {
    key: "product-facts",
    category: "Product readiness",
    label: "Write down every product fact",
    what: "Materials or contents, sizes, colours, care and anything you can prove (e.g. certifications).",
    why: "Your copy can only be as accurate as your facts.",
    output: "Complete product details in Empire Studio.",
    tool: "Empire Studio → Products",
  },
  {
    key: "stock-check",
    category: "Product readiness",
    label: "Check stock and lead times",
    what: "Count what you can ship at launch and how long making or restocking takes.",
    why: "Overselling at launch is the fastest way to lose new customers.",
    output: "Stock numbers entered in Shopify inventory.",
    tool: "Shopify → Products → Inventory",
    fulfilment: PHYSICAL,
  },
  {
    key: "files-final",
    category: "Product readiness",
    label: "Finalise your download files",
    what: "Export final files, check they open on phone and computer, and name them clearly.",
    why: "A broken file is a refund request.",
    output: "Final files ready to attach.",
    tool: "Shopify Digital Downloads app",
    fulfilment: DIGITAL,
  },

  {
    key: "photo-shoot",
    category: "Photography and visual assets",
    label: "Shoot your product photos",
    what: "Follow your photo briefs for hero, detail and lifestyle shots.",
    why: "Photos do most of the selling online.",
    output: "3–5 photos per product, same angle and light.",
    tool: "Empire Studio → Photos",
  },
  {
    key: "photo-check",
    category: "Photography and visual assets",
    label: "Check images match the real product",
    what: "Compare every edited or mockup image with the real thing: colour, size, labels.",
    why: "Misleading images cause returns and complaints.",
    output: "Approved images only.",
    tool: "Your eyes, and the real product",
  },
  {
    key: "logo-favicon",
    category: "Photography and visual assets",
    label: "Add your logo and favicon",
    what: "Upload your logo in the theme header and a square favicon.",
    why: "Small things that make a new store look trustworthy.",
    output: "Logo and favicon live on the duplicate theme.",
    tool: "Shopify theme editor",
  },

  {
    key: "price-costs",
    category: "Pricing",
    label: "Work out your true cost per sale",
    what: "Materials or production, packaging, platform and payment fees, and your time.",
    why: "Underpricing is the most common launch mistake.",
    output: "A cost per product you trust.",
    tool: "Spreadsheet (Money Calculator coming soon)",
  },
  {
    key: "price-set",
    category: "Pricing",
    label: "Set prices and compare-at prices honestly",
    what: "Set prices with a margin; only use compare-at prices if they're genuine previous prices.",
    why: "Fake 'was' prices can break consumer law.",
    output: "Prices entered in Shopify.",
    tool: "Shopify → Products",
  },

  {
    key: "policy-refund",
    category: "Policies",
    label: "Write your refund policy",
    what: "Say what can be returned, the time limit and who pays postage — within your local consumer law.",
    why: "Required for payments, and buyers check it.",
    output: "Refund policy page.",
    tool: "Shopify → Settings → Policies",
  },
  {
    key: "policy-privacy",
    category: "Policies",
    label: "Add a privacy policy",
    what: "Use Shopify's generator as a start and check it covers the apps you use.",
    why: "Legally required in most places once you collect emails.",
    output: "Privacy policy page.",
    tool: "Shopify → Settings → Policies",
  },
  {
    key: "policy-terms",
    category: "Policies",
    label: "Add terms of service",
    what: "Start from Shopify's template and adjust to your business.",
    why: "Sets expectations and protects you.",
    output: "Terms of service page.",
    tool: "Shopify → Settings → Policies",
  },
  {
    key: "policy-shipping",
    category: "Policies",
    label: "Write your shipping policy",
    what: "Processing time, carriers, costs and where you ship.",
    why: "The most-read policy on most stores.",
    output: "Shipping policy page.",
    tool: "Shopify → Settings → Policies",
    fulfilment: PHYSICAL,
  },
  {
    key: "policy-licence",
    category: "Policies",
    label: "State your licence terms",
    what: "Say whether buyers can share, print commercially or resell.",
    why: "Stops misunderstandings before they start.",
    output: "A licence section on product pages and in the FAQ.",
    tool: "Shopify → Pages",
    fulfilment: DIGITAL,
  },
  {
    key: "policy-review",
    category: "Policies",
    label: "Get policies checked for your country",
    what: "Ask a qualified adviser or your local consumer body's guidance to check them.",
    why: "Templates aren't legal advice, and the rules differ by country.",
    output: "Policies you're confident in.",
    tool: "A local adviser",
  },

  {
    key: "pay-activate",
    category: "Payments",
    label: "Activate payments",
    what: "Set up Shopify Payments (or another provider) and verify your bank details.",
    why: "No payments, no launch.",
    output: "Payments active, payout account verified.",
    tool: "Shopify → Settings → Payments",
  },
  {
    key: "pay-tax",
    category: "Payments",
    label: "Set up taxes",
    what: `Turn on the taxes you're registered for and check how prices display.`,
    why: "Getting tax wrong is expensive to fix later.",
    output: "Tax settings matching your registration.",
    tool: "Shopify → Settings → Taxes and duties",
  },

  {
    key: "ship-rates",
    category: "Shipping or digital delivery",
    label: "Set shipping rates and zones",
    what: "Add the places you ship to and rates that cover your real costs.",
    why: "Surprise shipping costs are the top reason carts are abandoned.",
    output: "Shipping zones and rates in Shopify.",
    tool: "Shopify → Settings → Shipping and delivery",
    fulfilment: PHYSICAL,
  },
  {
    key: "ship-packaging",
    category: "Shipping or digital delivery",
    label: "Prepare packaging and a packing routine",
    what: "Choose packaging, weigh packed products, and plan how you'll pack orders.",
    why: "Accurate weights give accurate shipping rates.",
    output: "Packed weights entered on each product.",
    tool: "Kitchen scales and Shopify product weights",
    fulfilment: PHYSICAL,
  },
  {
    key: "digital-delivery",
    category: "Shipping or digital delivery",
    label: "Set up digital delivery",
    what: "Install a digital downloads app and attach files to each product.",
    why: "Customers expect files instantly.",
    output: "Files attached; delivery email checked.",
    tool: "Shopify Digital Downloads app",
    fulfilment: DIGITAL,
  },

  {
    key: "site-duplicate",
    category: "Website",
    label: "Duplicate your theme before editing",
    what: "Online Store → Themes → ⋯ → Duplicate. Edit the copy.",
    why: "You can always go back.",
    output: "A working copy of your theme.",
    tool: "Shopify → Online Store → Themes",
  },
  {
    key: "site-design",
    category: "Website",
    label: "Apply your Sidekick prompts",
    what: "Work through the prompt pack one prompt at a time on the duplicate theme.",
    why: "Brand-consistent store without hiring a designer.",
    output: "Homepage and product template styled.",
    tool: "Empire Studio → Store design",
  },
  {
    key: "site-homepage",
    category: "Website",
    label: "Paste in your homepage copy",
    what: "Hero, value props, about, FAQ and signup.",
    why: "Tells visitors what you sell in seconds.",
    output: "Homepage copy live on the duplicate theme.",
    tool: "Empire Studio → Store design",
  },
  {
    key: "site-mobile",
    category: "Website",
    label: "Check everything on a phone",
    what: "Every page, every button, at phone width.",
    why: "Most of your visitors will be on a phone.",
    output: "A list of fixes, fixed.",
    tool: "Your phone",
  },
  {
    key: "site-domain",
    category: "Website",
    label: "Connect your domain",
    what: "Buy or connect your domain and set it as primary.",
    why: "A real domain looks established and is easier to share.",
    output: "Store live on your domain.",
    tool: "Shopify → Settings → Domains",
  },

  {
    key: "desc-write",
    category: "Product descriptions",
    label: "Generate and edit each listing",
    what: "Use Product Writer, then edit until it sounds like you.",
    why: "Clear, accurate listings sell and reduce questions.",
    output: "A finished listing per product.",
    tool: "Empire Studio → Products",
  },
  {
    key: "desc-gaps",
    category: "Product descriptions",
    label: "Fill every flagged gap",
    what: "Go through 'Missing information' on each listing and fill it in.",
    why: "Missing facts become customer emails and returns.",
    output: "No flagged gaps left.",
    tool: "Empire Studio → Products",
  },
  {
    key: "desc-seo",
    category: "Product descriptions",
    label: "Add SEO titles and descriptions",
    what: "Paste them into each product's search engine listing.",
    why: "Helps people find you in search.",
    output: "SEO fields filled.",
    tool: "Shopify → Products → Search engine listing",
  },

  {
    key: "email-tool",
    category: "Email marketing",
    label: "Choose your email tool",
    what: "Shopify Email is simplest to start; connect your signup form.",
    why: "Your email list is the audience you own.",
    output: "Signup form collecting subscribers.",
    tool: "Shopify Email",
  },
  {
    key: "email-load",
    category: "Email marketing",
    label: "Load your launch emails",
    what: "Paste in your three launch emails and schedule them.",
    why: "A planned sequence beats a single announcement.",
    output: "Three scheduled emails.",
    tool: "Empire Studio → Marketing",
  },

  {
    key: "social-profile",
    category: "Social content",
    label: "Tidy your social profiles",
    what: "Name, bio, link to your store, profile image.",
    why: "Launch posts send people to your profile first.",
    output: "Profiles that match your brand.",
    tool: "Instagram / TikTok",
  },
  {
    key: "social-batch",
    category: "Social content",
    label: "Batch your launch week content",
    what: "Make the Reels and posts from your social kit before launch day.",
    why: "Launch week is busy — prepare in advance.",
    output: "7 days of content, ready to post.",
    tool: "Empire Studio → Marketing, Canva",
  },

  {
    key: "test-order",
    category: "Test purchase",
    label: "Place a real test order",
    what: "Buy one of your own products with a real card, then refund it.",
    why: "The only way to know checkout, emails and delivery all work.",
    output: "A successful test order and refund.",
    tool: "Shopify checkout",
  },
  {
    key: "test-emails",
    category: "Test purchase",
    label: "Check your customer emails",
    what: "Read the order confirmation and shipping or download emails you received.",
    why: "They're part of your brand too.",
    output: "Notifications edited to match your voice.",
    tool: "Shopify → Settings → Notifications",
  },

  {
    key: "launch-publish",
    category: "Launch readiness",
    label: "Review, then publish your theme",
    what: "One last review of the duplicate theme on phone and desktop, then publish it.",
    why: "Nothing goes live without your eyes on it.",
    output: "Your store, live.",
    tool: "Shopify → Online Store → Themes",
  },
  {
    key: "launch-password",
    category: "Launch readiness",
    label: "Remove the store password",
    what: "Online Store → Preferences → turn off password protection.",
    why: "Otherwise nobody can buy!",
    output: "Store open to the public.",
    tool: "Shopify → Online Store → Preferences",
  },
  {
    key: "launch-announce",
    category: "Launch readiness",
    label: "Announce your launch",
    what: "Send email 1 and post day 1 of your calendar.",
    why: "Tell people — they can't buy what they don't know about.",
    output: "Launch announced.",
    tool: "Empire Studio → Marketing",
  },

  {
    key: "review-week1",
    category: "Early performance review",
    label: "Review your first week",
    what: "Look at visitors, add-to-carts and orders. Note the questions people asked.",
    why: "Real data beats guesses about what to fix next.",
    output: "Three things to improve.",
    tool: "Shopify → Analytics",
  },
  {
    key: "review-ask",
    category: "Early performance review",
    label: "Ask first customers for honest reviews",
    what: "Email customers after delivery to ask for a review.",
    why: "Real reviews are the only ones worth having.",
    output: "A review request email.",
    tool: "Shopify Email or a reviews app",
  },
];

export function tasksFor(profile: Pick<BusinessProfile, "fulfilment">): ChecklistTask[] {
  return TASKS.filter((task) => !task.fulfilment || task.fulfilment.includes(profile.fulfilment));
}

export function taskByKey(key: string): ChecklistTask | undefined {
  return TASKS.find((task) => task.key === key);
}
