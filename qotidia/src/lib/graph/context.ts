// What we don't know about something that clearly matters.
//
// identity.ts asks whether two names are one person. This asks the other
// kind of question: the archive can see that a thing is important and
// cannot see *why*, and the gap between those two is where almost all the
// value of a family archive actually sits.
//
// The rabbit is the example. After four years the graph knows `thing:bun_bun`
// appears in twenty-three memories, arrived at eighteen months and faded
// around school age. It does not know it was called Bun Bun rather than
// filed as bun_bun, that he went to France and to hospital, or that he
// stopped appearing because he was left in a hotel in Rye. Every one of
// those is a sentence somebody could give us in ten seconds today and
// nobody will be able to give us in twenty years.
//
// **That is the whole thesis of this module.** The photographs survive on
// their own. The meaning around them does not, and it decays on a human
// timescale — it is in one person's head, it fades, and eventually that
// person is not there to ask. A competitor starting in 2037 can buy better
// models and index the same photographs. They cannot go back and ask what
// the rabbit was called in 2027.
//
// ## The rules, which are the same three the rest of the graph runs on
//
//   **Count, never interpret.** Every question below is arithmetic over
//   what the family recorded, and the question says the arithmetic out
//   loud. "Twenty-three of these fall on a Saturday" is a fact about the
//   archive. "Saturdays were special for you" is a claim about a family,
//   and asking a question that contains a claim is just a slower way of
//   inventing a memory.
//
//   **Only what the family typed.** Nothing here looks at an image. We do
//   not know it is a scruffy rabbit; we know they tagged something
//   twenty-three times. The question has to be honest about which of those
//   two we are working from.
//
//   **A question is only asked once, ever.** Answered or skipped, it is
//   settled permanently. Asking a second time says nobody was listening the
//   first time, and this product's entire claim is that something is paying
//   attention.

import { countOf } from "@/lib/words";
import { ESTABLISHED_ENOUGH_TO_ASK } from "./identity";
import {
  daysBetween, presenceOf, shapeOf, type Entity, type EntityKind,
} from "./presence";

/** The three things worth asking about a thing that recurs. */
export type Wondering =
  /** We have a filing label and no idea what it stands for. */
  | "what_is_it"
  /** It lands on the same day of the week again and again. */
  | "was_it_a_ritual"
  /** It was a fixture and it stopped. */
  | "what_happened";

export interface ContextQuestion {
  entityId: string;
  kind: EntityKind;
  label: string;
  wondering: Wondering;
  /** The arithmetic, in one sentence. Shown above the question. */
  because: string;
  /** The question itself. */
  ask: string;
  /** A hint at the shape of a useful answer. Never an example answer. */
  placeholder: string;
  /** Every memory this was computed from — the provenance rule, again. */
  memoryIds: string[];
  weight: number;
}

/**
 * People are not asked about here.
 *
 * "What is this?" about a person is grotesque, and who they are is
 * identity.ts's job. Places, things, phrases and rituals are fair.
 */
const NEVER_ASK_ABOUT: EntityKind[] = ["person"];

/**
 * How much of a thing has to land on one weekday before it is a rhythm.
 *
 * Three quarters, and at least five of them. A family that photographs
 * anything at weekends will have a Saturday lean on everything they own, so
 * a simple majority finds a "ritual" in every entity in the archive and the
 * question becomes noise.
 */
const RITUAL_SHARE = 0.75;
const RITUAL_LEAST = 5;

/**
 * A thing has to have been around this long before its weekday means
 * anything.
 *
 * Five Saturdays in a fortnight is a holiday. Five Saturdays across eight
 * months is a Saturday thing.
 */
const RITUAL_OVER_DAYS = 120;

const WEIGHT: Record<Wondering, number> = {
  // Highest, and not close. A thing that stopped is the only question here
  // with a deadline on it: the answer is in somebody's memory and it is
  // going. The other two can be asked next year and get the same answer.
  what_happened: 100,
  what_is_it: 60,
  was_it_a_ritual: 40,
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/**
 * Does this label look like something a person said, or something filed?
 *
 * Tags arrive as keys — `bun_bun`, `swimming`, `ordinary_day` — and a key is
 * a filing decision rather than a name. A label with a space and a capital
 * in it was typed as a name and we already know what the thing is called.
 */
export function looksFiled(label: string): boolean {
  if (/[_]/.test(label)) return true;
  // A single lowercase word. "swimming" is filed; "Bun Bun" and "the yellow
  // boots" are not.
  return /^[a-z0-9]+$/.test(label.trim());
}

/** Which weekday each mention fell on, and how lopsided that is. */
export function weekdayLean(entity: Entity): { day: number; count: number; share: number } | null {
  const dated = entity.mentions.filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date));
  if (dated.length === 0) return null;

  const tally = new Array(7).fill(0);
  for (const m of dated) tally[new Date(`${m.date}T00:00:00Z`).getUTCDay()]++;

  let day = 0;
  for (let i = 1; i < 7; i++) if (tally[i] > tally[day]) day = i;
  return { day, count: tally[day], share: tally[day] / dated.length };
}

/** Questions already answered or skipped, as `${entityId}:${wondering}`. */
export type Settled = Set<string>;

export const questionKey = (entityId: string, wondering: Wondering) => `${entityId}:${wondering}`;

/**
 * Everything worth asking about this archive, best first.
 *
 * Returns all of them so a caller can count; the page shows one.
 */
export function contextQuestions(
  entities: Entity[],
  today: string,
  settled: Settled = new Set()
): ContextQuestion[] {
  const out: ContextQuestion[] = [];

  for (const entity of entities) {
    if (NEVER_ASK_ABOUT.includes(entity.kind)) continue;
    if (entity.mentions.length < ESTABLISHED_ENOUGH_TO_ASK) continue;

    const memoryIds = entity.mentions.map((m) => m.memoryId);
    const presence = presenceOf(entity, today);
    const shape = shapeOf(entity, today);
    const add = (q: Omit<ContextQuestion, "entityId" | "kind" | "label" | "weight" | "memoryIds">) => {
      if (settled.has(questionKey(entity.id, q.wondering))) return;
      out.push({
        entityId: entity.id,
        kind: entity.kind,
        label: entity.label,
        memoryIds,
        weight: WEIGHT[q.wondering],
        ...q,
      });
    };

    // ---------------------------------------------------- it stopped
    if (shape === "faded" && presence.last && presence.daysSinceLast !== null) {
      const months = Math.round(presence.daysSinceLast / 30);
      const across = Math.max(1, Math.round(presence.spanDays / 30));
      add({
        wondering: "what_happened",
        because:
          `${entity.label} is in ${countOf(presence.total, "memory", "memories")} across ` +
          `${across === 1 ? "a month" : `${countOf(across, "month")}`}, and hasn't appeared for ` +
          `${months <= 1 ? "a month" : countOf(months, "month")}.`,
        // Deliberately gentle and deliberately not leading. Things stop for
        // reasons a family may not want to write down — a toy was lost, a
        // person left, somebody died — and the question has to be as easy to
        // answer with "it just stopped" as with anything else.
        ask: `Did something happen, or did it just stop?`,
        placeholder: "It just stopped — or say what happened",
      });
    }

    // ------------------------------------------------- what is it, though
    if (looksFiled(entity.label)) {
      add({
        wondering: "what_is_it",
        because: `You've tagged ${entity.label} ${times(entity.mentions.length)}.`,
        // `times()` reads correctly here — "you've tagged swimming 9 times" —
        // and does not in the sentence above, where the count is of memories
        // rather than of taggings. One phrasing helper, two grammars; the
        // difference is what produced "Bun Bun is in 4 times across 5
        // months" on the real page.
        // Two sentences because the second is the one worth having. The name
        // is nice; "she couldn't sleep without him" is the archive.
        ask: `What is it, and what was it to them?`,
        placeholder: "What you'd call it, and why it mattered",
      });
    }

    // ------------------------------------------------------ same day, again
    const lean = weekdayLean(entity);
    if (
      lean &&
      lean.count >= RITUAL_LEAST &&
      lean.share >= RITUAL_SHARE &&
      presence.spanDays >= RITUAL_OVER_DAYS
    ) {
      add({
        wondering: "was_it_a_ritual",
        because:
          `${lean.count} of these fall on a ${DAYS[lean.day]}, over ` +
          `${Math.round(presence.spanDays / 30)} months.`,
        ask: `Was that a regular thing?`,
        placeholder: "What it was, if it was anything",
      });
    }
  }

  // Highest weight first, then the thing with the most behind it — a
  // question about twenty memories is worth more than the same question
  // about five.
  return out.sort((a, b) => b.weight - a.weight || b.memoryIds.length - a.memoryIds.length);
}

/**
 * The one to ask.
 *
 * One at a time, always. A screen of these is data entry, and the moment
 * this becomes a chore it stops being answered truthfully — which makes the
 * answers worthless, because their whole value is that a person meant them.
 */
export function nextQuestion(
  entities: Entity[],
  today: string,
  settled: Settled = new Set()
): ContextQuestion | null {
  return contextQuestions(entities, today, settled)[0] ?? null;
}

/** How long ago the oldest unanswered question became askable. */
export function oldestUnanswered(entities: Entity[], today: string, settled: Settled): number {
  const qs = contextQuestions(entities, today, settled);
  let worst = 0;
  for (const q of qs) {
    const entity = entities.find((e) => e.id === q.entityId);
    if (!entity) continue;
    const p = presenceOf(entity, today);
    if (p.first) worst = Math.max(worst, daysBetween(today, p.first));
  }
  return worst;
}
