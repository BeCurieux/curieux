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
 * input, cache writes 1.25×. Prices change, so a model missing from this
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
export const DEFAULT_CAP_AUD = 100;

export function audPerUsd(): number {
  const fromEnv = Number(process.env.AUD_PER_USD);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_AUD_PER_USD;
}

export function capAud(): number {
  const fromEnv = Number(process.env.GENOME_V1_CAP_AUD);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_CAP_AUD;
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
  const input = usage.inputTokens * price.input + usage.cacheReadTokens * price.input * 0.1 + usage.cacheWriteTokens * price.input * 1.25;
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
  model: string;
  billing: "batch" | "standard" | "free";
  requests: number;
  usage: Usage;
  usd: number;
  aud: number;
}

export interface Ledger {
  capAud: number;
  entries: LedgerEntry[];
}

export function ledgerPath(root = process.cwd()): string {
  return path.join(root, ".cache", "genome-v1", "spend.json");
}

export async function readLedger(file = ledgerPath()): Promise<Ledger> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Ledger;
    return { capAud: capAud(), entries: parsed.entries ?? [] };
  } catch {
    return { capAud: capAud(), entries: [] };
  }
}

export function spentAud(ledger: Ledger): number {
  return ledger.entries.reduce((sum, e) => sum + e.aud, 0);
}

export class OverBudgetError extends Error {}

/** Throws before anything is sent when the estimate would cross the cap. */
export function assertWithinCap(ledger: Ledger, estimateAud: number): void {
  const spent = spentAud(ledger);
  if (spent + estimateAud > ledger.capAud) {
    throw new OverBudgetError(
      `This run is estimated at A$${estimateAud.toFixed(2)}; A$${spent.toFixed(2)} of the A$${ledger.capAud} M1 cap is already spent. ` +
        "Raising GENOME_V1_CAP_AUD is the owner's decision, not the script's.",
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
