/**
 * Step 7 — Stop.
 *
 * The seventh entry in the build order is not a feature to implement, and the
 * work it asks for is the kill test: thirty merchants, five of whom have to
 * actively want their shop live before Sprint 3 is allowed to begin.
 *
 * Nothing here is product surface. It is not routed, not persisted to the shops
 * database, and not something a merchant ever sees.
 */

export { preflight } from "./preflight";
export type { Preflight, PreflightInput } from "./preflight";
export {
  addTargets,
  atLeast,
  emptyLedger,
  ledgerPath,
  loadLedger,
  rank,
  recordOutcome,
  saveLedger,
  verdict,
} from "./ledger";
export { segmentOf } from "./ledger";
export type { Update, TargetInput } from "./ledger";
export { parseTargets } from "./targets";
export type { ParseTargetsOptions } from "./targets";
export * from "./types";
