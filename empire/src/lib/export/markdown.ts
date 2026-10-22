import { MODULES, type AnyModuleOutput, type ModuleKey } from "@/lib/domain/modules";

// One way to turn any output into readable text: Markdown that pastes
// cleanly into Shopify, email tools, Notion or a doc. Used by Copy, the
// .md download, the ZIP export and the print view.

const LABELS: Record<string, string> = {
  positioning: "Positioning",
  idealCustomer: "Ideal customer",
  personality: "Brand personality",
  colourPalette: "Colour palette",
  typography: "Typography",
  copyTone: "Copywriting tone",
  photography: "Photography direction",
  consistency: "Visual consistency rules",
  doSay: "Sounds like us",
  avoid: "Avoid",
  inPractice: "In practice",
  hex: "Hex",
  use: "Use for",
  homepageObjective: "Homepage objective",
  customerPositioning: "Customer positioning",
  visualDirection: "Visual direction",
  navigation: "Navigation",
  homepageSections: "Homepage sections",
  productPage: "Product page",
  mobile: "Mobile",
  conversion: "Conversion",
  accessibility: "Accessibility",
  trust: "Trust and transparency",
  beforeYouStart: "Before you start",
  prompts: "Sidekick prompts",
  whereToUse: "Where to use it",
  whatItChanges: "What it changes",
  themeDependency: "Depends on your theme",
  prompt: "Prompt",
  verify: "Check afterwards",
  review: "How to review",
  manualAdjustments: "Manual adjustment",
  manualNote: "Note",
  announcementBar: "Announcement bar",
  heroHeadline: "Hero headline",
  heroSubheadline: "Hero subheadline",
  primaryCta: "Main button",
  secondaryCta: "Second button",
  valueProps: "Value propositions",
  featuredCollectionIntro: "Featured collection intro",
  aboutBlurb: "About",
  emailSignupHeadline: "Email signup headline",
  emailSignupBody: "Email signup text",
  faq: "FAQ",
  footerTagline: "Footer tagline",
  needsYourInput: "Needs your input",
  shortDescription: "Short description",
  description: "Full description",
  bullets: "Features and benefits",
  specifications: "Specifications",
  seoTitle: "SEO title",
  seoDescription: "SEO meta description",
  collectionDescription: "Collection description",
  socialCaption: "Social caption",
  missingInformation: "Missing information",
  accuracyNote: "Accuracy",
  primary: "Primary product photo",
  detail: "Detail shot",
  lifestyle: "Lifestyle image",
  instagram: "Instagram promo image",
  canvaSteps: "Canva steps",
  aiEditPrompts: "AI image-editing prompts",
  setup: "Set-up",
  aspectRatio: "Aspect ratio",
  shotList: "Shot list",
  caution: "Check",
  launchAnnouncement: "Launch announcement",
  emails: "Launch emails",
  sendTiming: "Send",
  previewText: "Preview text",
  cta: "Call to action",
  reels: "Reels",
  hook: "Hook",
  beats: "Beats",
  onScreenText: "On-screen text",
  captions: "Post captions",
  hashtags: "Hashtags",
  carousels: "Carousels",
  slides: "Slides",
  ctas: "Calls to action",
  calendar: "Seven-day calendar",
  question: "Q",
  answer: "A",
};

export function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced[0]!.toUpperCase() + spaced.slice(1);
}

const TITLE_KEYS = ["title", "subject", "section", "trait", "name", "label", "feature", "question", "headline", "day", "purpose"];

function titleOf(item: Record<string, unknown>, index: number): string {
  for (const key of TITLE_KEYS) {
    const value = item[key];
    if (typeof value === "string" || typeof value === "number") {
      return key === "day" ? `Day ${value}` : String(value);
    }
  }
  return `${index + 1}`;
}

function render(value: unknown, depth: number): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return value.map((v) => `- ${String(v)}`).join("\n");
    }
    const hashes = "#".repeat(Math.min(depth + 1, 6));
    return value
      .map((item, i) => {
        const obj = item as Record<string, unknown>;
        const title = titleOf(obj, i);
        const body = Object.entries(obj)
          .filter(([key, v]) => !(TITLE_KEYS.includes(key) && String(v) === title) && key !== "key")
          .map(([key, v]) => field(key, v, depth + 1))
          .join("\n\n");
        return `${hashes} ${title}\n\n${body}`;
      })
      .join("\n\n");
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([key, v]) => field(key, v, depth + 1))
    .join("\n\n");
}

function field(key: string, value: unknown, depth: number): string {
  const label = labelFor(key);
  if (key === "prompt" && typeof value === "string") {
    return `**${label}:**\n\n> ${value.replace(/\n/g, "\n> ")}`;
  }
  if (typeof value === "string" && !value.includes("\n") && value.length < 140) return `**${label}:** ${value}`;
  if (typeof value === "string" || typeof value === "number") return `**${label}:**\n\n${value}`;
  if (Array.isArray(value) && value.length === 0) return "";
  return `**${label}:**\n\n${render(value, depth)}`;
}

/** One top-level section, for the Copy button on a section card. */
export function sectionMarkdown(key: string, value: unknown): string {
  if (typeof value === "string") return value;
  return `## ${labelFor(key)}\n\n${render(value, 2)}`;
}

export function toMarkdown(module: ModuleKey, output: AnyModuleOutput, context?: string): string {
  const head = `# ${MODULES[module].title}${context ? ` — ${context}` : ""}`;
  const body = Object.entries(output as Record<string, unknown>)
    .filter(([, value]) => !(Array.isArray(value) && value.length === 0))
    .map(([key, value]) => `## ${labelFor(key)}\n\n${render(value, 2)}`)
    .join("\n\n");
  return `${head}\n\n${body}\n`;
}
