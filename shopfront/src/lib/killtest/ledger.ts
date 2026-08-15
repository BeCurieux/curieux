/**
 * The kill-test ledger, and the verdict it computes.
 *
 * The verdict is the whole file. Everything else is bookkeeping around one
 * question the brief refuses to let anyone answer by feel: did five of thirty
 * actively want their shop live?
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  STAGES,
  THRESHOLD_COUNT,
  THRESHOLD_STAGE,
  TARGET_MERCHANTS,
  type Ledger,
  type Outcome,
  type Stage,
  type Segment,
  type SegmentTally,
  type Target,
  type Verdict,
} from "./types";

const DIR = path.join(process.cwd(), ".cache", "killtest");
const FILE = path.join(DIR, "ledger.json");

export function ledgerPath(dir?: string): string {
  return dir ? path.join(dir, "ledger.json") : FILE;
}

export async function loadLedger(dir?: string): Promise<Ledger | null> {
  try {
    return JSON.parse(await readFile(ledgerPath(dir), "utf8")) as Ledger;
  } catch {
    return null;
  }
}

export async function saveLedger(ledger: Ledger, dir?: string): Promise<string> {
  const file = ledgerPath(dir);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(ledger, null, 2));
  return file;
}

export function emptyLedger(now: Date): Ledger {
  return { version: 1, startedAt: now.toISOString(), targets: [] };
}

/** Where a stage sits on the ladder. -1 for anything unrecognised. */
export function rank(stage: Stage): number {
  return STAGES.indexOf(stage);
}

export function atLeast(stage: Stage, threshold: Stage): boolean {
  return rank(stage) >= rank(threshold);
}

/**
 * Which segment a target belongs to.
 *
 * One place, because the default is a judgement: a target written before
 * segments existed came off a merchant list, and reading it as anything else
 * would retroactively move somebody into a group they were never asked as.
 */
export function segmentOf(target: Target): Segment {
  return target.segment ?? "merchant";
}

/** A line from the targets file: a URL, and what we know about it. */
export interface TargetInput {
  storeUrl: string;
  segment?: Segment;
  note?: string;
}

/** A bare URL is a merchant, which is what every list was before this existed. */
function asInput(target: string | TargetInput): TargetInput {
  return typeof target === "string" ? { storeUrl: target } : target;
}

export function addTargets(ledger: Ledger, targets: (string | TargetInput)[], now: Date): Ledger {
  const known = new Set(ledger.targets.map((t) => t.storeUrl));
  const added = targets
    .map(asInput)
    .filter((target) => !known.has(target.storeUrl))
    .map(
      (target): Target => ({
        storeUrl: target.storeUrl,
        segment: target.segment ?? "merchant",
        ...(target.note ? { note: target.note } : {}),
        stage: "sent",
        outcome: "open",
        updatedAt: now.toISOString(),
      }),
    );
  return { ...ledger, targets: [...ledger.targets, ...added] };
}

export interface Update {
  stage?: Stage;
  outcome?: Outcome;
  said?: string;
  slug?: string;
  shopUrl?: string;
  generatedAt?: string;
}

/**
 * Record what happened, and never let a stage go backwards.
 *
 * A merchant who asked to connect and then went quiet still asked to connect —
 * that is a fact about the test, and overwriting it with "silent" a week later
 * would be quietly editing the numerator. Outcome moves freely; stage only
 * climbs.
 */
export function recordOutcome(ledger: Ledger, storeUrl: string, update: Update, now: Date): Ledger {
  const targets = ledger.targets.map((target) => {
    if (target.storeUrl !== storeUrl) return target;

    const stage = update.stage && rank(update.stage) > rank(target.stage) ? update.stage : target.stage;

    return {
      ...target,
      stage,
      ...(update.outcome ? { outcome: update.outcome } : {}),
      ...(update.said ? { said: update.said } : {}),
      ...(update.slug ? { slug: update.slug } : {}),
      ...(update.shopUrl ? { shopUrl: update.shopUrl } : {}),
      ...(update.generatedAt ? { generatedAt: update.generatedAt } : {}),
      updatedAt: now.toISOString(),
    };
  });

  return { ...ledger, targets };
}

/**
 * The call.
 *
 * `proceed` the moment five merchants are at or past the threshold — the bar is
 * absolute, so there is no reason to wait for the other twenty-five once it is
 * cleared.
 *
 * `kill` only once every conversation has actually resolved. The distinction
 * between "we asked thirty and five said yes" and "we asked six and none
 * replied yet" is exactly the one a tired founder collapses, in whichever
 * direction they were already leaning.
 */
function tally(targets: Target[]): SegmentTally {
  return {
    contacted: targets.length,
    wantItLive: targets.filter((t) => atLeast(t.stage, THRESHOLD_STAGE)).length,
  };
}

export function verdict(ledger: Ledger): Verdict {
  /*
   * The gate counts merchants and only merchants.
   *
   * Creators are on the list to answer a different question — which of the two
   * this product is actually for — and letting them into this arithmetic would
   * turn a bar that was fixed in advance into one that can be cleared by
   * changing who is on the list. That is the precise failure the threshold was
   * written down to prevent, and it would arrive wearing the face of good news.
   */
  const targets = ledger.targets.filter((t) => segmentOf(t) === "merchant");

  const segments = {
    merchant: tally(targets),
    creator: tally(ledger.targets.filter((t) => segmentOf(t) === "creator")),
  };

  const wantItLive = targets.filter((t) => atLeast(t.stage, THRESHOLD_STAGE)).length;
  const askedPrice = targets.filter((t) => atLeast(t.stage, "asked_price")).length;
  const paid = targets.filter((t) => t.stage === "paid").length;
  const generated = targets.filter((t) => t.slug !== undefined).length;
  const contacted = targets.length;
  const resolved = targets.filter((t) => t.outcome !== "open" || atLeast(t.stage, THRESHOLD_STAGE)).length;
  const outstanding = contacted - resolved;

  const base = { wantItLive, askedPrice, paid, generated, contacted, resolved, outstanding, segments };

  if (wantItLive >= THRESHOLD_COUNT) {
    return {
      ...base,
      call: "proceed",
      reason: `${wantItLive} merchants actively want their shop live, which clears the bar of ${THRESHOLD_COUNT}. Sprint 3 is unlocked.`,
    };
  }

  if (contacted < TARGET_MERCHANTS) {
    return {
      ...base,
      call: "running",
      reason: `${contacted} of ${TARGET_MERCHANTS} merchants contacted. The test is not finished, so there is no verdict yet.`,
    };
  }

  if (outstanding > 0) {
    return {
      ...base,
      call: "running",
      reason: `${outstanding} of ${contacted} conversations are still open. A kill call on a partial run is the one this test exists to prevent.`,
    };
  }

  return {
    ...base,
    call: "kill",
    reason: `${contacted} merchants asked, ${wantItLive} wanted it live, and the bar was ${THRESHOLD_COUNT}. Kill quickly rather than rationalise — a no is cheap now and expensive after four weeks of OAuth plumbing.`,
  };
}
