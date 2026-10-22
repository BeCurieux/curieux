// A generation that failed in a way we can explain to the customer. `usage`
// is what the failed attempt still cost, so the ledger stays honest.
export class GenerationError extends Error {
  constructor(
    message: string,
    readonly usage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 },
    readonly retryable = false,
  ) {
    super(message);
  }
}
