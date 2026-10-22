import type { BusinessProfile } from "@/lib/domain/profile";
import type { Product } from "@/lib/domain/product";

// The claims guard: a second pair of eyes on every generated asset.
//
// The model is told not to invent facts, but telling isn't checking. This
// scans the output for the kinds of claim that get small brands into
// trouble — reviews, certifications, health or eco claims, guarantees,
// delivery promises, pressure tactics, income claims — and warns when one
// appears that the customer never gave us. It also catches anything she
// listed as prohibited.
//
// It warns rather than blocks: "organic" is fine if her cotton really is
// certified organic, and only she knows. The warning tells her exactly what
// to check and how to make it go away (add it to her verified facts).

interface Rule {
  label: string;
  pattern: RegExp;
  advice: string;
  /** Never acceptable, even if a "fact" mentions it. */
  always?: boolean;
}

const RULES: Rule[] = [
  {
    label: "a review or testimonial",
    pattern:
      /(["“][^"”]{8,}["”]\s*[—–-]\s*[A-Z][a-z]+)|\b(customers (love|say|rave)|our (happy )?customers|five[- ]star|5[- ]star|★)/i,
    advice: "Use only real reviews from real customers, quoted with permission.",
  },
  {
    label: "a rating or bestseller claim",
    pattern:
      /\b(best[- ]?sell(ing|er)|#1|number one|top[- ]rated|award[- ]winning|as seen in|bestselling)\b/i,
    advice: "Remove it unless you can show the evidence.",
  },
  {
    label: "a guarantee",
    pattern: /\b(guarantee[ds]?|risk[- ]free|money[- ]back)\b/i,
    advice: "Only promise what your written policy says.",
  },
  {
    label: "a certification or health claim",
    pattern:
      /\b(organic|certified|vegan|cruelty[- ]free|hypoallergenic|non[- ]toxic|dermatologist|clinically|FDA|chemical[- ]free|toxin[- ]free|medical[- ]grade|cures?|heals?)\b/i,
    advice: "Certifications and health claims need proof, and some are regulated.",
  },
  {
    label: "an environmental claim",
    pattern:
      /\b(eco[- ]friendly|sustainabl[ey]|biodegradable|compostable|carbon[- ]neutral|zero[- ]waste|plastic[- ]free|recycled)\b/i,
    advice: "Green claims must be specific and provable (regulators check).",
  },
  {
    label: "an origin claim",
    pattern: /\b(hand[- ]?made|made in [A-Z][a-z]+|locally made|family[- ]owned)\b/i,
    advice: "Say where and how it's made only if that's exactly right.",
  },
  {
    label: "a delivery promise",
    pattern:
      /\b(free (shipping|delivery)|next[- ]day|same[- ]day|ships? (in|within) \d|arrives? in \d|\d+[- ]day delivery)\b/i,
    advice: "Only state delivery terms you've actually set up.",
  },
  {
    label: "pressure or fake scarcity",
    pattern:
      /\b(only \d+ left|selling fast|limited time|last chance|hurry|ends (tonight|soon|today)|while stocks last|almost gone|don'?t miss out)\b/i,
    advice: "Remove it unless it is literally true right now.",
    always: false,
  },
  {
    label: "an income or results claim",
    pattern:
      /\b(passive income|six[- ]figures?|make \$\d|earn \$\d|guaranteed (results|sales)|quit your (day )?job)\b/i,
    advice: "Remove it. Earnings claims are regulated and Empire Studio never makes them.",
    always: true,
  },
];

/** All the text she has given us, lower-cased, to check claims against. */
function factCorpus(profile: BusinessProfile, product?: Product): string {
  return [
    ...profile.verifiedClaims,
    profile.productsSummary,
    profile.goal,
    ...(product
      ? [
          ...product.verifiedClaims,
          product.materials,
          product.shippingInfo,
          product.careInstructions,
          product.benefits,
          product.imageNotes,
          product.dimensions,
        ]
      : []),
  ]
    .join("\n")
    .toLowerCase();
}

export function collectStrings(
  value: unknown,
  path = "",
  out: { path: string; text: string }[] = [],
) {
  if (typeof value === "string") out.push({ path, text: value });
  else if (Array.isArray(value))
    value.forEach((item, i) => collectStrings(item, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value))
      collectStrings(item, path ? `${path}.${key}` : key, out);
  }
  return out;
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9#$ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function checkClaims(
  output: unknown,
  profile: BusinessProfile,
  product?: Product,
): string[] {
  const corpus = factCorpus(profile, product);
  const warnings = new Set<string>();
  const strings = collectStrings(output);

  for (const { text } of strings) {
    for (const rule of RULES) {
      const match = text.match(rule.pattern);
      if (!match) continue;
      const phrase = match[0].trim();
      // Placeholders are instructions to her, not claims.
      if (
        /\[[^\]]*$/.test(text.slice(0, match.index)) &&
        /^[^[]*\]/.test(text.slice((match.index ?? 0) + phrase.length))
      )
        continue;
      const supported = !rule.always && corpus.includes(phrase.toLowerCase());
      if (!supported) {
        warnings.add(
          `Mentions ${rule.label} (“${phrase}”) that isn't in your verified facts. ${rule.advice}`,
        );
      }
    }
  }

  for (const prohibited of profile.prohibitedClaims) {
    const needle = normalise(prohibited);
    if (needle.length < 3) continue;
    if (strings.some(({ text }) => normalise(text).includes(needle))) {
      warnings.add(
        `Says “${prohibited}”, which you asked us never to say. Edit it out before using this.`,
      );
    }
  }

  return [...warnings];
}
