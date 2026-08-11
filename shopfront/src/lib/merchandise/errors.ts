export type MerchandiseFailureCode =
  | "no-api-key"
  | "refused"
  | "truncated"
  | "unparseable"
  | "invalid-plan"
  | "empty-catalogue";

/**
 * Merchandising fails loudly or not at all.
 *
 * There is no degraded mode where an invalid plan gets rendered anyway. The
 * brief is explicit — invalid output is retried with the error, never
 * rendered — and the failure most worth being loud about is the one where a
 * shop looks fine and sells a product that doesn't exist.
 */
export class MerchandiseError extends Error {
  constructor(
    readonly code: MerchandiseFailureCode,
    message: string,
    /** Every attempt's validation errors, oldest first. */
    readonly attempts: string[][] = [],
  ) {
    super(message);
    this.name = "MerchandiseError";
  }
}
