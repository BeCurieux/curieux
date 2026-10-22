import type {
  BrandBlueprint,
  BusinessProfile,
  ProfileFacts,
  ProfileVersion,
} from "@/lib/domain/profile";
import type { Product, ProductInput } from "@/lib/domain/product";
import type { ModuleKey } from "@/lib/domain/modules";
import type {
  AnalyticsEvent,
  Entitlement,
  FitProgress,
  FitResult,
  Generation,
  LaunchTask,
  ProductType,
  Purchase,
  TaskStatus,
  UsageRow,
} from "@/lib/domain/records";

// The storage boundary.
//
// UserRepo is everything one signed-in customer may touch. Every method is
// scoped to that customer: the Supabase implementation runs as the user, so
// row level security enforces it in the database, and both implementations
// also filter by owner in code. A method that takes an id belonging to
// someone else behaves exactly as if the id did not exist.
//
// SystemRepo is the privileged side: payments, the usage ledger, analytics
// and account deletion. Customers can read their own entitlements and usage
// through UserRepo but can never write them.

export interface NewGeneration {
  profileId: string;
  productId: string | null;
  module: ModuleKey;
  status: Generation["status"];
  source: Generation["source"];
  section: string | null;
  inputSnapshot: Record<string, unknown>;
  output: Generation["output"];
  warnings: string[];
  error: string | null;
  modelVersion: string | null;
  profileVersion: number;
}

export interface ProfilePatch {
  facts?: ProfileFacts;
  brand?: BrandBlueprint | null;
  logoPath?: string | null;
}

export interface UserRepo {
  readonly userId: string;

  listProfiles(): Promise<BusinessProfile[]>;
  getProfile(id: string): Promise<BusinessProfile | null>;
  createProfile(facts: ProfileFacts): Promise<BusinessProfile>;
  /** Saves and snapshots: bumps `version` and appends to the version history. */
  updateProfile(id: string, patch: ProfilePatch, note: string): Promise<BusinessProfile>;
  listProfileVersions(id: string): Promise<ProfileVersion[]>;
  deleteProfile(id: string): Promise<void>;

  listProducts(profileId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  createProduct(profileId: string, input: ProductInput): Promise<Product>;
  updateProduct(id: string, input: ProductInput, imagePaths?: string[]): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  /** Every version of every asset for a profile, newest first. */
  listGenerations(
    profileId: string,
    filter?: { module?: ModuleKey; productId?: string | null },
  ): Promise<Generation[]>;
  getGeneration(id: string): Promise<Generation | null>;
  /** Appends the next version of the asset (profile, module, product). */
  addGeneration(row: NewGeneration): Promise<Generation>;

  listTasks(profileId: string): Promise<LaunchTask[]>;
  /** Inserts tasks whose keys aren't there yet; leaves existing ones alone. */
  ensureTasks(
    profileId: string,
    tasks: { taskKey: string; category: string; label: string; status: TaskStatus }[],
  ): Promise<void>;
  updateTask(id: string, patch: { status?: TaskStatus; notes?: string }): Promise<LaunchTask>;

  listEntitlements(): Promise<Entitlement[]>;
  listUsage(sinceIso: string): Promise<UsageRow[]>;

  listFitResults(): Promise<FitResult[]>;
  getFitResult(id: string): Promise<FitResult | null>;
  createFitResult(answers: FitResult["answers"], engineVersion: string): Promise<FitResult>;
  updateFitProgress(id: string, progress: FitProgress): Promise<FitResult>;
}

export interface PurchaseUpsert {
  provider: "gumroad";
  externalPurchaseId: string;
  productType: ProductType;
  email: string;
  status: Purchase["status"];
  amountCents: number | null;
  currency: string | null;
  licenseKey: string | null;
  purchasedAt: string;
}

export interface AdminMetrics {
  events: Record<string, number>;
  users: number;
  profilesCompleted: number;
  activeEntitlements: number;
  refundedEntitlements: number;
  generations: { succeeded: number; failed: number };
  costLast30Days: number;
  payingCustomers: number;
  repeatUsers7d: number;
  repeatUsers30d: number;
  sources: Record<string, number>;
}

export interface SystemRepo {
  recordUsage(row: Omit<UsageRow, "id" | "createdAt">): Promise<void>;
  platformCostSince(sinceIso: string): Promise<number>;

  /** Idempotent on (provider, externalPurchaseId). */
  upsertPurchase(input: PurchaseUpsert): Promise<{ purchase: Purchase; created: boolean }>;
  getPurchase(provider: "gumroad", externalPurchaseId: string): Promise<Purchase | null>;
  unclaimedPurchasesFor(email: string): Promise<Purchase[]>;
  attachPurchase(purchaseId: string, userId: string): Promise<Purchase>;
  /** Purchases still inside the window where a refund could arrive. */
  purchasesToRecheck(sinceIso: string): Promise<Purchase[]>;
  /** Mirrors the purchase onto the user's entitlement, creating it if needed. */
  syncEntitlement(purchase: Purchase): Promise<Entitlement | null>;

  track(event: AnalyticsEvent): Promise<void>;
  adminMetrics(): Promise<AdminMetrics>;

  /** Every row the customer owns, and her login. Irreversible. */
  deleteUser(userId: string): Promise<void>;
}
