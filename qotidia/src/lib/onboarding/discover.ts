// What is already in a camera roll, before anybody has typed anything.
//
// The rest of the graph is built from what a family recorded — a tag, a
// name, a confirmed cluster, a little thing. On a first import there is none
// of that. Somebody has dragged in four hundred photographs and told us
// nothing, and the entity engine has literally nothing to read.
//
// So this module reads the only thing that is actually there: **when each
// photograph was taken**. That turns out to be enough for the thing that
// matters on day one, which is not cleverness — it is the parent saying "oh,
// I'd forgotten that day".
//
// ## Why not look at the pictures
//
// Because the product does not, anywhere, and the first session is the worst
// place to start. A model that says "a stuffed rabbit" is guessing about a
// child it has never met, in the five minutes when a family is deciding
// whether to trust us with eighteen years of their life. Arithmetic over
// timestamps cannot be wrong in that way: "twenty-three photographs from one
// Saturday in March" is either true or it is not, and it is checkable by the
// person reading it.
//
// It is also, in practice, the more surprising output. Nobody has forgotten
// what their child looks like. Everybody has forgotten which Saturday.
//
// ## The one thing that can go wrong
//
// Timestamps are not always real. A camera with a flat battery stamps 1980;
// files copied between machines carry the copy date; a whole roll can arrive
// with the same fake time. Every rule below therefore needs *several*
// photographs agreeing before it will say anything, and a discovery is
// suppressed entirely when the evidence looks synthetic — see `looksFake`.

/** One photograph, as far as this module is concerned. */
export interface Shot {
  id: string;
  /** ISO timestamp. Midnight is common and meaningful — see hasClockTimes. */
  at: string;
}

export type Finding =
  /** A lot of photographs on one calendar day. */
  | "a_day"
  /** Something on most days of a stretch. */
  | "a_run"
  /** The same weekday, again and again. */
  | "a_weekday"
  /** A long silence in the middle of an otherwise busy stretch. */
  | "a_gap"
  /** How much time all of this covers. Framing, not a question. */
  | "a_span";

export interface Discovery {
  finding: Finding;
  /** The arithmetic, said out loud. Never a claim about the family. */
  because: string;
  /** What we would ask about it, or null when there is nothing to ask. */
  ask: string | null;
  /** The photographs this was computed from, oldest first. */
  shotIds: string[];
  /** ISO dates, for a caption. */
  from: string;
  to: string;
  weight: number;
}

const DAY = 86_400_000;
const at = (iso: string) => Date.parse(iso);
const dayOf = (iso: string) => iso.slice(0, 10);

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Enough photographs on one day to be a day rather than a moment.
 *
 * Six. Below that it is a couple of snaps of dinner; at six somebody had a
 * camera out for a while, and that is what makes it a story worth asking
 * about.
 */
const A_DAY_NEEDS = 6;

/** Days in a row with something on most of them. */
const A_RUN_NEEDS_DAYS = 5;
const A_RUN_NEEDS_SHARE = 0.6;

/** Same weekday, at least this many times and this much of the total. */
const A_WEEKDAY_NEEDS = 5;
const A_WEEKDAY_SHARE = 0.6;

/** A silence this long, inside a stretch that is otherwise busy. */
const A_GAP_IS_DAYS = 45;

const WEIGHT: Record<Finding, number> = {
  // A single day with a lot in it is the one that produces "oh, that day".
  a_day: 100,
  a_run: 70,
  a_weekday: 60,
  a_gap: 40,
  a_span: 10,
};

const times = (n: number) => `${n} photographs`;

/** "Saturday 14 March" — no year, because the year is in the caption. */
function niceDay(iso: string): string {
  const d = new Date(`${dayOf(iso)}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const niceMonth = (iso: string) => {
  const d = new Date(`${dayOf(iso)}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]}`;
};

/**
 * Do these timestamps carry a real clock, or just dates?
 *
 * EXIF gives a time; a file copied off a card may not, and this product's own
 * takenOn() keeps only the date and writes midnight. If everything is
 * midnight then "one Saturday morning" is a sentence we cannot support, and
 * the wording has to drop back to the day.
 */
export function hasClockTimes(shots: Shot[]): boolean {
  const withTime = shots.filter((s) => !/T00:00(:00)?/.test(s.at));
  return withTime.length >= Math.max(3, shots.length * 0.5);
}

/**
 * Does this look like a camera with a broken clock rather than a life?
 *
 * Two signatures. Everything at exactly the same instant is a batch import
 * that lost its metadata. Everything on one single day, when there are
 * hundreds, is the same. Either way the honest answer is to say nothing
 * rather than to announce a remarkable afternoon that did not happen.
 */
export function looksFake(shots: Shot[]): boolean {
  if (shots.length < 3) return false;
  const distinctInstants = new Set(shots.map((s) => s.at)).size;
  if (distinctInstants === 1) return true;
  const distinctDays = new Set(shots.map((s) => dayOf(s.at))).size;
  return shots.length >= 40 && distinctDays === 1;
}

/**
 * Everything worth saying about a batch, best first.
 *
 * Returns all of them; a caller shows three to five. Zero is a legitimate
 * answer and happens whenever a batch is small or its dates are junk.
 */
export function discoveries(input: Shot[]): Discovery[] {
  const shots = [...input]
    .filter((s) => !Number.isNaN(at(s.at)))
    .sort((a, b) => at(a.at) - at(b.at));
  if (shots.length < A_DAY_NEEDS || looksFake(shots)) return [];

  const out: Discovery[] = [];
  const clock = hasClockTimes(shots);
  const first = shots[0].at;
  const last = shots[shots.length - 1].at;

  // ------------------------------------------------------------- a day
  const byDay = new Map<string, Shot[]>();
  for (const s of shots) {
    const key = dayOf(s.at);
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  const busiest = [...byDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (busiest && busiest[1].length >= A_DAY_NEEDS) {
    const [day, onThatDay] = busiest;
    out.push({
      finding: "a_day",
      because:
        `${times(onThatDay.length)} from ${niceDay(day)}` +
        (clock ? `, over ${hoursSpanned(onThatDay)}.` : "."),
      ask: "What was happening that day?",
      shotIds: onThatDay.map((s) => s.id),
      from: onThatDay[0].at,
      to: onThatDay[onThatDay.length - 1].at,
      // Bounded. An unbounded count lets a forty-day run outrank the one
      // remarkable Saturday purely on volume, which inverts the whole
      // ranking — the base weights are the judgement and the bonus is only
      // a tiebreak within a kind.
      weight: WEIGHT.a_day + Math.min(20, onThatDay.length),
    });
  }

  // ------------------------------------------------------------- a run
  const run = longestRun([...byDay.keys()].sort());
  if (run && run.days >= A_RUN_NEEDS_DAYS && run.share >= A_RUN_NEEDS_SHARE) {
    const inRun = shots.filter(
      (s) => dayOf(s.at) >= run.from && dayOf(s.at) <= run.to
    );
    out.push({
      finding: "a_run",
      because:
        `Something on ${run.withSomething} of ${run.days} days, ` +
        `${niceDay(run.from)} to ${niceDay(run.to)}.`,
      ask: "Was something on, that week?",
      shotIds: inRun.map((s) => s.id),
      from: inRun[0].at,
      to: inRun[inRun.length - 1].at,
      weight: WEIGHT.a_run + Math.min(20, run.days),
    });
  }

  // --------------------------------------------------------- a weekday
  const tally = new Array(7).fill(0);
  for (const day of byDay.keys()) tally[new Date(`${day}T00:00:00Z`).getUTCDay()]++;
  let top = 0;
  for (let i = 1; i < 7; i++) if (tally[i] > tally[top]) top = i;
  const share = tally[top] / byDay.size;
  if (tally[top] >= A_WEEKDAY_NEEDS && share >= A_WEEKDAY_SHARE && spanDays(first, last) >= 60) {
    const onThatDay = shots.filter(
      (s) => new Date(`${dayOf(s.at)}T00:00:00Z`).getUTCDay() === top
    );
    out.push({
      finding: "a_weekday",
      because: `${tally[top]} of these days are a ${DAYS[top]}.`,
      ask: "Was that a regular thing?",
      shotIds: onThatDay.map((s) => s.id),
      from: onThatDay[0].at,
      to: onThatDay[onThatDay.length - 1].at,
      weight: WEIGHT.a_weekday + Math.min(20, tally[top]),
    });
  }

  // ------------------------------------------------------------- a gap
  const gap = longestGap(shots);
  if (gap && gap.days >= A_GAP_IS_DAYS && spanDays(first, last) >= gap.days * 2) {
    out.push({
      finding: "a_gap",
      because: `Nothing between ${niceMonth(gap.from)} and ${niceMonth(gap.to)}.`,
      // Not "why?". A quiet stretch is usually a new baby, an illness, a
      // separation, or simply a phone that was full — and a product that
      // demands an explanation for a silence is a product that has
      // misunderstood what it is looking at.
      ask: "Anything from then worth adding?",
      shotIds: [],
      from: gap.from,
      to: gap.to,
      weight: WEIGHT.a_gap,
    });
  }

  // ------------------------------------------------------------ a span
  const span = spanDays(first, last);
  if (span >= 45) {
    out.push({
      finding: "a_span",
      because:
        `${times(shots.length)} across ${Math.round(span / 30)} months, ` +
        `${niceMonth(first)} to ${niceMonth(last)}.`,
      ask: null,
      shotIds: shots.map((s) => s.id),
      from: first,
      to: last,
      weight: WEIGHT.a_span,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

const spanDays = (from: string, to: string) => Math.round((at(to) - at(from)) / DAY);

function hoursSpanned(shots: Shot[]): string {
  const hours = (at(shots[shots.length - 1].at) - at(shots[0].at)) / 3_600_000;
  if (hours < 1) return "under an hour";
  const n = Math.round(hours);
  return n === 1 ? "an hour" : `${n} hours`;
}

/** The longest stretch of days where most days have something. */
function longestRun(days: string[]): { from: string; to: string; days: number; withSomething: number; share: number } | null {
  if (days.length < A_RUN_NEEDS_DAYS) return null;
  let best: ReturnType<typeof longestRun> = null;

  for (let i = 0; i < days.length; i++) {
    for (let j = i + A_RUN_NEEDS_DAYS - 1; j < days.length; j++) {
      const total = Math.round((at(days[j]) - at(days[i])) / DAY) + 1;
      const withSomething = j - i + 1;
      const share = withSomething / total;
      if (share < A_RUN_NEEDS_SHARE) continue;
      if (!best || total > best.days) {
        best = { from: days[i], to: days[j], days: total, withSomething, share };
      }
    }
  }
  return best;
}

/** The longest silence between two consecutive photographs. */
function longestGap(shots: Shot[]): { from: string; to: string; days: number } | null {
  let best: { from: string; to: string; days: number } | null = null;
  for (let i = 1; i < shots.length; i++) {
    const days = Math.round((at(shots[i].at) - at(shots[i - 1].at)) / DAY);
    if (!best || days > best.days) {
      best = { from: shots[i - 1].at, to: shots[i].at, days };
    }
  }
  return best;
}
