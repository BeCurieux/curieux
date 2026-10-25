import type { AnyModuleOutput, ModuleKey } from "./modules";

// Rows the app stores besides profiles and products. Names follow
// docs/DATA_MODEL.md; the Postgres columns are the snake_case of these.

/**
 * One version of one asset. An asset is (profile, module, product?); its
 * current state is its highest version. Nothing is overwritten: an edit, a
 * regeneration and a restore each add a version.
 */
export interface Generation {
  id: string;
  userId: string;
  profileId: string;
  productId: string | null;
  module: ModuleKey;
  version: number;
  status: "succeeded" | "failed";
  /** ai = a model wrote it; mock = the offline generator; edit/restore = the owner. */
  source: "ai" | "mock" | "edit" | "restore";
  /** The section a partial regeneration replaced, if any. */
  section: string | null;
  inputSnapshot: Record<string, unknown>;
  output: AnyModuleOutput | null;
  warnings: string[];
  error: string | null;
  modelVersion: string | null;
  /** The profile version this was generated from (copied forward on edits). */
  profileVersion: number;
  createdAt: string;
}

export type TaskStatus = "not_started" | "in_progress" | "complete" | "not_applicable";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  not_applicable: "Not applicable",
};

export interface LaunchTask {
  id: string;
  userId: string;
  profileId: string;
  /** Stable key from src/lib/checklist/tasks.ts. */
  taskKey: string;
  category: string;
  label: string;
  status: TaskStatus;
  notes: string;
  updatedAt: string;
}

/** The Launch Pack (software), or an existing download from the catalogue. */
export type ProductType = "launch_pack" | `library:${string}`;

export interface Entitlement {
  id: string;
  userId: string;
  productType: ProductType;
  paymentProvider: "gumroad" | "manual";
  externalPurchaseId: string;
  status: "active" | "refunded" | "revoked";
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A verified payment, which may not belong to an account yet. */
export interface Purchase {
  id: string;
  provider: "gumroad";
  externalPurchaseId: string;
  productType: ProductType;
  email: string;
  userId: string | null;
  status: "paid" | "refunded" | "disputed";
  amountCents: number | null;
  currency: string | null;
  licenseKey: string | null;
  purchasedAt: string;
  lastVerifiedAt: string;
  createdAt: string;
}

export type UsageOperation = "generate" | "generate_failed";

export interface UsageRow {
  id: string;
  userId: string;
  generationId: string | null;
  module: ModuleKey;
  operation: UsageOperation;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  createdAt: string;
}

export interface AnalyticsEvent {
  name: string;
  userId: string | null;
  anonymousId: string | null;
  props: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface UploadRecord {
  id: string;
  userId: string;
  path: string;
  contentType: string;
  bytes: number;
  createdAt: string;
}

/** A Fit Finder result: her answers and her 14-day progress. */
export interface FitResult {
  id: string;
  userId: string;
  answers: Record<string, string | number>;
  progress: FitProgress;
  engineVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface FitProgress {
  /** ISO date the 14-day test starts. */
  start?: string;
  /** Plan days she has ticked. */
  done?: number[];
  /** Calculator inputs, per opportunity id. */
  calc?: Record<
    string,
    { price?: number; hrs?: number; cost?: number; fixed?: number; start?: number }
  >;
}
