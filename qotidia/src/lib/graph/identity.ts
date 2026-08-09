// Are these two the same?
//
// The archive knows that "Mimi" appears in eleven memories and "Grandma Sue"
// in nine. It does not know they are one grandmother, and it cannot work
// that out — not honestly. buildEntities() already merges threads that cover
// the same memories, which catches `thing:bun_bun` and `ritual:Bun Bun`; two
// names for the same person usually appear in *different* photographs, so
// there is no overlap to find.
//
// The temptation is to infer. Compare faces, cluster by co-occurrence, guess
// from context. Every one of those is a product deciding something about a
// family it was not told, which is the line this project does not cross —
// and it is also the line that makes the answer worth having, because a
// resolution the family confirmed is a fact and a resolution we guessed is a
// liability.
//
// So this module does not merge anything. It ranks the questions worth
// asking, and the family answers. That answer is the durable asset: a
// competitor starting in five years can buy better models and cannot buy the
// afternoon somebody told us Mimi is Grandma Sue.
//
// Three rules the ranking is built on.
//
//   **A "no" is worth as much as a "yes", and lasts as long.** Asking twice
//   whether Nana and Grandma are the same person is worse than never asking:
//   it says nobody was listening the first time. Both answers are stored and
//   both permanently silence the question.
//
//   **Only ever one at a time.** A screen of "are these the same?" is data
//   entry, and the moment this becomes a chore it stops being answered
//   truthfully. It takes one of the small number of question slots the
//   product spends in a week, and competes with everything else on merit.
//
//   **Never across kinds.** A person is never the same as a place. The
//   question is embarrassing and the answer is useless.

import type { Entity, EntityKind } from "./presence";

/**
 * Below this, an entity is not established enough to be worth a question.
 *
 * Asking about something mentioned twice spends a question on a coincidence.
 * Higher than the graph's own MIN_MENTIONS because a *question* is a more
 * expensive thing to be wrong about than a line in a note.
 */
export const ESTABLISHED_ENOUGH_TO_ASK = 4;

/**
 * Above this share of shared memories, two labels are already handled.
 *
 * buildEntities() merges threads that overlap this much, so a pair still
 * distinct at this level is one it deliberately left alone.
 */
const ALREADY_MERGED_ABOVE = 0.8;

/**
 * Appearing together this often is evidence they are different.
 *
 * If two labels are tagged on the same photograph again and again, somebody
 * is describing two things in one picture. Not conclusive — a family might
 * tag both names on a photograph of one person — so it lowers the ranking
 * rather than removing the pair.
 */
const TOGETHER_OFTEN = 0.5;

/** Which kinds are worth resolving, best first. */
const WORTH_RESOLVING: EntityKind[] = ["person", "place", "thing", "ritual"];

export interface Pair {
  /** Entity ids, always in a stable order so a pair has one identity. */
  a: string;
  b: string;
  kind: EntityKind;
  /**
   * As the family wrote them, more-used name first.
   *
   * Ordered by how often each is mentioned rather than by id, because the
   * name a family reaches for most is the one they will recognise at the
   * start of a sentence — and because ordering by id is arbitrary from the
   * only point of view that matters, the reader's.
   */
  labelA: string;
  labelB: string;
  /** Carried with the labels so a caller cannot pair them up wrongly. */
  countA: number;
  countB: number;
  /** Higher first. */
  weight: number;
  /** Memories that mention both. Shown when asking, as the evidence. */
  sharedMemoryIds: string[];
}

/** One identity for a pair, whichever order it arrives in. */
export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

export interface AskInput {
  entities: Entity[];
  /**
   * Pairs the family has already ruled on, either way. Keys from pairKey().
   * A pair in here is never proposed again — see the first rule above.
   */
  settled?: string[];
}

const datedMemoryIds = (e: Entity) => new Set(e.mentions.map((m) => m.memoryId));

/** Words worth comparing. "the", "my" and the like carry no identity. */
const IGNORED = new Set(["the", "a", "my", "our", "her", "his", "their", "of", "and"]);

function tokens(label: string): Set<string> {
  return new Set(
    label
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((w) => w.length > 1 && !IGNORED.has(w))
  );
}

/**
 * The identity-bearing half of an entity id.
 *
 * Ids are `kind:key`, and the key is what the family typed as the *name* —
 * Margaret, Tom, Maggie. The label is often a nickname the child uses, so
 * comparing labels compares "Grandma" with "Grandpa", which share five
 * letters and nothing else. The key is the thing worth comparing.
 */
const keyOf = (id: string) => (id.includes(":") ? id.slice(id.indexOf(":") + 1) : id);

/** Letters two names begin with in common. */
function sharedPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * How much two names look like the same name.
 *
 * Two signals, and the second was added after watching the product ask
 * whether Grandpa and Nanna were the same person. A shared word — "Grandma
 * Sue" and "Grandma" — is the obvious one. A shared beginning is the other:
 * Margaret and Maggie have no word in common and are obviously worth asking
 * about, and no amount of tokenising finds that.
 *
 * Zero means the two names have nothing to do with each other, which is
 * different from "we are not sure" — see the gate in pairsWorthAsking.
 */
function nameOverlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;

  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  const byWord = shared / Math.min(ta.size, tb.size);

  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  const prefix = sharedPrefix(la, lb);
  // Three letters, and a real share of the shorter name. Two is every second
  // pair of names in English.
  const byPrefix = prefix >= 3 ? prefix / Math.min(la.length, lb.length) : 0;

  return Math.max(byWord, byPrefix);
}

/**
 * The pairs worth asking about, best first.
 *
 * Returns as many as it finds; the caller takes one. Ordering, not
 * filtering, is where the judgement lives — a caller that wants three has a
 * different problem than this module should be solving.
 */
export function pairsWorthAsking(input: AskInput): Pair[] {
  const settled = new Set(input.settled ?? []);
  const established = input.entities.filter(
    (e) => e.mentions.length >= ESTABLISHED_ENOUGH_TO_ASK && WORTH_RESOLVING.includes(e.kind)
  );

  const out: Pair[] = [];

  for (let i = 0; i < established.length; i++) {
    for (let j = i + 1; j < established.length; j++) {
      const a = established[i];
      const b = established[j];
      if (a.kind !== b.kind) continue;
      if (settled.has(pairKey(a.id, b.id))) continue;

      const ma = datedMemoryIds(a);
      const mb = datedMemoryIds(b);
      const shared = [...ma].filter((id) => mb.has(id));
      const overlap = shared.length / Math.min(ma.size, mb.size);
      if (overlap >= ALREADY_MERGED_ABOVE) continue; // buildEntities has this

      // Compared on the key rather than the label: see keyOf().
      const name = nameOverlap(keyOf(a.id), keyOf(b.id));

      // The gate, and the thing that keeps this from being absurd. An
      // archive with twelve people has sixty-six pairs, and asking about all
      // of them is not thoroughness — it is a product with no idea, spending
      // the family's attention to find out what it could not have guessed.
      //
      // So a pair has to be *connected* by something: two names that look
      // alike, or a photograph carrying both. Two names with nothing in
      // common are two people until somebody says otherwise, and that is the
      // right default — the cost of not asking is a graph that stays split,
      // and the cost of asking is the family concluding nobody is home.
      if (name === 0 && shared.length === 0) continue;

      // Kind first — a grandmother resolved is worth more than a toy — then
      // how likely the answer is to be yes, then how much of the archive it
      // would tidy up.
      let weight = (WORTH_RESOLVING.length - WORTH_RESOLVING.indexOf(a.kind)) * 100;
      weight += name * 60;
      weight += Math.min(ma.size + mb.size, 40);
      if (overlap >= TOGETHER_OFTEN) weight -= 120;

      // Identity is by sorted id, so a pair is one pair however it arrives.
      // Presentation is by mention count, which is a different question.
      const [first, second] =
        b.mentions.length > a.mentions.length ? [b, a] : [a, b];

      out.push({
        a: a.id < b.id ? a.id : b.id,
        b: a.id < b.id ? b.id : a.id,
        kind: a.kind,
        labelA: first.label,
        labelB: second.label,
        countA: first.mentions.length,
        countB: second.mentions.length,
        weight,
        sharedMemoryIds: shared,
      });
    }
  }

  return out.sort((x, y) => y.weight - x.weight);
}

/**
 * The single question to ask, or none.
 *
 * None is a normal answer and the common one. An archive whose people are
 * all resolved should never see this again.
 */
export function oneToAsk(input: AskInput): Pair | null {
  return pairsWorthAsking(input)[0] ?? null;
}

const A_OR_AN = (kind: EntityKind) => (kind === "person" ? "the same person" : "the same thing");

/**
 * The question, in words.
 *
 * States what it noticed and asks. It does not say "we think these might be
 * the same", because we do not think that — we have no idea, which is the
 * honest reason for asking and a better sentence than a hedge.
 */
export function askAbout(pair: Pair): string {
  const place = pair.kind === "place" ? "the same place" : A_OR_AN(pair.kind);
  return (
    `You've mentioned ${pair.labelA} ${pair.countA} times and ${pair.labelB} ` +
    `${pair.countB} times. Are they ${place}?`
  );
}
