// The annual film.
//
// A year of photographs, in order, held long enough to look at, with the
// family's own words between them. Forty-five to seventy-five seconds.
//
// This module decides the *edit* and nothing else: which frames, in what
// order, on screen for how long. That is the part worth arguing about and
// the part that has to be right whatever plays it — a browser today, an
// encoded file later, both running the same cut.
//
// ## Three decisions, each of which could have gone the other way
//
//   **Chronological, always.** The temptation is to lead with the best
//   photograph. But the thing a family cannot get anywhere else is the
//   *shape* of a year — small in January, walking by August — and the only
//   way to show that is in order. A highlight reel is what a phone already
//   makes.
//
//   **Their words, or none.** Cards carry sentences somebody in the family
//   typed. There is no narration, no generated linking prose, no "and then
//   summer came". A film about a real child assembled from invented
//   sentences is the worst version of everything this product refuses.
//
//   **No music.** Not an omission. Every stock track that would fit is the
//   same piano, and a family's own photographs under library music is
//   precisely the cheap thing the brief says not to make — it turns
//   somebody's year into an advertisement for itself. Silence is also the
//   only option that is honestly licensable, plays in a browser tab that is
//   muted by default, and does not need a rights negotiation before the
//   product can ship. If music arrives later it should be a choice the
//   family makes, not a default we impose on their year.

/** Below this there is no film, only some photographs. */
export const ENOUGH_FOR_A_FILM = 12;

/** How long the whole thing should run. */
export const TARGET_MS = 60_000;
export const SHORTEST_MS = 30_000;
export const LONGEST_MS = 90_000;

/** How long a single photograph stays up. */
export const HOLD_MS = 2_400;
/** The first and last get a beat longer. */
export const EDGE_HOLD_MS = 3_200;
/** Long enough to read a short sentence without hurrying. */
export const CARD_MS = 3_600;
export const TITLE_MS = 3_000;

/**
 * At most this many word-cards.
 *
 * A film that is half text is a slideshow of captions. Five is enough to
 * carry a year and few enough that each one lands.
 */
export const MOST_CARDS = 5;

export interface Moment {
  /** Memory id — what the player resolves to a photograph. */
  id: string;
  /** ISO date. Everything is cut in this order. */
  date: string;
  /** Whether a photograph exists for it. */
  hasPhoto: boolean;
  /** What the family wrote, if anything. */
  text: string | null;
}

export type Frame =
  | { kind: "title"; ms: number; text: string; sub: string }
  | { kind: "photo"; ms: number; id: string; date: string }
  | { kind: "card"; ms: number; text: string }
  | { kind: "end"; ms: number; text: string; sub: string };

export interface Cut {
  frames: Frame[];
  totalMs: number;
  /** How many photographs the year actually had, before any trimming. */
  fromPhotos: number;
}

export interface CutInput {
  /** The child, as the family says it. */
  name: string;
  moments: Moment[];
}

/**
 * Cut the film, or return null.
 *
 * Null is the common answer for a thin year and is not a failure. A
 * thirty-second film of nine photographs is worse than no film, because it
 * tells a family their year did not amount to much.
 */
export function cutFilm(input: CutInput): Cut | null {
  const all = [...input.moments]
    .filter((m) => /^\d{4}-\d{2}-\d{2}/.test(m.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Which twelve months. Not the last twelve, and not the book's
  // birthday-to-birthday year — the twelve with the most photographs in
  // them.
  //
  // "The most recent year" is the obvious rule and it is brittle: one
  // photograph with a wrong date drags the whole window off the material,
  // and an archive that has been imported in bulk often has a sparse tail.
  // Density is the thing being looked for anyway. A film is only worth
  // making about a stretch that has enough in it.
  const year = densestYear(all);
  if (!year) return null;

  const inOrder = all.filter((m) => m.date >= year.start && m.date <= year.end);
  const photos = inOrder.filter((m) => m.hasPhoto);
  if (photos.length < ENOUGH_FOR_A_FILM) return null;

  // How many photographs fit. Work back from the runtime rather than
  // choosing a count and hoping: the film is a length, and the number of
  // frames is what falls out of it.
  const spokenFor = TITLE_MS + CARD_MS * MOST_CARDS + TIME_AT_THE_END;
  const room = Math.max(0, TARGET_MS - spokenFor);
  const fit = Math.max(ENOUGH_FOR_A_FILM, Math.floor(room / HOLD_MS));
  const chosen = evenly(photos, fit);

  // The words. Taken from moments the family wrote something on, spread
  // across the year rather than clustered — six sentences from one week is
  // a week, not a year.
  const said = evenly(
    inOrder.filter((m) => (m.text ?? "").trim().length > 0 && fitsOnACard(m.text!)),
    MOST_CARDS
  );

  const frames: Frame[] = [
    {
      kind: "title",
      ms: TITLE_MS,
      text: input.name,
      // The dates, not an age. The film covers the twelve months the archive
      // actually has, which is not the same span as the book's birthday-to-
      // birthday year — so claiming an age here would be claiming something
      // the window does not support.
      sub: monthRange(chosen[0].date, chosen[chosen.length - 1].date),
    },
  ];

  // Interleave: a card goes in front of the first photograph taken on or
  // after the day it was written, so the words arrive with the part of the
  // year they belong to rather than in a block at the end.
  const pending = [...said];
  chosen.forEach((photo, i) => {
    while (pending.length && pending[0].date <= photo.date) {
      const card = pending.shift()!;
      frames.push({ kind: "card", ms: CARD_MS, text: card.text!.trim() });
    }
    frames.push({
      kind: "photo",
      ms: i === 0 || i === chosen.length - 1 ? EDGE_HOLD_MS : HOLD_MS,
      id: photo.id,
      date: photo.date,
    });
  });
  // Anything written after the last photograph still belongs in the year.
  for (const card of pending) {
    frames.push({ kind: "card", ms: CARD_MS, text: card.text!.trim() });
  }

  frames.push({
    kind: "end",
    ms: TIME_AT_THE_END,
    text: input.name,
    // The span, counted. Nothing about what any of it meant.
    sub: `${chosen.length} of ${photos.length} photographs`,
  });

  const totalMs = frames.reduce((n, f) => n + f.ms, 0);
  return { frames, totalMs, fromPhotos: photos.length };
}

const TIME_AT_THE_END = 3_500;

/** Days in the window. A year, give or take a leap. */
const A_YEAR = 365;

/**
 * The twelve months with the most photographs in them.
 *
 * A sliding window over the dated photographs. Every photograph is tried as
 * a start, which is O(n²) in the worst case and irrelevant in practice —
 * this runs over one family's archive, and the alternative is a rule that
 * picks the wrong year whenever somebody's camera stamped 2035.
 */
export function densestYear(moments: Moment[]): { start: string; end: string } | null {
  const dated = moments.filter((m) => m.hasPhoto).map((m) => m.date).sort();
  if (dated.length === 0) return null;

  const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  let best = { start: dated[0], end: dated[0], count: 0 };

  for (let i = 0; i < dated.length; i++) {
    const end = new Date(dayMs(dated[i]) + A_YEAR * 86_400_000).toISOString().slice(0, 10);
    let count = 0;
    for (let j = i; j < dated.length && dated[j] <= end; j++) count++;
    // Strictly greater, so the earliest of two equally full years wins —
    // a tie should not silently prefer the more recent one.
    if (count > best.count) best = { start: dated[i], end, count };
  }
  return { start: best.start, end: best.end };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "August 2025 to August 2026", or just the month when it is one. */
function monthRange(from: string, to: string): string {
  const a = new Date(`${from.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${to.slice(0, 10)}T00:00:00Z`);
  const say = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return say(a) === say(b) ? say(a) : `${say(a)} to ${say(b)}`;
}

/**
 * Will this sit on a card without being squinted at?
 *
 * A paragraph is a thing to read in the archive, not on screen for three
 * and a half seconds. Long entries stay where they are and the film uses
 * the short ones.
 */
export const CARD_FITS = 90;
export const fitsOnACard = (text: string) => text.trim().length <= CARD_FITS;

/**
 * n items spread across a list rather than the first n.
 *
 * The same reasoning as the story sequence: the first twelve photographs of
 * a year are twelve photographs of January. First and last are always kept,
 * because a year has to start where it started and end where it ended.
 */
export function evenly<T>(items: T[], n: number): T[] {
  if (items.length <= n) return [...items];
  if (n <= 1) return items.length ? [items[0]] : [];
  const step = (items.length - 1) / (n - 1);
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[Math.round(i * step)]);
  return out;
}
