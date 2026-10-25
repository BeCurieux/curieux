// Estimated model cost per call, for the usage ledger and the daily ceiling.
// US dollars per million tokens, from Anthropic's published prices
// (docs/SERVICES.md). Unknown models are priced as the most expensive known
// one, so an estimate can be too high but never quietly too low.

const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-fable-5-1": { input: 10, output: 50 },
};

const FALLBACK = { input: 10, output: 50 };

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model] ?? FALLBACK;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
