// The local widget generator.
//
// This is the fallback provider, and it does real work: it reads a sentence
// like
//
//   "Make me a calculator that asks how many bedrooms and bathrooms the
//    customer has and whether they want oven cleaning. Bedrooms cost $35,
//    bathrooms $25 and an oven is $30."
//
// and produces a working, priced, three-question estimator — the §45 success
// test, with no API key involved.
//
// The method is deliberately narrow rather than clever. It looks for two
// things only: **prices** ("bedrooms cost $35", "$120 per hour") and
// **questions** ("how many X", "whether they want Y"), matches them up by
// shared words, and picks an input type from what the subject looks like.
// When it can't find at least two questions it stops guessing and clones the
// closest template instead, because a half-understood widget is worse than a
// good one with the wrong name on it (§30's "fall back to a safe template").

import { widgetSchemaSchema, type WidgetDocument, type WidgetType } from "@/lib/widget/schema";
import { fieldise } from "@/lib/widget/format";
import { guessIllustration, type IllustrationKey } from "@/lib/widget/illustrations";
import { TEMPLATES, type TemplateDefinition } from "@/lib/templates/catalogue";
import { parseGeneratedWidget } from "./repair";
import type { AIProvider, GenerateOptions, GeneratedWidget } from "./provider";

export class HeuristicProvider implements AIProvider {
  async generateWidget(prompt: string, options: GenerateOptions = {}): Promise<GeneratedWidget> {
    return generateLocally(prompt, options);
  }
}

/** Exported so the Anthropic provider can use it as its own last resort. */
export function generateLocally(prompt: string, options: GenerateOptions = {}): GeneratedWidget {
  const built = buildFromPrompt(prompt, options);
  if (built) return { document: built, source: "parsed" };

  const template = closestTemplate(prompt, options.preferredType);
  return {
    document: adaptTemplate(template, prompt),
    source: "template",
    note: `We started you off from our ${template.name} template — edit anything you like.`,
  };
}

/* ------------------------------------------------------------------ */
/* Reading the prompt                                                  */
/* ------------------------------------------------------------------ */

const CONNECTORS = new Set([
  "is", "are", "was", "were", "be", "cost", "costs", "costing", "at", "for", "from", "of",
  "about", "around", "roughly", "just", "only", "each", "per", "start", "starts", "starting",
  "begin", "begins", "price", "priced", "prices", "charge", "charges", "charged", "plus",
  "add", "adds", "extra", "then", "and", "with", "would", "will", "we", "i", "they",
]);

const STOPWORDS = new Set([
  "how", "what", "which", "where", "when", "who", "why", "whether",
  "the", "a", "an", "my", "our", "your", "their", "its", "it", "them", "customer", "customers",
  "client", "clients", "user", "users", "people", "person", "want", "wants", "wanted", "need",
  "needs", "like", "likes", "have", "has", "had", "get", "gets", "make", "makes", "asks", "ask",
  "asking", "questions", "question", "also", "any", "some", "much", "many", "more", "additional",
]);

/** Nouns we know how to count with a small grid of answer cards. */
const SMALL_COUNTS =
  /bedroom|bathroom|\broom|\bbed\b|\bbath\b|\bcar\b|\bpet|floor|storey|story|level|window|door|desk|seat|toilet|bin|kid|child/;

/** Nouns whose answers are big numbers — a slider or a text field. */
const LARGE_COUNTS =
  /guest|visitor|hour|mile|kilometre|kilometer|\bkm\b|page|employee|staff|user|customer|attendee|item|unit|\bday|week|month|year|square|sqft|foot|feet|metre|meter|session|word|photo|image|product|sku/;

/** Nouns that are amounts of money rather than counts of things. */
const MONEY_WORDS = /budget|spend|spending|revenue|turnover|salary|income|value|deal|invoice|fee|rent/;

interface PriceFact {
  subject: string;
  amount: number;
  /** "$1,500 starting" style: a floor price, not a per-unit rate. */
  isBase: boolean;
  /** "$120 per hour" — the subject is definitely a multiplier. */
  perUnit: boolean;
}

interface SubjectDraft {
  tokens: string[];
  price?: number;
  perUnit?: boolean;
  forceToggle?: boolean;
  forceCount?: boolean;
}

/**
 * Crude singular stem, used only for matching.
 *
 * "$120 per hour" and "how many hours of coverage" are the same subject, and
 * without this they become two questions, one of which is never priced.
 */
function stem(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (/(?:ches|shes|sses|xes|zes)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

const PRICE_PATTERN =
  /\$\s*([\d,]+(?:\.\d{1,2})?)|\b([\d,]+(?:\.\d{1,2})?)\s*(?:dollars|usd|pounds|gbp|euros|eur)\b/gi;

function readPrices(text: string): PriceFact[] {
  const facts: PriceFact[] = [];
  PRICE_PATTERN.lastIndex = 0;

  for (let match = PRICE_PATTERN.exec(text); match; match = PRICE_PATTERN.exec(text)) {
    const amount = Number((match[1] ?? match[2] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const before = text.slice(Math.max(0, match.index - 80), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 40);

    // "$120 per hour" / "$40 each room" — the noun comes after the number.
    const trailing = /^\s*(?:per|each|an|a|\/)\s+([a-z][a-z-]*)/i.exec(after);
    if (trailing) {
      facts.push({ subject: trailing[1].toLowerCase(), amount, isBase: false, perUnit: true });
      continue;
    }

    // Only look back as far as the current clause. "Bedrooms cost $35,
    // bathrooms $25" has to give two subjects, not one four-word smudge.
    const clause = before.slice(
      Math.max(
        ...[".", ",", ";", "!", "?", "$", ":"].map((mark) => before.lastIndexOf(mark) + 1),
        0
      )
    );

    const isBase = /\b(start|starts|starting|from|base|minimum|minimums|begin|begins)\b[^.]*$/i.test(clause);
    const subject = subjectBefore(clause);
    if (subject) facts.push({ subject, amount, isBase, perUnit: false });
    else if (isBase) facts.push({ subject: "", amount, isBase: true, perUnit: false });
  }

  return facts;
}

/** Walk backwards past the verb to whatever was being priced. */
function subjectBefore(before: string): string {
  const tokens = before.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
  while (tokens.length > 0 && CONNECTORS.has(tokens[tokens.length - 1])) tokens.pop();

  const words: string[] = [];
  while (tokens.length > 0 && words.length < 3) {
    const token = tokens.pop() as string;
    if (STOPWORDS.has(token) || CONNECTORS.has(token)) break;
    words.unshift(token);
  }
  return words.join(" ");
}

/** Phrases the prompt explicitly asks to be asked about. */
function readQuestions(text: string): SubjectDraft[] {
  const drafts: SubjectDraft[] = [];
  const add = (phrase: string, extra: Partial<SubjectDraft> = {}) => {
    for (const part of phrase.split(/\band\b|,|\bor\b|\/|&/)) {
      const tokens = meaningfulTokens(part);
      if (tokens.length === 0) continue;
      drafts.push({ tokens, ...extra });
    }
  };

  for (const match of text.matchAll(/how (?:many|much)\s+([^.?!;]{2,80})/gi)) {
    add(stripTail(match[1]), { forceCount: true });
  }
  for (const match of text.matchAll(
    /whether (?:they|the customer|you|he|she)?\s*(?:want|wants|need|needs|would like|would want|have|has|require|requires)?\s*([^.?!;,]{2,60})/gi
  )) {
    add(match[1], { forceToggle: true });
  }
  for (const match of text.matchAll(/\bif they (?:want|need|have|would like)\s+([^.?!;,]{2,60})/gi)) {
    add(match[1], { forceToggle: true });
  }
  for (const match of text.matchAll(
    /\basks?(?: (?:for|about|them for|the customer(?:'s)?|their))?\s+([^.?!;]{2,120})/gi
  )) {
    add(stripTail(match[1]));
  }

  return drafts;
}

/** Trims the trailing clause "the customer has" / "they need". */
function stripTail(phrase: string): string {
  return phrase.replace(
    /\b(?:the customer|the client|they|you|he|she)\s+(?:has|have|had|needs?|wants?|require[sd]?)\b.*$/i,
    ""
  );
}

function meaningfulTokens(phrase: string): string[] {
  return (phrase.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter(
    (token) => token.length > 2 && !STOPWORDS.has(token) && !CONNECTORS.has(token)
  );
}

/** Two subjects are the same subject if they share a meaningful word stem. */
function merge(drafts: SubjectDraft[]): SubjectDraft[] {
  const merged: SubjectDraft[] = [];

  for (const draft of drafts) {
    const stems = new Set(draft.tokens.map(stem));
    const existing = merged.find((entry) => entry.tokens.some((token) => stems.has(stem(token))));

    if (!existing) {
      merged.push({ ...draft, tokens: [...draft.tokens] });
      continue;
    }

    // Facts from either mention belong to the merged subject. Question drafts
    // are added first, so their wording wins the naming.
    existing.price = existing.price ?? draft.price;
    existing.perUnit = existing.perUnit || draft.perUnit;
    existing.forceToggle = existing.forceToggle || draft.forceToggle;
    existing.forceCount = existing.forceCount || draft.forceCount;
    for (const token of draft.tokens) {
      if (!existing.tokens.some((known) => stem(known) === stem(token))) existing.tokens.push(token);
    }
  }

  return merged;
}

/* ------------------------------------------------------------------ */
/* Building the widget                                                 */
/* ------------------------------------------------------------------ */

interface BuiltStep {
  step: Record<string, unknown>;
  /** The expression term this question contributes, if it has a price. */
  term?: string;
}

function buildFromPrompt(prompt: string, options: GenerateOptions): WidgetDocument | null {
  const text = prompt.trim();
  if (text.length < 12) return null;

  const prices = readPrices(text);
  const questions = readQuestions(text);

  const drafts: SubjectDraft[] = [...questions];
  for (const fact of prices) {
    if (fact.isBase || !fact.subject) continue;
    const tokens = meaningfulTokens(fact.subject);
    if (tokens.length === 0) continue;
    drafts.push({ tokens, price: fact.amount, perUnit: fact.perUnit });
  }

  const subjects = merge(drafts).filter((subject) => subject.tokens.length > 0);
  // Two questions is the floor for something worth calling a widget.
  if (subjects.length < 2) return null;

  const type = detectType(text, options.preferredType);
  const domain = detectDomain(text);
  const usedIds = new Set<string>();
  const built: BuiltStep[] = [];

  for (const subject of subjects.slice(0, 8)) {
    const step = buildStep(subject, usedIds);
    if (step) built.push(step);
  }
  if (built.length < 2) return null;

  const baseValue = prices.find((fact) => fact.isBase)?.amount ?? 0;
  const terms = built.map((entry) => entry.term).filter(Boolean) as string[];
  const expression = ["total", ...terms].join(" + ");

  const candidate = {
    name: nameFor(text, domain, type),
    type,
    intro: {
      heading: domain.introHeading,
      description: domain.introDescription,
      buttonLabel: "Get started",
      illustration: domain.illustration,
    },
    steps: built.map((entry) => entry.step),
    logic: [],
    result: {
      // A quote is a range; a calculator answers with the number it computed.
      kind: type === "estimator" ? "range" : "value",
      heading: type === "quiz" ? "Your match" : domain.resultHeading,
      description: domain.resultDescription,
      baseValue,
      expression,
      rangeSpread: 0.2,
      bullets: domain.bullets,
      cta: { label: domain.cta },
      disclaimer: domain.disclaimer,
    },
    theme: { preset: "playful", brandColour: domain.colour, radius: "l", buttonStyle: "filled" },
    settings: {
      leadCapture: {
        mode: "after",
        fields: ["name", "email"],
        heading: "Want this sent over?",
      },
    },
  };

  return parseGeneratedWidget(candidate);
}

function buildStep(subject: SubjectDraft, usedIds: Set<string>): BuiltStep | null {
  // "How many bedrooms" names one thing; "a second photographer" names a
  // compound. Counting questions take the head noun, everything else keeps
  // the pair, so field ids read like `bedrooms` and `second_photographer`.
  const headTokens = subject.forceCount ? subject.tokens.slice(0, 1) : subject.tokens.slice(0, 2);
  const label = tidy(headTokens.join(" "));

  const base = fieldise(headTokens.join("_"), "answer");
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) id = `${base}_${suffix++}`;
  usedIds.add(id);

  const illustration = guessIllustration(subject.tokens.join(" ")) ?? undefined;
  const price = subject.price;

  const isToggle =
    subject.forceToggle || (!subject.forceCount && !looksCountable(subject) && price !== undefined);

  if (isToggle) {
    return {
      step: {
        id,
        title: `Would you like ${withArticle(label)}?`,
        required: false,
        input: {
          kind: "toggle",
          onLabel: "Yes please",
          offLabel: "No thanks",
          defaultValue: false,
          illustration,
        },
      },
      term: price ? `${id} * ${price}` : undefined,
    };
  }

  const words = subject.tokens.join(" ");

  if (MONEY_WORDS.test(words)) {
    return {
      step: {
        id,
        title: `What's your ${lowerFirst(label)}?`,
        input: { kind: "number", min: 0, step: 50, prefix: "$", defaultValue: 0 },
      },
      term: price ? `${id} * ${price}` : undefined,
    };
  }

  if (LARGE_COUNTS.test(words)) {
    return {
      step: {
        id,
        title: `How many ${lowerFirst(pluralise(label))}?`,
        input: { kind: "slider", min: 1, max: 40, step: 1, defaultValue: 5 },
      },
      term: price ? `${id} * ${price}` : undefined,
    };
  }

  if (subject.forceCount || SMALL_COUNTS.test(words) || price !== undefined) {
    const max = /bathroom|toilet/.test(words) ? 4 : 5;
    return {
      step: {
        id,
        title: `How many ${lowerFirst(pluralise(label))}?`,
        input: {
          kind: "choice",
          columns: 3,
          options: countOptions(max, illustration),
        },
      },
      term: price ? `${id} * ${price}` : undefined,
    };
  }

  // Something was asked for that we can't price or count. Ask it plainly
  // rather than inventing answers for it.
  return {
    step: {
      id,
      title: `Tell us about ${lowerFirst(label)}`,
      required: false,
      input: { kind: "text", placeholder: "A sentence is plenty", maxLength: 300 },
    },
  };
}

function countOptions(max: number, illustration?: IllustrationKey) {
  const options = [];
  for (let count = 1; count <= max; count += 1) {
    options.push({
      id: `n${count}`,
      label: count === max ? `${count}+` : String(count),
      value: count,
      illustration,
    });
  }
  options.push({ id: "unsure", label: "Not sure", value: Math.min(2, max), illustration: "question" });
  return options;
}

function looksCountable(subject: SubjectDraft): boolean {
  const words = subject.tokens.join(" ");
  if (SMALL_COUNTS.test(words) || LARGE_COUNTS.test(words) || MONEY_WORDS.test(words)) return true;
  return subject.tokens.some((token) => token.endsWith("s") && !token.endsWith("ss"));
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

function detectType(text: string, preferred?: WidgetType): WidgetType {
  if (preferred) return preferred;
  const lower = text.toLowerCase();
  if (/\bquiz|recommend|recommender|which .* (?:is|should)|finder|find the right|match me|personality\b/.test(lower)) {
    return "quiz";
  }
  if (/\bestimat|quote|quoting|how much would|ballpark\b/.test(lower)) return "estimator";
  return "calculator";
}

interface DomainCopy {
  key: string;
  keywords: RegExp;
  illustration: IllustrationKey;
  colour: string;
  introHeading: string;
  introDescription: string;
  resultHeading: string;
  resultDescription: string;
  bullets: string[];
  cta: string;
  disclaimer: string;
}

const DOMAINS: DomainCopy[] = [
  {
    key: "cleaning",
    keywords: /clean|housekeep|maid|tidy|janitor/,
    illustration: "bucket",
    colour: "#5B5FEF",
    introHeading: "Get your cleaning estimate",
    introDescription: "A few quick questions and you'll have a price. No phone call needed.",
    resultHeading: "Your estimated price",
    resultDescription: "Every home is different — this is a ballpark based on what you told us.",
    bullets: ["Professional & insured", "All supplies included", "Satisfaction guaranteed"],
    cta: "Book my clean",
    disclaimer: "This is an indicative estimate. We'll confirm your exact price before booking.",
  },
  {
    key: "photography",
    keywords: /photo|photograph|videograph|film|shoot|wedding/,
    illustration: "camera",
    colour: "#E8607E",
    introHeading: "Let's price your shoot",
    introDescription: "Tell us what you're planning and we'll give you a real number.",
    resultHeading: "Your shoot, roughly",
    resultDescription: "Includes editing and an online gallery you can share.",
    bullets: ["Edited high-resolution images", "Online gallery", "Print release included"],
    cta: "Check my date",
    disclaimer: "Dates book up fast — this quote holds for 14 days.",
  },
  {
    key: "web",
    keywords: /website|web design|landing page|app\b|software|development|seo|marketing site/,
    illustration: "browser",
    colour: "#5B5FEF",
    introHeading: "What will your project cost?",
    introDescription: "A real range in under a minute, so we both know if we're a fit.",
    resultHeading: "Your project estimate",
    resultDescription: "Design, build, testing and launch.",
    bullets: ["Fixed price before we start", "Weekly demos", "Two rounds of revisions"],
    cta: "Book a call",
    disclaimer: "A proper estimate needs a conversation. This gets us to the right ballpark.",
  },
  {
    key: "moving",
    keywords: /moving|removal|relocat|\bvan\b|haulage|storage/,
    illustration: "truck",
    colour: "#2E9C8B",
    introHeading: "What will your move cost?",
    introDescription: "Four questions. No survey visit needed for a ballpark.",
    resultHeading: "Your move, estimated",
    resultDescription: "Based on the size of the job and how far it's going.",
    bullets: ["Fully insured", "Blankets and straps included", "No hidden fuel charges"],
    cta: "Get my exact quote",
    disclaimer: "Final price confirmed after a short call.",
  },
  {
    key: "event",
    keywords: /event|party|wedding planning|caterin|venue|conference|birthday/,
    illustration: "balloons",
    colour: "#E5A21C",
    introHeading: "Let's budget your event",
    introDescription: "Answer a few questions and see where the money goes.",
    resultHeading: "Your event budget",
    resultDescription: "Everything you picked, added up.",
    bullets: ["No booking fee", "Payment plans available", "Change numbers any time"],
    cta: "Check availability",
    disclaimer: "Prices vary by date and season. Ask us for a firm quote.",
  },
  {
    key: "fitness",
    keywords: /fitness|gym|personal train|yoga|pilates|coach|nutrition/,
    illustration: "heart",
    colour: "#2E9C8B",
    introHeading: "Build your plan",
    introDescription: "Tell us how you train and we'll price the right programme.",
    resultHeading: "Your plan",
    resultDescription: "Adjust anything — nothing is locked in until you book.",
    bullets: ["Cancel any time", "Qualified coaches", "Progress reviewed monthly"],
    cta: "Start training",
    disclaimer: "Speak to a doctor before starting a new programme.",
  },
  {
    key: "finance",
    keywords: /mortgage|loan|invest|savings|pension|insurance|tax|accounting|roi|return/,
    illustration: "coins",
    colour: "#1B1F3B",
    introHeading: "Run the numbers",
    introDescription: "A few figures you already know. We'll do the arithmetic.",
    resultHeading: "Your result",
    resultDescription: "Based entirely on the numbers you entered.",
    bullets: ["No obligation", "Your figures aren't stored", "Speak to an adviser any time"],
    cta: "Talk to us",
    disclaimer: "Estimates, not advice. Your circumstances matter.",
  },
];

const GENERIC: DomainCopy = {
  key: "generic",
  keywords: /.^/,
  illustration: "sparkle",
  colour: "#5B5FEF",
  introHeading: "Let's work this out",
  introDescription: "A few quick questions and you'll have your answer.",
  resultHeading: "Your result",
  resultDescription: "Based on what you told us.",
  bullets: ["No obligation", "Takes under a minute", "Change your answers any time"],
  cta: "Get in touch",
  disclaimer: "This is an indicative estimate.",
};

function detectDomain(text: string): DomainCopy {
  const lower = text.toLowerCase();
  return DOMAINS.find((domain) => domain.keywords.test(lower)) ?? GENERIC;
}

/** Words that mean the phrase is instructions to us, not the widget's name. */
const NOT_A_NAME = new Set([
  "make", "build", "create", "me", "my", "our", "us", "a", "an", "the", "new", "want", "need",
  "help", "please", "another", "this", "that", "some", "for", "is", "it", "give", "generate",
]);

function nameFor(text: string, domain: DomainCopy, type: WidgetType): string {
  const named = /\b([a-z]+(?: [a-z]+)?)\s+(calculator|estimator|estimate|quote|quiz|finder|budget)\b/i.exec(
    text
  );
  if (named) {
    const words = named[1].trim().split(/\s+/);
    if (!words.some((word) => NOT_A_NAME.has(word.toLowerCase()))) {
      return titleCase(`${words.join(" ")} ${named[2]}`, text);
    }
  }

  const domainName = domain.key === "generic" ? "" : `${titleCase(domain.key, text)} `;
  const suffix = type === "quiz" ? "Finder" : type === "estimator" ? "Estimate" : "Calculator";
  return `${domainName}${suffix}`.trim();
}

/**
 * Title case that leaves acronyms alone: "ROI calculator" must not become
 * "Roi Calculator", so a word written in capitals in the prompt stays that way.
 */
function titleCase(value: string, source = ""): string {
  const shouty = new Set((source.match(/\b[A-Z]{2,}\b/g) ?? []).map((word) => word.toLowerCase()));
  return value
    .split(/\s+/)
    .map((word) =>
      shouty.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
}

function tidy(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[^a-z0-9]+|[^a-z0-9+]+$/gi, "")
    .trim();
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * "second photographer" → "a second photographer"; "oven cleaning" → itself.
 * Gerunds and plurals are mass nouns in this position and take no article.
 */
function withArticle(phrase: string): string {
  const words = phrase.split(" ");
  const last = words[words.length - 1] ?? "";
  if (!phrase || last.endsWith("s") || last.endsWith("ing")) return lowerFirst(phrase);
  const article = /^[aeiou]/i.test(phrase) ? "an" : "a";
  return `${article} ${lowerFirst(phrase)}`;
}

function pluralise(value: string): string {
  const words = value.split(" ");
  const last = words[words.length - 1];
  if (!last || last.endsWith("s")) return value;
  words[words.length - 1] = /(?:ch|sh|x|z|s)$/.test(last) ? `${last}es` : `${last}s`;
  return words.join(" ");
}

/* ------------------------------------------------------------------ */
/* Template fallback                                                   */
/* ------------------------------------------------------------------ */

/** Score every template against the prompt's words and take the best. */
export function closestTemplate(prompt: string, preferredType?: WidgetType): TemplateDefinition {
  const words = new Set((prompt.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !STOPWORDS.has(w)));

  let best = TEMPLATES[0];
  let bestScore = -1;

  for (const template of TEMPLATES) {
    const haystack = `${template.name} ${template.tagline} ${template.audience} ${template.type}`.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (haystack.includes(word)) score += 2;
      else if (template.document.steps.some((step) => step.title.toLowerCase().includes(word))) score += 1;
    }
    if (preferredType && template.type === preferredType) score += 1;
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Clone a template and give it the name the person actually asked for, so a
 * fallback still feels like an answer to their question rather than a
 * suggestion to go and read the gallery.
 */
function adaptTemplate(template: TemplateDefinition, prompt: string): WidgetDocument {
  const domain = detectDomain(prompt);
  const type = detectType(prompt);
  const name = nameFor(prompt, domain, type);
  const clone = structuredClone(template.document);

  return widgetSchemaSchema.parse({
    ...clone,
    name: name || clone.name,
  });
}
