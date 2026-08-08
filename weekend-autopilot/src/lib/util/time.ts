/**
 * Timezone-aware weekend arithmetic.
 *
 * Everything scheduled in this product is anchored to a market's local time,
 * never the server's. "Thursday 7:30am" means 7:30am in Sydney, including
 * across daylight-saving transitions, and the upcoming weekend on a Wednesday
 * night in Sydney is not the same weekend as on a Wednesday night in London.
 *
 * Implemented on Intl rather than a date library: the only operations we need
 * are "what is the local wall clock for this instant" and "what instant is
 * this local wall clock", and getting those right is worth 60 lines.
 */

import type { Market, Weekday } from "@/config/markets";

/** A local date/time in a specific zone, decomposed. */
export interface LocalParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday; // 1 = Monday … 7 = Sunday
}

const PART_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  let f = PART_FORMATTERS.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    });
    PART_FORMATTERS.set(timezone, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, Weekday> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function localParts(instant: Date, timezone: string): LocalParts {
  const parts = formatter(timezone).formatToParts(instant);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = WEEKDAY_INDEX[get("weekday")];
  if (!weekday) throw new Error(`Could not resolve weekday in ${timezone}`);

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // Intl renders midnight as "24" in some locales under hour12: false.
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday,
  };
}

/** ISO date string (YYYY-MM-DD) for an instant, in a market's zone. */
export function localDateString(instant: Date, timezone: string): string {
  const p = localParts(instant, timezone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/**
 * The UTC instant corresponding to a local wall-clock time in a zone.
 *
 * Solved by iteration: guess that the local time is UTC, measure how far the
 * zone's rendering of that guess is from the target, and correct. Two passes
 * converge for every real-world offset, including the 45-minute ones.
 */
export function instantFromLocal(
  date: string,
  time: string,
  timezone: string
): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined) {
    throw new Error(`Invalid local datetime: ${date} ${time}`);
  }

  const targetUtcMs = Date.UTC(y, m - 1, d, hh, mm);
  let guess = new Date(targetUtcMs);

  for (let i = 0; i < 3; i++) {
    const p = localParts(guess, timezone);
    const renderedMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const driftMs = renderedMs - targetUtcMs;
    if (driftMs === 0) break;
    guess = new Date(guess.getTime() - driftMs);
  }

  return guess;
}

/** Add days to an ISO date string without touching timezones. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function isoWeekday(isoDate: string): Weekday {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return (dow === 0 ? 7 : dow) as Weekday;
}

/**
 * The Saturday of the weekend we are currently planning for, in market-local
 * terms. A weekend "belongs" to the planner from Monday until it happens; once
 * Sunday evening arrives we move on to the next one.
 *
 * Monday–Saturday → the Saturday of this week.
 * Sunday          → today, until the feedback hour, then next Saturday.
 */
export function upcomingWeekendDate(market: Market, now: Date = new Date()): string {
  const p = localParts(now, market.timezone);
  const today = `${p.year}-${pad(p.month)}-${pad(p.day)}`;

  if (p.weekday === 7) {
    const [fh, fm] = market.feedback_time.split(":").map(Number);
    const pastFeedbackHour =
      p.hour > (fh ?? 0) || (p.hour === (fh ?? 0) && p.minute >= (fm ?? 0));
    // Sunday: the weekend in progress is yesterday's Saturday until the
    // feedback hour, after which the next weekend is the live one.
    return pastFeedbackHour ? addDays(today, 6) : addDays(today, -1);
  }

  return addDays(today, 6 - p.weekday);
}

/** The Sunday paired with a given Saturday. */
export function sundayFor(saturdayIsoDate: string): string {
  return addDays(saturdayIsoDate, 1);
}

/** Instant at which a market's plans for `weekendDate` should be generated. */
export function generationInstant(market: Market, weekendDate: string): Date {
  const daysBefore = market.generation_day - 6; // negative: before Saturday
  return instantFromLocal(
    addDays(weekendDate, daysBefore),
    market.generation_time,
    market.timezone
  );
}

/** Instant at which a market's plans for `weekendDate` should be delivered. */
export function deliveryInstant(market: Market, weekendDate: string): Date {
  const daysBefore = market.delivery_day - 6;
  return instantFromLocal(
    addDays(weekendDate, daysBefore),
    market.delivery_time,
    market.timezone
  );
}

/** Instant at which we ask "did you do it?". */
export function feedbackInstant(market: Market, weekendDate: string): Date {
  const offset = market.feedback_day - 6;
  return instantFromLocal(
    addDays(weekendDate, offset),
    market.feedback_time,
    market.timezone
  );
}

// ------------------------------------------------------------- clock helpers

/** "HH:MM" → minutes since local midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Minutes since local midnight → "HH:MM". */
export function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

export function addMinutes(time: string, minutes: number): string {
  return fromMinutes(toMinutes(time) + minutes);
}

/**
 * Human clock for plan timelines: "9:20", "1:00". No am/pm — a weekend plan
 * reads as a sequence, and the sequence makes the meaning unambiguous.
 */
export function displayTime(time: string): string {
  const total = toMinutes(time);
  const h24 = Math.floor(total / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(total % 60)}`;
}

/** Long-form date for emails and headings: "Saturday 14 June". */
export function displayDate(isoDate: string, locale: string, timezone: string): string {
  const instant = instantFromLocal(isoDate, "12:00", timezone);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  }).format(instant);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
