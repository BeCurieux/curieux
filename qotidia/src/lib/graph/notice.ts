// Three things worth mentioning.
//
// This is the surface the whole graph exists for: once a week, a short note
// that says what changed. Not a digest of admin, not a prompt to do more
// work — an observation, and the feeling that something is paying attention
// so the parent does not have to.
//
// The rule that keeps it from being creepy is the same one that keeps the
// book honest: **count, never interpret.** Every line below is arithmetic
// over things the family recorded, phrased as arithmetic. "The dinosaur hat,
// four times this week" is a fact about the archive. "Florence loves the
// dinosaur hat" is a claim about a child, and a product that starts making
// those has stopped being an archive and started being an opinion.
//
// The second rule is that three is the maximum and zero is allowed. A weekly
// note that always finds exactly three things is a weekly note nobody
// believes by the fourth week.

import {
  gapBeforeReturn,
  presenceOf,
  shapeOf,
  type Entity,
  type Shape,
} from "./presence";

export interface Observation {
  entityId: string;
  kind: Entity["kind"];
  shape: Shape;
  /** The line, as it appears. Contains the family's own words, never ours. */
  line: string;
  /** Every memory this was computed from. The provenance rule, applied here. */
  memoryIds: string[];
  /** Higher first. Surprise, not volume. */
  weight: number;
}

/**
 * How interesting each shape is to the person who lived it.
 *
 * "Back after months" beats "there a lot", which beats "there". A product
 * that leads with its biggest number tells you what you already know; one
 * that leads with the return tells you something you had half-forgotten.
 * "faded" ranks highest of all, because nothing else in the product can
 * notice a thing that stopped.
 */
const WEIGHT: Record<Shape, number> = {
  faded: 100,
  returned: 90,
  arrived: 70,
  surging: 55,
  steady: 10,
  quiet: 0,
};

/** Shapes worth a line at all. */
const WORTH_SAYING: Shape[] = ["faded", "returned", "arrived", "surging"];

const times = (n: number) =>
  n === 1 ? "once" : n === 2 ? "twice" : `${n} times`;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A date, as a person would say it.
 *
 * "since 2026-04-08" is a log line. Nobody remembers the eighth; they
 * remember April, and the month is as precise as this observation can
 * honestly be anyway.
 */
const monthOf = (iso: string, today: string) => {
  const [y, m] = iso.split("-");
  const month = MONTHS[Number(m) - 1] ?? iso;
  return y === today.slice(0, 4) ? month : `${month} ${y}`;
};

const monthsAgo = (days: number) => {
  const months = Math.round(days / 30);
  if (months <= 1) return "a month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.round(months / 12);
  return years === 1 ? "a year ago" : `${years} years ago`;
};

/**
 * A label starting a sentence.
 *
 * Tags are typed as filing labels — "the dinosaur hat" — and putting one at
 * the front of a sentence unedited gives you "the dinosaur hat, 4 times this
 * week", which looks like a bug rather than a voice. Only lifted when the
 * first word is entirely lowercase, so "iPad" and "mrs Wiggles" are left as
 * the family wrote them: this is capitalisation, not correction.
 */
function opening(label: string): string {
  const first = label.split(/\s/)[0] ?? "";
  if (first !== first.toLowerCase()) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The sentence for one entity.
 *
 * Each is a count or a date. Note what none of them say: whether it was
 * good, whether the child enjoyed it, what it meant. Those are the parent's
 * to know.
 */
function lineFor(entity: Entity, shape: Shape, today: string, windowDays: number): string {
  const p = presenceOf(entity, today, windowDays);
  // A quoted phrase is inside quotation marks and is the child's own
  // sentence, so it is never lifted — that one is a transcript.
  const said = entity.label;
  const label = opening(entity.label);

  switch (shape) {
    case "arrived":
      return entity.kind === "phrase"
        ? `“${said}” — that's new this week.`
        : `${label} turned up for the first time.`;
    case "returned": {
      const gap = gapBeforeReturn(entity, today, windowDays);
      return gap === null
        ? `${label} is back.`
        : `${label} is back — the time before was ${monthsAgo(gap)}.`;
    }
    case "surging":
      return entity.kind === "phrase"
        ? `“${said}” came up ${times(p.recent)} this week.`
        : `${label}, ${times(p.recent)} this week.`;
    case "faded":
      return p.last
        ? `${label} hasn't appeared since ${monthOf(p.last, today)}.`
        : `${label} hasn't appeared in a while.`;
    default:
      return `${label}, ${times(p.recent)} this week.`;
  }
}

export interface NoticeInput {
  entities: Entity[];
  today: string;
  windowDays?: number;
  /** Entity ids already shown recently, so a week does not repeat the last. */
  recentlyShown?: string[];
  max?: number;
}

/**
 * The week's observations, best first.
 *
 * Returns fewer than `max` — often none — rather than padding. The weeks
 * where nothing happened are real, and a note that arrives anyway with three
 * manufactured observations teaches people to stop opening it.
 */
export function noticeThisWeek(input: NoticeInput): Observation[] {
  const { entities, today } = input;
  const windowDays = input.windowDays ?? 7;
  const max = input.max ?? 3;
  const skip = new Set(input.recentlyShown ?? []);

  const out: Observation[] = [];

  for (const entity of entities) {
    if (skip.has(entity.id)) continue;
    const shape = shapeOf(entity, today, windowDays);
    if (!WORTH_SAYING.includes(shape)) continue;

    const p = presenceOf(entity, today, windowDays);
    // A faded entity is only worth mourning if it was ever really there.
    if (shape === "faded" && p.total < 5) continue;

    out.push({
      entityId: entity.id,
      kind: entity.kind,
      shape,
      line: lineFor(entity, shape, today, windowDays),
      memoryIds: entity.mentions.map((m) => m.memoryId),
      weight: WEIGHT[shape] + Math.min(p.total, 20),
    });
  }

  // One of each shape before a second of any, so a week of four surges does
  // not produce four near-identical lines.
  const ranked = out.sort((a, b) => b.weight - a.weight);
  const seen = new Set<Shape>();
  const spread: Observation[] = [];
  const rest: Observation[] = [];
  for (const o of ranked) {
    if (seen.has(o.shape)) rest.push(o);
    else {
      seen.add(o.shape);
      spread.push(o);
    }
  }

  return [...spread, ...rest].slice(0, max);
}

/** Whether a week is worth sending at all. */
export function worthSending(observations: Observation[]): boolean {
  return observations.length > 0;
}

// ------------------------------------------------------------ the gaps

export interface Gap {
  entityId: string;
  label: string;
  /** How often they appear. */
  appearances: number;
  /** The question, built from the gap. */
  question: string;
}

/**
 * People who are everywhere in the photographs and nowhere in the words.
 *
 * This is the observation the camera roll cannot make, and the questions it
 * produces create memories that would otherwise never exist. A parent will
 * photograph Wednesday at Grandma's forty times and never once write down
 * what they actually do there — and in thirty years that is the thing
 * anybody would want.
 *
 * Deliberately only about people. A frequently photographed *object* with
 * nothing written about it is usually just a sofa.
 */
export function gapsWorthAsking(input: {
  entities: Entity[];
  /** Memory ids that carry any written text, so a mention can be judged. */
  memoriesWithWords: Set<string>;
  minAppearances?: number;
}): Gap[] {
  const min = input.minAppearances ?? 6;

  return input.entities
    .filter((e) => e.kind === "person" && e.mentions.length >= min)
    .map((e) => {
      const described = e.mentions.filter((m) => input.memoriesWithWords.has(m.memoryId)).length;
      return { entity: e, described };
    })
    // Photographed a lot, written about almost never.
    .filter(({ entity, described }) => described <= Math.max(1, Math.floor(entity.mentions.length * 0.15)))
    .map(({ entity }) => ({
      entityId: entity.id,
      label: entity.label,
      appearances: entity.mentions.length,
      question: `${entity.label} is in a lot of these. What do they usually do together?`,
    }));
}
