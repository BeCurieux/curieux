import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BusinessProfile, ProfileFacts, ProfileVersion } from "@/lib/domain/profile";
import { profileFactsOf } from "@/lib/domain/profile";
import type { Product } from "@/lib/domain/product";
import type {
  AnalyticsEvent,
  Entitlement,
  FitProgress,
  FitResult,
  Generation,
  LaunchTask,
  Purchase,
  UsageRow,
} from "@/lib/domain/records";
import { countBy, funnelBySource, repeatUsage } from "@/lib/analytics/metrics";
import type {
  AdminMetrics,
  EmailSignup,
  EmailSignupInput,
  EmailSignupResult,
  SystemRepo,
  UserRepo,
} from "./repo";

// The local backend: one JSON file, for development, tests and demos.
//
// It implements the same contract as the Supabase backend, ownership checks
// included, so the app behaves the same on both. It is not built for load:
// every write rewrites the file. env.ts refuses it in production.

export interface LocalUser {
  id: string;
  email: string;
  createdAt: string;
}

interface Data {
  users: LocalUser[];
  profiles: BusinessProfile[];
  profileVersions: (ProfileVersion & { userId: string })[];
  products: Product[];
  generations: Generation[];
  tasks: LaunchTask[];
  entitlements: Entitlement[];
  purchases: Purchase[];
  usage: UsageRow[];
  events: AnalyticsEvent[];
  fitResults: FitResult[];
  emailSignups: EmailSignup[];
}

const empty = (): Data => ({
  users: [],
  profiles: [],
  profileVersions: [],
  products: [],
  generations: [],
  tasks: [],
  entitlements: [],
  purchases: [],
  usage: [],
  events: [],
  fitResults: [],
  emailSignups: [],
});

const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);

/** The same hard cap the database trigger enforces. */
export const MAX_PROFILES_PER_USER = 5;

export class LocalStore {
  private data: Data | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  // Re-read on every operation: the dev server can run requests in more
  // than one worker, and a copy cached in one would overwrite another's
  // writes. Fine for the local backend's job (development and tests).
  private async load(): Promise<Data> {
    try {
      this.data = { ...empty(), ...(JSON.parse(await readFile(this.file, "utf8")) as Data) };
    } catch {
      this.data = empty();
    }
    return this.data;
  }

  private async save(): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data));
    await rename(tmp, this.file);
  }

  /** Runs `work` alone, then saves. Reads go through here too, for ordering. */
  async tx<T>(work: (data: Data) => T | Promise<T>, write = true): Promise<T> {
    const run = this.queue.then(async () => {
      const data = await this.load();
      const result = await work(data);
      if (write) await this.save();
      return clone(result);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async upsertUser(email: string): Promise<LocalUser> {
    const normalised = email.trim().toLowerCase();
    return this.tx((data) => {
      let user = data.users.find((u) => u.email === normalised);
      if (!user) {
        user = { id: randomUUID(), email: normalised, createdAt: now() };
        data.users.push(user);
      }
      return user;
    });
  }

  async getUser(id: string): Promise<LocalUser | null> {
    return this.tx((data) => data.users.find((u) => u.id === id) ?? null, false);
  }

  forUser(userId: string): UserRepo {
    return new LocalUserRepo(this, userId);
  }

  system(): SystemRepo {
    return new LocalSystemRepo(this);
  }
}

class LocalUserRepo implements UserRepo {
  constructor(
    private readonly store: LocalStore,
    readonly userId: string,
  ) {}

  private mine = <T extends { userId: string }>(rows: T[]) =>
    rows.filter((row) => row.userId === this.userId);

  listProfiles() {
    return this.store.tx(
      (d) => this.mine(d.profiles).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      false,
    );
  }

  getProfile(id: string) {
    return this.store.tx((d) => this.mine(d.profiles).find((p) => p.id === id) ?? null, false);
  }

  createProfile(facts: ProfileFacts) {
    return this.store.tx((d) => {
      if (this.mine(d.profiles).length >= MAX_PROFILES_PER_USER) {
        throw new Error("profile limit reached");
      }
      const at = now();
      const profile: BusinessProfile = {
        ...facts,
        id: randomUUID(),
        userId: this.userId,
        logoPath: null,
        brand: null,
        version: 1,
        createdAt: at,
        updatedAt: at,
      };
      d.profiles.push(profile);
      d.profileVersions.push({
        id: randomUUID(),
        userId: this.userId,
        profileId: profile.id,
        version: 1,
        facts,
        brand: null,
        note: "Created",
        createdAt: at,
      });
      return profile;
    });
  }

  updateProfile(id: string, patch: Parameters<UserRepo["updateProfile"]>[1], note: string) {
    return this.store.tx((d) => {
      const profile = this.mine(d.profiles).find((p) => p.id === id);
      if (!profile) throw new Error("not found");
      if (patch.facts) Object.assign(profile, patch.facts);
      if (patch.brand !== undefined) profile.brand = patch.brand;
      if (patch.logoPath !== undefined) profile.logoPath = patch.logoPath;
      profile.version += 1;
      profile.updatedAt = now();
      d.profileVersions.push({
        id: randomUUID(),
        userId: this.userId,
        profileId: id,
        version: profile.version,
        facts: profileFactsOf(profile),
        brand: profile.brand,
        note,
        createdAt: profile.updatedAt,
      });
      return profile;
    });
  }

  listProfileVersions(id: string) {
    return this.store.tx(
      (d) =>
        this.mine(d.profileVersions)
          .filter((v) => v.profileId === id)
          .sort((a, b) => b.version - a.version)
          .map(({ userId: _owner, ...version }) => version),
      false,
    );
  }

  deleteProfile(id: string) {
    return this.store.tx((d) => {
      const owned = this.mine(d.profiles).some((p) => p.id === id);
      if (!owned) return;
      d.profiles = d.profiles.filter((p) => p.id !== id);
      d.profileVersions = d.profileVersions.filter((v) => v.profileId !== id);
      d.products = d.products.filter((p) => p.profileId !== id);
      d.generations = d.generations.filter((g) => g.profileId !== id);
      d.tasks = d.tasks.filter((t) => t.profileId !== id);
    });
  }

  listProducts(profileId: string) {
    return this.store.tx(
      (d) =>
        this.mine(d.products)
          .filter((p) => p.profileId === profileId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      false,
    );
  }

  getProduct(id: string) {
    return this.store.tx((d) => this.mine(d.products).find((p) => p.id === id) ?? null, false);
  }

  createProduct(profileId: string, input: Parameters<UserRepo["createProduct"]>[1]) {
    return this.store.tx((d) => {
      if (!this.mine(d.profiles).some((p) => p.id === profileId)) throw new Error("not found");
      const at = now();
      const product: Product = {
        ...input,
        id: randomUUID(),
        userId: this.userId,
        profileId,
        imagePaths: [],
        createdAt: at,
        updatedAt: at,
      };
      d.products.push(product);
      return product;
    });
  }

  updateProduct(
    id: string,
    input: Parameters<UserRepo["updateProduct"]>[1],
    imagePaths?: string[],
  ) {
    return this.store.tx((d) => {
      const product = this.mine(d.products).find((p) => p.id === id);
      if (!product) throw new Error("not found");
      Object.assign(product, input);
      if (imagePaths) product.imagePaths = imagePaths;
      product.updatedAt = now();
      return product;
    });
  }

  deleteProduct(id: string) {
    return this.store.tx((d) => {
      if (!this.mine(d.products).some((p) => p.id === id)) return;
      d.products = d.products.filter((p) => p.id !== id);
      d.generations = d.generations.filter((g) => g.productId !== id);
    });
  }

  listGenerations(profileId: string, filter: Parameters<UserRepo["listGenerations"]>[1] = {}) {
    return this.store.tx(
      (d) =>
        this.mine(d.generations)
          .filter(
            (g) =>
              g.profileId === profileId &&
              (filter.module === undefined || g.module === filter.module) &&
              (filter.productId === undefined || g.productId === filter.productId),
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.version - a.version),
      false,
    );
  }

  getGeneration(id: string) {
    return this.store.tx((d) => this.mine(d.generations).find((g) => g.id === id) ?? null, false);
  }

  addGeneration(row: Parameters<UserRepo["addGeneration"]>[0]) {
    return this.store.tx((d) => {
      if (!this.mine(d.profiles).some((p) => p.id === row.profileId)) throw new Error("not found");
      if (row.productId && !this.mine(d.products).some((p) => p.id === row.productId)) {
        throw new Error("not found");
      }
      const siblings = this.mine(d.generations).filter(
        (g) =>
          g.profileId === row.profileId && g.module === row.module && g.productId === row.productId,
      );
      const generation: Generation = {
        ...row,
        id: randomUUID(),
        userId: this.userId,
        version: Math.max(0, ...siblings.map((g) => g.version)) + 1,
        createdAt: now(),
      };
      d.generations.push(generation);
      return generation;
    });
  }

  listTasks(profileId: string) {
    return this.store.tx((d) => this.mine(d.tasks).filter((t) => t.profileId === profileId), false);
  }

  ensureTasks(profileId: string, tasks: Parameters<UserRepo["ensureTasks"]>[1]) {
    return this.store.tx((d) => {
      if (!this.mine(d.profiles).some((p) => p.id === profileId)) throw new Error("not found");
      const have = new Set(
        this.mine(d.tasks)
          .filter((t) => t.profileId === profileId)
          .map((t) => t.taskKey),
      );
      for (const task of tasks) {
        if (have.has(task.taskKey)) continue;
        d.tasks.push({
          ...task,
          id: randomUUID(),
          userId: this.userId,
          profileId,
          notes: "",
          updatedAt: now(),
        });
      }
    });
  }

  updateTask(id: string, patch: Parameters<UserRepo["updateTask"]>[1]) {
    return this.store.tx((d) => {
      const task = this.mine(d.tasks).find((t) => t.id === id);
      if (!task) throw new Error("not found");
      if (patch.status) task.status = patch.status;
      if (patch.notes !== undefined) task.notes = patch.notes;
      task.updatedAt = now();
      return task;
    });
  }

  listEntitlements() {
    return this.store.tx((d) => this.mine(d.entitlements), false);
  }

  listUsage(sinceIso: string) {
    return this.store.tx((d) => this.mine(d.usage).filter((u) => u.createdAt >= sinceIso), false);
  }

  listFitResults() {
    return this.store.tx(
      (d) => this.mine(d.fitResults).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      false,
    );
  }

  getFitResult(id: string) {
    return this.store.tx((d) => this.mine(d.fitResults).find((r) => r.id === id) ?? null, false);
  }

  createFitResult(answers: FitResult["answers"], engineVersion: string) {
    return this.store.tx((d) => {
      const at = now();
      const result: FitResult = {
        id: randomUUID(),
        userId: this.userId,
        answers,
        progress: {},
        engineVersion,
        createdAt: at,
        updatedAt: at,
      };
      d.fitResults.push(result);
      return result;
    });
  }

  updateFitProgress(id: string, progress: FitProgress) {
    return this.store.tx((d) => {
      const result = this.mine(d.fitResults).find((r) => r.id === id);
      if (!result) throw new Error("not found");
      result.progress = progress;
      result.updatedAt = now();
      return result;
    });
  }
}

class LocalSystemRepo implements SystemRepo {
  constructor(private readonly store: LocalStore) {}

  recordUsage(row: Parameters<SystemRepo["recordUsage"]>[0]) {
    return this.store.tx((d) => {
      d.usage.push({ ...row, id: randomUUID(), createdAt: now() });
    });
  }

  platformCostSince(sinceIso: string) {
    return this.store.tx(
      (d) =>
        d.usage.filter((u) => u.createdAt >= sinceIso).reduce((sum, u) => sum + u.estimatedCost, 0),
      false,
    );
  }

  upsertPurchase(input: Parameters<SystemRepo["upsertPurchase"]>[0]) {
    return this.store.tx((d) => {
      const existing = d.purchases.find(
        (p) => p.provider === input.provider && p.externalPurchaseId === input.externalPurchaseId,
      );
      if (existing) {
        existing.status = input.status;
        existing.licenseKey = input.licenseKey ?? existing.licenseKey;
        existing.lastVerifiedAt = now();
        return { purchase: existing, created: false };
      }
      const purchase: Purchase = {
        ...input,
        email: input.email.trim().toLowerCase(),
        id: randomUUID(),
        userId: null,
        lastVerifiedAt: now(),
        createdAt: now(),
      };
      d.purchases.push(purchase);
      return { purchase, created: true };
    });
  }

  getPurchase(provider: "gumroad", externalPurchaseId: string) {
    return this.store.tx(
      (d) =>
        d.purchases.find(
          (p) => p.provider === provider && p.externalPurchaseId === externalPurchaseId,
        ) ?? null,
      false,
    );
  }

  unclaimedPurchasesFor(email: string) {
    const normalised = email.trim().toLowerCase();
    return this.store.tx(
      (d) => d.purchases.filter((p) => p.userId === null && p.email === normalised),
      false,
    );
  }

  attachPurchase(purchaseId: string, userId: string) {
    return this.store.tx((d) => {
      const purchase = d.purchases.find((p) => p.id === purchaseId);
      if (!purchase) throw new Error("not found");
      if (purchase.userId && purchase.userId !== userId) {
        throw new Error("purchase belongs to another account");
      }
      purchase.userId = userId;
      return purchase;
    });
  }

  purchasesToRecheck(sinceIso: string) {
    return this.store.tx(
      (d) => d.purchases.filter((p) => p.purchasedAt >= sinceIso && p.status === "paid"),
      false,
    );
  }

  syncEntitlement(purchase: Purchase) {
    return this.store.tx((d) => {
      if (!purchase.userId) return null;
      const status: Entitlement["status"] = purchase.status === "paid" ? "active" : "refunded";
      let entitlement = d.entitlements.find(
        (e) =>
          e.paymentProvider === purchase.provider &&
          e.externalPurchaseId === purchase.externalPurchaseId,
      );
      if (!entitlement) {
        entitlement = {
          id: randomUUID(),
          userId: purchase.userId,
          productType: purchase.productType,
          paymentProvider: purchase.provider,
          externalPurchaseId: purchase.externalPurchaseId,
          status,
          expiresAt: null,
          createdAt: now(),
          updatedAt: now(),
        };
        d.entitlements.push(entitlement);
      } else {
        entitlement.status = status;
        entitlement.updatedAt = now();
      }
      return entitlement;
    });
  }

  track(event: AnalyticsEvent) {
    return this.store.tx((d) => {
      d.events.push(event);
    });
  }

  recordEmailSignup(input: EmailSignupInput): Promise<EmailSignupResult> {
    return this.store.tx((d) => {
      const existing = d.emailSignups.find((s) => s.email === input.email);
      if (existing && !existing.unsubscribedAt) return "already" as const;
      if (existing) {
        Object.assign(existing, input, { consentedAt: now(), unsubscribedAt: null });
        return "resubscribed" as const;
      }
      d.emailSignups.push({
        ...input,
        id: randomUUID(),
        consentedAt: now(),
        unsubscribedAt: null,
        unsubscribeToken: randomBytes(24).toString("base64url"),
        createdAt: now(),
      });
      return "new" as const;
    });
  }

  unsubscribeEmail(token: string): Promise<boolean> {
    return this.store.tx((d) => {
      const row = d.emailSignups.find((s) => s.unsubscribeToken === token && !s.unsubscribedAt);
      if (!row) return false;
      row.unsubscribedAt = now();
      return true;
    });
  }

  adminMetrics(): Promise<AdminMetrics> {
    return this.store.tx((d) => {
      const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const activity = d.events
        .filter((e) => e.userId)
        .map((e) => ({ userId: e.userId!, at: e.createdAt }));
      const { repeat7d, repeat30d } = repeatUsage(activity);
      return {
        events: countBy(d.events, (e) => e.name),
        users: d.users.length,
        profilesCompleted: d.profiles.length,
        activeEntitlements: d.entitlements.filter((e) => e.status === "active").length,
        refundedEntitlements: d.entitlements.filter((e) => e.status === "refunded").length,
        generations: {
          succeeded: d.generations.filter(
            (g) => g.status === "succeeded" && (g.source === "ai" || g.source === "mock"),
          ).length,
          failed: d.generations.filter((g) => g.status === "failed").length,
        },
        costLast30Days: d.usage
          .filter((u) => u.createdAt >= monthAgo)
          .reduce((sum, u) => sum + u.estimatedCost, 0),
        payingCustomers: new Set(
          d.entitlements.filter((e) => e.status === "active").map((e) => e.userId),
        ).size,
        repeatUsers7d: repeat7d,
        repeatUsers30d: repeat30d,
        sources: countBy(
          d.events.filter((e) => e.name === "signup_completed"),
          (e) => String(e.props.source ?? "direct"),
        ),
        emailSignups: {
          active: d.emailSignups.filter((s) => !s.unsubscribedAt).length,
          unsubscribed: d.emailSignups.filter((s) => s.unsubscribedAt).length,
        },
        funnel: funnelBySource(d.events),
        recentEvents: d.events
          .filter((e) => e.createdAt >= new Date(Date.now() - 8 * 86_400_000).toISOString())
          .map((e) => ({
            name: e.name,
            at: e.createdAt,
            source: typeof e.props.source === "string" ? e.props.source : null,
            path: typeof e.props.path === "string" ? e.props.path : null,
            anonymousId: e.anonymousId,
          })),
      };
    }, false);
  }

  deleteUser(userId: string) {
    return this.store.tx((d) => {
      d.users = d.users.filter((u) => u.id !== userId);
      d.profiles = d.profiles.filter((p) => p.userId !== userId);
      d.profileVersions = d.profileVersions.filter((v) => v.userId !== userId);
      d.products = d.products.filter((p) => p.userId !== userId);
      d.generations = d.generations.filter((g) => g.userId !== userId);
      d.tasks = d.tasks.filter((t) => t.userId !== userId);
      d.entitlements = d.entitlements.filter((e) => e.userId !== userId);
      d.usage = d.usage.filter((u) => u.userId !== userId);
      d.fitResults = d.fitResults.filter((r) => r.userId !== userId);
      // Purchases are the business's financial record and stay, detached.
      for (const p of d.purchases) if (p.userId === userId) p.userId = null;
      d.events = d.events.map((e) => (e.userId === userId ? { ...e, userId: null } : e));
    });
  }
}
