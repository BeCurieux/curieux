/**
 * What classification costs, and the cap that stops it costing more.
 *
 * The owner approved up to **A$100 for M1's gold-set classification**
 * (2026-09-26). The cap is enforced here and not remembered: every run records
 * its measured spend in a ledger, and a run whose *estimate* would take the
 * ledger past the cap is refused before a request is sent.
 *
 * Prices are USD per million tokens, first-party API list prices as of this
 * commit. Batch requests are billed at half. Cache reads cost a tenth of
 * input, cache writes 1.25× (5-minute TTL) or 2× (1-hour TTL). Prices change, so a model missing from this
 * table is refused rather than estimated at zero. The AUD rate is an
 * assumption, printed on every estimate. Set `AUD_PER_USD` to the day's rate.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Usage } from "./provider";

export const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export const DEFAULT_AUD_PER_USD = 1.55;

/**
 * Spend is capped per purpose, each approved by the owner separately, so one
 * cannot quietly consume another:
 *
 * - `m1`: Genome v1 gold-set classification, A$100 (2026-09-26).
 * - `killtest`: the v5 kill test's Genome runs, A$150 (2026-09-27).
 *
 * A ledger entry written before budgets existed belongs to `m1`, which was the
 * only budget then. Raising a cap is the owner's decision; the env variable
 * is how that decision is applied, not a place to make it.
 */
export const BUDGETS = {
  m1: { capAud: 100, env: "GENOME_V1_CAP_AUD", what: "M1 gold set" },
  killtest: { capAud: 150, env: "KILLTEST_CAP_AUD", what: "v5 kill test" },
} as const;
export type Budget = keyof typeof BUDGETS;
export const DEFAULT_CAP_AUD = BUDGETS.m1.capAud;

export function isBudget(value: string): value is Budget {
  return value in BUDGETS;
}

export function audPerUsd(): number {
  const fromEnv = Number(process.env.AUD_PER_USD);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_AUD_PER_USD;
}

export function capAud(budget: Budget = "m1"): number {
  const fromEnv = Number(process.env[BUDGETS[budget].env]);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : BUDGETS[budget].capAud;
}

export function priceFor(model: string): { input: number; output: number } {
  const price = PRICES_USD_PER_MTOK[model];
  if (!price) throw new Error(`No price on record for ${model}; add it to PRICES_USD_PER_MTOK before spending on it.`);
  return price;
}

export function usdFor(model: string, usage: Usage, billing: "batch" | "standard" | "free"): number {
  if (billing === "free") return 0;
  const price = priceFor(model);
  const discount = billing === "batch" ? 0.5 : 1;
  const oneHour = Math.min(usage.cacheWrite1hTokens ?? 0, usage.cacheWriteTokens);
  const fiveMinute = usage.cacheWriteTokens - oneHour;
  const input =
    usage.inputTokens * price.input +
    usage.cacheReadTokens * price.input * 0.1 +
    fiveMinute * price.input * 1.25 +
    oneHour * price.input * 2;
  const output = usage.outputTokens * price.output;
  return ((input + output) / 1_000_000) * discount;
}

/**
 * A pre-flight estimate: counted input tokens for one request, a deliberately
 * generous output allowance (thinking is billed as output), times the number
 * of requests. Pessimistic by design, since it is what the cap is checked against.
 */
export const ESTIMATED_OUTPUT_TOKENS = 800;

export function estimateUsd(model: string, inputTokensPerRequest: number, requests: number, billing: "batch" | "standard" | "free"): number {
  return usdFor(model, { inputTokens: inputTokensPerRequest * requests, outputTokens: ESTIMATED_OUTPUT_TOKENS * requests, cacheReadTokens: 0, cacheWriteTokens: 0 }, billing);
}

/** Per product at `runs` runs, projected to a catalogue of `skus`. */
export function projectCatalogue(usdPerProductRun: number, runs: number, skus: number) {
  const usd = usdPerProductRun * runs * skus;
  return { usd, aud: usd * audPerUsd() };
}

// ------------------------------------------------------------------ ledger

export interface LedgerEntry {
  at: string;
  label: string;
  /** Absent on entries written before budgets existed: those are `m1`. */
  budget?: Budget;
  model: string;
  billing: "batch" | "standard" | "free";
  requests: number;
  usage: Usage;
  usd: number;
  aud: number;
}

export interface Ledger {
  entries: LedgerEntry[];
}

export function ledgerPath(root = process.cwd()): string {
  return path.join(root, ".cache", "genome-v1", "spend.json");
}

export async function readLedger(file = ledgerPath()): Promise<Ledger> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<Ledger>;
    return { entries: parsed.entries ?? [] };
  } catch {
    return { entries: [] };
  }
}

const budgetOf = (e: LedgerEntry): Budget => e.budget ?? "m1";

export function spentAud(ledger: Ledger, budget: Budget = "m1"): number {
  return ledger.entries.filter((e) => budgetOf(e) === budget).reduce((sum, e) => sum + e.aud, 0);
}

export class OverBudgetError extends Error {}

/** Throws before anything is sent when the estimate would cross this budget's cap. */
export function assertWithinCap(ledger: Ledger, estimateAud: number, budget: Budget = "m1"): void {
  const spent = spentAud(ledger, budget);
  const cap = capAud(budget);
  if (spent + estimateAud > cap) {
    throw new OverBudgetError(
      `This run is estimated at A$${estimateAud.toFixed(2)}; A$${spent.toFixed(2)} of the A$${cap} ${BUDGETS[budget].what} cap is already spent. ` +
        `Raising ${BUDGETS[budget].env} is the owner's decision, not the script's.`,
    );
  }
}

export async function recordSpend(entry: LedgerEntry, file = ledgerPath()): Promise<Ledger> {
  const ledger = await readLedger(file);
  ledger.entries.push(entry);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(ledger, null, 2)}\n`);
  return ledger;
}
