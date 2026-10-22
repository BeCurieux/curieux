import { CONTACT, COUNTRIES, OPPORTUNITIES, TECH, UNIT, type Opportunity } from "./data";
import type { Answers } from "./questions";

// The Fit Finder, ported 1:1 from the Income Fit Test v1.4 report (which
// itself ports the workbook's Options sheet, columns AF–AZ). Every rule,
// threshold and sentence below is the shipped one; only the output is
// structured data instead of HTML. tests/unit/fit.test.ts runs the original
// JavaScript (tests/fixtures/fit-reference.cjs) beside this port on
// thousands of answer sets and requires identical results.
//
// One addition, at the founder's request (October 2026): the two answers
// v1.4 asked but never used, products vs services (`psa`) and recurring vs
// one-off (`rp`), now break ties. They never change a score, a band or a
// filter; they only reorder ideas whose fit (total + priority) is equal,
// ahead of the shipped commercial-evidence tie-breaker.

export interface Scored {
  o: Opportunity;
  why: string[];
  life: number;
  ready: number;
  comm: number;
  total: number;
  AW: number;
  key: number;
  /** How many of her stated preferences (products/services, recurring/one-off) it matches, 0–2. */
  pref: number;
  band: "Filtered out" | "Strong fit" | "Good fit" | "Possible with changes" | "Weak fit";
  filtered: boolean;
  strengths: string[];
  weak: string[];
  /** Start-up estimate in her currency, rounded to 10 (EST). */
  cap: number;
  sym: string;
}

type ScoringAnswers = Pick<
  Answers,
  | "country"
  | "hours"
  | "block"
  | "evenings"
  | "priority"
  | "soon"
  | "budget"
  | "car"
  | "space"
  | "checks"
  | "contact"
  | "tech"
  | "skill1"
  | "skill2"
  | "remote"
  | "camera"
> &
  Partial<Pick<Answers, "psa" | "rp">>;

const PSA_MATCH: Record<string, string> = { Products: "Product", Services: "Service" };

/** 1 for each stated preference the idea matches; "Either" (or no answer) matches nothing. */
export function preference(o: Opportunity, a: Partial<Pick<Answers, "psa" | "rp">>): number {
  const psa = a.psa && PSA_MATCH[a.psa] === o.psa ? 1 : 0;
  const rp = a.rp && a.rp !== "Either" && a.rp === o.rp ? 1 : 0;
  return psa + rp;
}

export function country(name: string) {
  return COUNTRIES.find((c) => c[0] === name) ?? COUNTRIES[0];
}

export function scoreAll(a: ScoringAnswers, opts: Opportunity[] = OPPORTUNITIES): Scored[] {
  const c = country(a.country);
  const fx = c[2];
  const hrs = +a.hours;
  const blk = +a.block;
  const bud = +a.budget;
  const CN = (CONTACT as readonly string[]).indexOf(a.contact);
  const TN = (TECH as readonly string[]).indexOf(a.tech) + 1;
  return opts.map((o) => {
    const why: string[] = [];
    if (o.minh > hrs + 2) why.push(`needs about ${o.minh} hours a week and you have ${hrs}`);
    if (o.eve === "Partly" && a.evenings === "No") why.push("relies on evenings or weekends");
    if (o.cap * fx > bud) why.push("start-up above your budget");
    if (o.car === "Yes" && a.car === "No") why.push("needs a car");
    if (o.space === "Yes" && a.space === "No") why.push("needs space you don't have");
    if (o.checks === "Yes" && a.checks === "No") why.push("needs checks or registration");
    if (o.contact > CN + 1) why.push("needs more customer contact than you want");
    if (a.soon === "Yes" && o.weeks > 8) why.push("first income likely beyond 8 weeks");
    if (a.remote === "Yes" && o.remote === "No") why.push("needs in-person work");
    if (a.camera === "No" && o.camera === "Yes") why.push("needs you on camera");
    const AG = o.minh <= hrs ? 3 : o.minh <= hrs + 2 ? 1 : 0;
    const AH = o.block <= blk ? 3 : o.block <= blk + 1 ? 1 : 0;
    const AI = o.eve === "No" ? 3 : a.evenings === "Yes" ? 2 : 0;
    const AJ = o.contact <= CN ? 3 : o.contact === CN + 1 ? 1 : 0;
    const life = AG + AH + AI + AJ;
    const AL =
      a.skill1 === o.tag1 || a.skill1 === o.tag2
        ? 3
        : a.skill2 && (a.skill2 === o.tag1 || a.skill2 === o.tag2)
          ? 2
          : o.skill === 1
            ? 2
            : 0;
    const AM =
      bud === 0 ? (o.cap === 0 ? 3 : 0) : o.cap * fx <= bud / 2 ? 3 : o.cap * fx <= bud ? 2 : 0;
    const AN = o.tech <= TN ? 3 : o.tech === TN + 1 ? 1 : 0;
    const ready = 2 * AL + AM + AN;
    const AT =
      a.soon === "Yes"
        ? o.weeks <= 2
          ? 3
          : o.weeks <= 4
            ? 2
            : o.weeks <= 8
              ? 1
              : 0
        : o.weeks <= 4
          ? 3
          : o.weeks <= 8
            ? 2
            : o.weeks <= 16
              ? 1
              : 0;
    const comm = o.demand + o.lev + o.comp + AT;
    const total = life + ready + comm;
    const AW =
      a.priority === "Money soon"
        ? AT
        : a.priority === "Flexibility"
          ? AH
          : a.priority === "Building something over time"
            ? o.lev
            : 0;
    const filtered = why.length > 0;
    const key = filtered ? -1 : total + AW + comm / 100 + (99 - o.id) / 100000;
    const band: Scored["band"] = filtered
      ? "Filtered out"
      : total >= 27
        ? "Strong fit"
        : total >= 21
          ? "Good fit"
          : total >= 15
            ? "Possible with changes"
            : "Weak fit";
    const crit: [number, string][] = [
      [AG, "fits your weekly hours"],
      [AH, "fits your work blocks"],
      [AI, "no evenings needed"],
      [AJ, "matches your contact style"],
      [AL, "uses your skills"],
      [AM, "well inside your budget"],
      [AN, "comfortable tech load"],
      [o.demand, "strong demand evidence"],
      [o.lev, "income not capped by the hour"],
      [o.comp, "room in the market"],
      [AT, "quick to first income for your need"],
    ];
    const weakNames: [number, string][] = [
      [AG, "your weekly hours"],
      [AH, "your block length"],
      [AI, "evenings needed"],
      [AJ, "customer contact style"],
      [AL, "skills match"],
      [AM, "budget stretch"],
      [AN, "tech load"],
      [o.demand, "weak demand evidence"],
      [o.lev, "income capped by the hour"],
      [o.comp, "crowded market"],
      [AT, "slow to first income"],
    ];
    return {
      o,
      why,
      life,
      ready,
      comm,
      total,
      AW,
      key,
      pref: preference(o, a),
      band,
      filtered,
      strengths: crit.filter((x) => x[0] === 3).map((x) => x[1]),
      weak: weakNames.filter((x) => x[0] <= 1).map((x) => x[1]),
      cap: Math.round((o.cap * fx) / 10) * 10,
      sym: c[1],
    };
  });
}

export function top3(scored: Scored[]): Scored[] {
  return scored
    .filter((s) => !s.filtered && s.total >= 15)
    .sort(byFit)
    .slice(0, 3);
}

/**
 * Best first: fit (total + priority, the whole part of `key`), then her
 * stated preferences, then the shipped tie-breakers (commercial evidence,
 * then catalogue order) carried in the fraction of `key`.
 */
export function byFit(x: Scored, y: Scored): number {
  return Math.floor(y.key) - Math.floor(x.key) || y.pref - x.pref || y.key - x.key;
}

export const money = (sym: string, v: number) => sym + Math.round(v).toLocaleString("en");

export function whyFits(s: Scored, a: Answers): string[] {
  const o = s.o;
  const out: string[] = [];
  const hrs = +a.hours;
  const blk = +a.block;
  if (o.minh <= hrs) out.push(`It needs about ${o.minh} hours a week, and you have ${hrs}.`);
  if (o.block <= blk)
    out.push(
      o.block === 1
        ? "It can be done in short stretches of about an hour, which suits your week."
        : `It works in ${o.block}-hour blocks, and you can get ${blk}.`,
    );
  if (o.eve === "No" && a.evenings === "No") out.push("It doesn't rely on evenings or weekends.");
  const CN = (CONTACT as readonly string[]).indexOf(a.contact);
  if (o.contact <= CN)
    out.push(
      `The customer contact it needs (${CONTACT[o.contact]!.toLowerCase()}) is within what suits you.`,
    );
  if (a.skill1 === o.tag1 || a.skill1 === o.tag2)
    out.push(`It uses your main skill area: ${a.skill1.toLowerCase()}.`);
  else if (a.skill2 && (a.skill2 === o.tag1 || a.skill2 === o.tag2))
    out.push(`It uses your second skill area: ${a.skill2.toLowerCase()}.`);
  if (s.cap <= +a.budget)
    out.push(
      s.cap === 0
        ? "You can start it for nothing."
        : `Start-up is about ${s.sym}${s.cap.toLocaleString("en")} (EST), inside your ${s.sym}${(+a.budget).toLocaleString("en")} budget.`,
    );
  if (a.camera === "No" && o.camera === "No") out.push("It doesn't need you on camera.");
  if (a.soon === "Yes" && o.weeks <= 8)
    out.push(
      `A first income is often possible within about ${o.weeks} week${o.weeks > 1 ? "s" : ""} (EST), and you said you need money within 8.`,
    );
  if (a.priority === "Building something over time" && o.lev >= 2)
    out.push("Income isn't capped by your hours forever, which matters for building over time.");
  if (o.demand === 3) out.push("Our research found strong evidence that customers pay for it.");
  return out.slice(0, 6);
}

export function risks(s: Scored, a: Answers): string[] {
  const o = s.o;
  const out: string[] = [];
  const hrs = +a.hours;
  const blk = +a.block;
  if (o.minh > hrs)
    out.push(
      `It usually needs about ${o.minh} hours a week; you have ${hrs}, so expect it to be tight.`,
    );
  if (o.block > blk)
    out.push(
      `It works best in ${o.block}-hour blocks; your stretches are shorter, so progress may feel slow.`,
    );
  if (o.eve === "Partly") out.push("Some demand falls in evenings or weekends.");
  if (s.cap > +a.budget / 2 && s.cap > 0)
    out.push(
      `Start-up (about ${s.sym}${s.cap.toLocaleString("en")}, EST) takes more than half your budget.`,
    );
  if (o.pitch === 1) out.push("It doesn't sell itself: you'll need to pitch to people directly.");
  if (o.comp === 1) out.push("It's a crowded market, so you'll need a narrow angle.");
  if (a.soon === "Yes" && o.weeks > 4)
    out.push(
      `First income can take around ${o.weeks} weeks (EST), which is longer than you'd like.`,
    );
  out.push("Main reason it fails: " + o.poor);
  return out.slice(0, 5);
}

export interface PlanDay {
  /** Day number; day 1 covers days 1–3 (done by taking the quiz). */
  d: number;
  t: string;
  txt: string;
  /** A milestone day. */
  ms: boolean;
}

/** The report's dated 14-day test, for her #1 idea. */
export function plan(s: Scored, a: Answers): PlanDay[] {
  const o = s.o;
  const product = o.psa === "Product";
  const sym = country(a.country)[1];
  const rows: [number, string, string, number][] = [
    [
      1,
      "Read your report and commit",
      `You've done Days 1-3 of the 14-day plan by answering these questions. Today: re-read your three, then commit to ${o.name} for the next 13 days. Not forever, just this test.`,
      1,
    ],
    [
      4,
      "Describe your customer",
      `Write one sentence: who pays, what triggers them, and where they look today. Start from our research: ${o.who}`,
      0,
    ],
    [
      5,
      "Check competitors and prices",
      "Search the way your customer would and note 3-6 providers, their prices and what they all say about themselves. Your price range to test comes from here.",
      0,
    ],
    [
      6,
      "Put real numbers in your calculator",
      `Fill in the calculator in this report with your price and hours. If the return at 50% busy is below your ${money(sym, +a.minrate)}/hr floor, change the price now, not on Day 14.`,
      0,
    ],
    [
      7,
      "Write your one-line offer",
      "Who it's for, what they get, the price. Say it aloud; if you wouldn't say it to a neighbour, simplify it.",
      0,
    ],
    [
      8,
      "Make one honest sample",
      product
        ? "Make or mock up one item and photograph it in daylight. It's your Day 12 image."
        : "Make one sample or before-and-after that proves you can do the work, and say plainly that you're new.",
      0,
    ],
    [
      9,
      "List who you'll talk to",
      `List 10-20 real people or businesses. Where to find them: ${o.reach} Message people one at a time, follow group rules, and never use bought lists.`,
      0,
    ],
    [
      10,
      "Run your first test",
      `${o.test} Aim for five or more real conversations by Day 12. Count conversations, not messages sent.`,
      1,
    ],
    [
      11,
      "Collect objections",
      "Write down the top three objections in people's own words. Change one thing (price, wording or customer) only if the notes justify it.",
      0,
    ],
    [
      12,
      "Ask for a commitment",
      product
        ? "Put a real listing or pre-order in front of the people who showed interest. Record every view, reply and order."
        : "Offer a real booking or a firm, dated 'yes'. A deposit or a dated yes counts as a commitment.",
      0,
    ],
    [
      13,
      "Count everything",
      "Reached, real conversations, asked about price, committed, paid, money in, money out, hours spent. Put the real numbers into your calculator.",
      0,
    ],
    [
      14,
      "Decide: go, adjust or stop",
      "Check your numbers against your decision rules below and write your verdict and the next experiment.",
      1,
    ],
  ];
  return rows.map(([d, t, txt, ms]) => ({ d, t, txt, ms: ms === 1 }));
}

export interface CalcInputs {
  price: number;
  hrs: number;
  cost: number;
  fixed: number;
  start: number;
}

export interface CalcResult {
  margin: number;
  /** Units to win back the start-up; null when each unit loses money. */
  breakEven: number | null;
  capacity: number;
  scenarios: { f: number; n: number; p: number; h: number }[];
  signal: "loss" | "ok" | "only-full" | "below";
  message: string;
}

/** The report's calculator. Null until price and hours are entered — a made-up price would be a made-up result. */
export function calculate(s: Scored, a: Answers, c: CalcInputs): CalcResult | null {
  return calcCore(c, +a.hours, +a.minrate, UNIT[s.o.id] ?? "sale", country(a.country)[1]);
}

/** The calculator maths on its own, so the browser widget uses the same code. */
export function calcCore(
  c: Partial<CalcInputs>,
  H: number,
  floor: number,
  u: string,
  sym: string,
): CalcResult | null {
  const price = +(c.price ?? 0);
  const hrs = +(c.hrs ?? 0);
  const cost = +(c.cost ?? 0) || 0;
  const fixed = +(c.fixed ?? 0) || 0;
  const start = +(c.start ?? 0) || 0;
  const mH = (H * 52) / 12;
  if (!price || !hrs) return null;
  const margin = price - cost;
  const cap = mH / hrs;
  const scenarios = [0.25, 0.5, 1].map((f) => {
    const n = Math.floor(cap * f);
    const p = n * margin - fixed;
    return { f, n, p, h: p / mH };
  });
  const breakEven = margin > 0 ? Math.ceil(start / margin) : null;
  const mid = scenarios[1]!;
  const full = scenarios[2]!;
  const m = (v: number) => money(sym, v);
  const base = { margin, breakEven, capacity: Math.floor(cap), scenarios };
  if (margin <= 0)
    return {
      ...base,
      signal: "loss",
      message: `Each ${u} costs more than it earns at this price. Change the price or the costs before anything else.`,
    };
  if (mid.h >= floor)
    return {
      ...base,
      signal: "ok",
      message: `At half your hours booked, this returns about ${m(mid.h)} an hour, at or above your ${m(floor)} floor. Worth testing.`,
    };
  if (full.h >= floor)
    return {
      ...base,
      signal: "only-full",
      message: `You only reach your ${m(floor)}/hr floor if nearly all your hours are paid work, which is rare early on. Test a higher price, or count this as a Day 14 warning sign.`,
    };
  return {
    ...base,
    signal: "below",
    message: `Even fully booked, this returns about ${m(full.h)} an hour, below your ${m(floor)} floor. Raise the price, cut the hours per ${u}, or treat it as a stop signal.`,
  };
}

/** The Day 14 decision lines, set now so day-14 her can't move them. */
export function gates(s: Scored, a: Answers) {
  const product = s.o.psa === "Product";
  const floor = money(country(a.country)[1], +a.minrate);
  return {
    go: [
      "5+ real conversations with people who fit your customer type",
      product
        ? "1+ order or pre-order, and 1+ person asked about price"
        : "2+ people asked about price or booking unprompted, and 1+ firm, dated yes or deposit",
      `Your calculator, with real numbers, shows ${floor}/hr or more at 50% busy`,
    ],
    adjust: [
      "Demand is there but a number is off (price, hours or costs)",
      "Or there's interest without commitments yet",
      "Change one thing (price, offer, customer or channel) and repeat Days 9-12. Two adjust rounds with no commitment means stop.",
    ],
    stop: [
      "5+ real conversations and nobody asked about price",
      "Or you don't want another 14 days of this",
      "Go to your back-up below. You found out for the price of this kit and two weeks.",
    ],
    note: "Fewer than 5 real conversations isn't a no; it's not enough evidence yet. Try a different place to find people and repeat Days 9-12.",
  };
}
