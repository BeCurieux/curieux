export type GenomeFailureCode =
  | "no-api-key"
  | "refused"
  | "truncated"
  | "unparseable"
  | "invalid-genome"
  | "empty-catalogue";

/**
 * The Genome fails loudly or not at all.
 *
 * There is no degraded mode that stores a partial read. A Genome is an input to
 * every merchandising decision that follows, and half of one is worse than none:
 * the merchandiser cannot tell which half it is missing, so it would build
 * routines from a relationship graph with holes in it and never say so.
 *
 * The one legitimate absence is no Genome at all — `merchandise()` accepts that
 * and says so in its diagnostics.
 */
export class GenomeError extends Error {
  constructor(
    readonly code: GenomeFailureCode,
    message: string,
    readonly attempts: string[][] = [],
  ) {
    super(message);
    this.name = "GenomeError";
  }
}
