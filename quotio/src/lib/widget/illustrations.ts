// The illustration vocabulary (brief §8).
//
// Deliberately small. Illustrations appear on template cards and on
// multiple-choice answers — nowhere else — so a short, well-drawn list beats
// a big clip-art library. Every key here has a matching flat vector drawing in
// src/components/illustrations/Illustration.tsx, using only the brand palette.
//
// This module is data only (no JSX) so the schema and the AI providers can
// validate against it without pulling React into a server bundle.

export const ILLUSTRATION_KEYS = [
  // Home & cleaning
  "bed",
  "bath",
  "couch",
  "bucket",
  "sponge",
  "oven",
  "window",
  "house",
  // Money & business
  "coins",
  "wallet",
  "graph",
  "chart",
  "target",
  // Events
  "balloons",
  "cake",
  "calendar",
  "camera",
  "music",
  // Web & product
  "browser",
  "cursor",
  "phone",
  "palette",
  "rocket",
  // Generic
  "person",
  "people",
  "question",
  "star",
  "heart",
  "clock",
  "box",
  "truck",
  "plant",
  "sun",
  "droplet",
  "sparkle",
  "shield",
  "gift",
] as const;

export type IllustrationKey = (typeof ILLUSTRATION_KEYS)[number];

const KEY_SET = new Set<string>(ILLUSTRATION_KEYS);

export function isIllustrationKey(value: unknown): value is IllustrationKey {
  return typeof value === "string" && KEY_SET.has(value);
}

/**
 * Best-effort match from free text to an illustration.
 *
 * Used when generating widgets: an answer labelled "3 Bedrooms" should get the
 * bed drawing without the model having to name it. Returns null rather than
 * guessing wildly — no illustration is better than a wrong one (§8).
 */
export function guessIllustration(text: string): IllustrationKey | null {
  const haystack = text.toLowerCase();

  const rules: Array<[RegExp, IllustrationKey]> = [
    [/\bbed|bedroom|sleep/, "bed"],
    [/\bbath|shower|toilet|washroom|ensuite/, "bath"],
    [/\bcouch|sofa|living|lounge/, "couch"],
    [/\bclean|bucket|mop/, "bucket"],
    [/\bsponge|scrub|wipe/, "sponge"],
    [/\boven|kitchen|stove|cook/, "oven"],
    [/\bwindow|glass|blinds/, "window"],
    [/\bhouse|home|apartment|flat|property|villa|studio/, "house"],
    [/\bprice|cost|budget|coin|money|cash|fee|\$/, "coins"],
    [/\bwallet|pay|invoice|salary|income/, "wallet"],
    [/\bgrowth|roi|return|revenue|profit|graph/, "graph"],
    [/\breport|analytic|metric|data|chart/, "chart"],
    [/\bgoal|target|objective|conversion/, "target"],
    [/\bballoon|party|celebrat/, "balloons"],
    [/\bcake|catering|food|dessert|dinner/, "cake"],
    [/\bdate|calendar|schedul|booking|month|week|day/, "calendar"],
    [/\bphoto|camera|shoot|portrait|headshot/, "camera"],
    [/\bmusic|dj|band|sound|audio/, "music"],
    [/\bwebsite|web|page|landing|browser|site/, "browser"],
    [/\bclick|cursor|interact|button/, "cursor"],
    [/\bphone|mobile|app|ios|android/, "phone"],
    [/\bdesign|brand|colour|color|logo|palette/, "palette"],
    [/\blaunch|start|grow|scale|rocket/, "rocket"],
    [/\bperson|myself|solo|individual|one person|freelanc/, "person"],
    [/\bteam|people|family|guests|group|couple|staff|employee/, "people"],
    [/\bnot sure|unsure|don'?t know|other|maybe|help/, "question"],
    [/\bpremium|best|favourite|favorite|popular|top|star/, "star"],
    [/\blove|like|prefer|heart|wellness|care/, "heart"],
    [/\bhour|time|duration|urgent|deadline|clock|minute/, "clock"],
    [/\bbox|package|parcel|storage|inventory/, "box"],
    [/\bmove|moving|truck|deliver|transport|relocat/, "truck"],
    [/\bplant|garden|green|eco|outdoor|yard/, "plant"],
    [/\bsun|summer|bright|day|energy|solar/, "sun"],
    [/\bwater|dry|moist|hydrat|oil|skin|liquid/, "droplet"],
    [/\bmagic|ai|smart|auto|clever|spark/, "sparkle"],
    [/\bsecur|insur|protect|safe|guarantee|warranty/, "shield"],
    [/\bgift|present|bonus|extra|free/, "gift"],
  ];

  for (const [pattern, key] of rules) {
    if (pattern.test(haystack)) return key;
  }
  return null;
}
