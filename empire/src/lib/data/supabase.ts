import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  Generation,
  LaunchTask,
  Purchase,
  UsageRow,
} from "@/lib/domain/records";
import { countBy, repeatUsage } from "@/lib/analytics/metrics";
import type { AdminMetrics, NewGeneration, SystemRepo, UserRepo } from "./repo";

// The Supabase backend. Customer reads and writes run as the customer (row
// level security applies); see supabase/migrations for the policies. The
// only writes that use the service role are listed on SupabaseSystemRepo,
// plus model generations in addGeneration, after ownership has been checked
// through the customer's own client.

type Row = Record<string, unknown>;

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const factsToRow = (f: ProfileFacts): Row => ({
  brand_name: f.brandName,
  website_url: f.websiteUrl ?? null,
  category: f.category,
  audience: f.audience,
  products_summary: f.productsSummary,
  personality: f.personality,
  visual_style: f.visualStyle,
  colours: f.colours,
  market: f.market,
  currency: f.currency,
  goal: f.goal,
  stage: f.stage,
  fulfilment: f.fulfilment,
  verified_claims: f.verifiedClaims,
  prohibited_claims: f.prohibitedClaims,
});

const toProfile = (r: Row): BusinessProfile => ({
  id: r.id as string,
  userId: r.user_id as string,
  brandName: r.brand_name as string,
  websiteUrl: (r.website_url as string | null) ?? undefined,
  category: r.category as string,
  audience: r.audience as string,
  productsSummary: r.products_summary as string,
  personality: r.personality as string,
  visualStyle: r.visual_style as string,
  colours: r.colours as string,
  market: r.market as string,
  currency: r.currency as string,
  goal: r.goal as string,
  stage: r.stage as BusinessProfile["stage"],
  fulfilment: r.fulfilment as BusinessProfile["fulfilment"],
  verifiedClaims: (r.verified_claims as string[]) ?? [],
  prohibitedClaims: (r.prohibited_claims as string[]) ?? [],
  logoPath: (r.logo_path as string | null) ?? null,
  brand: (r.brand as BrandBlueprint | null) ?? null,
  version: r.version as number,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const productToRow = (p: ProductInput): Row => ({
  name: p.name,
  category: p.category,
  materials: p.materials,
  dimensions: p.dimensions,
  colour_options: p.colourOptions,
  benefits: p.benefits,
  intended_use: p.intendedUse,
  customer_problem: p.customerProblem,
  price: p.price,
  care_instructions: p.careInstructions,
  shipping_info: p.shippingInfo,
  verified_claims: p.verifiedClaims,
  image_notes: p.imageNotes,
});

const toProduct = (r: Row): Product => ({
  id: r.id as string,
  userId: r.user_id as string,
  profileId: r.profile_id as string,
  name: r.name as string,
  category: r.category as string,
  materials: r.materials as string,
  dimensions: r.dimensions as string,
  colourOptions: r.colour_options as string,
  benefits: r.benefits as string,
  intendedUse: r.intended_use as string,
  customerProblem: r.customer_problem as string,
  price: r.price === null ? null : Number(r.price),
  careInstructions: r.care_instructions as string,
  shippingInfo: r.shipping_info as string,
  verifiedClaims: (r.verified_claims as string[]) ?? [],
  imageNotes: r.image_notes as string,
  imagePaths: (r.image_paths as string[]) ?? [],
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toGeneration = (r: Row): Generation => ({
  id: r.id as string,
  userId: r.user_id as string,
  profileId: r.profile_id as string,
  productId: (r.product_id as string | null) ?? null,
  module: r.module as ModuleKey,
  version: r.version as number,
  status: r.status as Generation["status"],
  source: r.source as Generation["source"],
  section: (r.section as string | null) ?? null,
  inputSnapshot: (r.input_snapshot as Record<string, unknown>) ?? {},
  output: (r.output as Generation["output"]) ?? null,
  warnings: (r.warnings as string[]) ?? [],
  error: (r.error as string | null) ?? null,
  modelVersion: (r.model_version as string | null) ?? null,
  profileVersion: r.profile_version as number,
  createdAt: r.created_at as string,
});

const toTask = (r: Row): LaunchTask => ({
  id: r.id as string,
  userId: r.user_id as string,
  profileId: r.profile_id as string,
  taskKey: r.task_key as string,
  category: r.category as string,
  label: r.label as string,
  status: r.status as LaunchTask["status"],
  notes: r.notes as string,
  updatedAt: r.updated_at as string,
});

const toEntitlement = (r: Row): Entitlement => ({
  id: r.id as string,
  userId: r.user_id as string,
  productType: r.product_type as Entitlement["productType"],
  paymentProvider: r.payment_provider as Entitlement["paymentProvider"],
  externalPurchaseId: r.external_purchase_id as string,
  status: r.status as Entitlement["status"],
  expiresAt: (r.expires_at as string | null) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

const toPurchase = (r: Row): Purchase => ({
  id: r.id as string,
  provider: r.provider as Purchase["provider"],
  externalPurchaseId: r.external_purchase_id as string,
  productType: r.product_type as Purchase["productType"],
  email: r.email as string,
  userId: (r.user_id as string | null) ?? null,
  status: r.status as Purchase["status"],
  amountCents: (r.amount_cents as number | null) ?? null,
  currency: (r.currency as string | null) ?? null,
  licenseKey: (r.license_key as string | null) ?? null,
  purchasedAt: r.purchased_at as string,
  lastVerifiedAt: r.last_verified_at as string,
  createdAt: r.created_at as string,
});

const toUsage = (r: Row): UsageRow => ({
  id: r.id as string,
  userId: r.user_id as string,
  generationId: (r.generation_id as string | null) ?? null,
  module: r.module as ModuleKey,
  operation: r.operation as UsageRow["operation"],
  inputTokens: r.input_tokens as number,
  outputTokens: r.output_tokens as number,
  estimatedCost: Number(r.estimated_cost),
  createdAt: r.created_at as string,
});

export class SupabaseUserRepo implements UserRepo {
  constructor(
    private readonly db: SupabaseClient,
    private readonly admin: () => SupabaseClient,
    readonly userId: string,
  ) {}

  async listProfiles() {
    const rows = check(
      await this.db
        .from("business_profiles")
        .select("*")
        .eq("user_id", this.userId)
        .order("created_at"),
    );
    return (rows as Row[]).map(toProfile);
  }

  async getProfile(id: string) {
    const row = check(
      await this.db
        .from("business_profiles")
        .select("*")
        .eq("id", id)
        .eq("user_id", this.userId)
        .maybeSingle(),
    );
    return row ? toProfile(row as Row) : null;
  }

  async createProfile(facts: ProfileFacts) {
    const row = check(
      await this.db
        .from("business_profiles")
        .insert({ ...factsToRow(facts), user_id: this.userId, last_note: "Created" })
        .select("*")
        .single(),
    );
    return toProfile(row as Row);
  }

  async updateProfile(
    id: string,
    patch: { facts?: ProfileFacts; brand?: BrandBlueprint | null; logoPath?: string | null },
    note: string,
  ) {
    const update: Row = { last_note: note.slice(0, 200) };
    if (patch.facts) Object.assign(update, factsToRow(patch.facts));
    if (patch.brand !== undefined) update.brand = patch.brand;
    if (patch.logoPath !== undefined) update.logo_path = patch.logoPath;
    const row = check(
      await this.db
        .from("business_profiles")
        .update(update)
        .eq("id", id)
        .eq("user_id", this.userId)
        .select("*")
        .single(),
    );
    return toProfile(row as Row);
  }

  async listProfileVersions(id: string): Promise<ProfileVersion[]> {
    const rows = check(
      await this.db
        .from("profile_versions")
        .select("*")
        .eq("profile_id", id)
        .eq("user_id", this.userId)
        .order("version", { ascending: false }),
    );
    return (rows as Row[]).map((r) => ({
      id: r.id as string,
      profileId: r.profile_id as string,
      version: r.version as number,
      facts: r.facts as ProfileFacts,
      brand: (r.brand as BrandBlueprint | null) ?? null,
      note: r.note as string,
      createdAt: r.created_at as string,
    }));
  }

  async deleteProfile(id: string) {
    check(await this.db.from("business_profiles").delete().eq("id", id).eq("user_id", this.userId));
  }

  async listProducts(profileId: string) {
    const rows = check(
      await this.db
        .from("products")
        .select("*")
        .eq("profile_id", profileId)
        .eq("user_id", this.userId)
        .order("created_at"),
    );
    return (rows as Row[]).map(toProduct);
  }

  async getProduct(id: string) {
    const row = check(
      await this.db
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("user_id", this.userId)
        .maybeSingle(),
    );
    return row ? toProduct(row as Row) : null;
  }

  async createProduct(profileId: string, input: ProductInput) {
    const row = check(
      await this.db
        .from("products")
        .insert({ ...productToRow(input), profile_id: profileId, user_id: this.userId })
        .select("*")
        .single(),
    );
    return toProduct(row as Row);
  }

  async updateProduct(id: string, input: ProductInput, imagePaths?: string[]) {
    const update = productToRow(input);
    if (imagePaths) update.image_paths = imagePaths;
    const row = check(
      await this.db
        .from("products")
        .update(update)
        .eq("id", id)
        .eq("user_id", this.userId)
        .select("*")
        .single(),
    );
    return toProduct(row as Row);
  }

  async deleteProduct(id: string) {
    check(await this.db.from("products").delete().eq("id", id).eq("user_id", this.userId));
  }

  async listGenerations(
    profileId: string,
    filter: { module?: ModuleKey; productId?: string | null } = {},
  ) {
    let query = this.db
      .from("generations")
      .select("*")
      .eq("profile_id", profileId)
      .eq("user_id", this.userId);
    if (filter.module) query = query.eq("module", filter.module);
    if (filter.productId === null) query = query.is("product_id", null);
    else if (filter.productId) query = query.eq("product_id", filter.productId);
    const rows = check(
      await query
        .order("created_at", { ascending: false })
        .order("version", { ascending: false })
        .limit(500),
    );
    return (rows as Row[]).map(toGeneration);
  }

  async getGeneration(id: string) {
    const row = check(
      await this.db
        .from("generations")
        .select("*")
        .eq("id", id)
        .eq("user_id", this.userId)
        .maybeSingle(),
    );
    return row ? toGeneration(row as Row) : null;
  }

  async addGeneration(g: NewGeneration) {
    const row: Row = {
      user_id: this.userId,
      profile_id: g.profileId,
      product_id: g.productId,
      module: g.module,
      status: g.status,
      source: g.source,
      section: g.section,
      input_snapshot: g.inputSnapshot,
      output: g.output,
      warnings: g.warnings,
      error: g.error,
      model_version: g.modelVersion,
      profile_version: g.profileVersion,
    };
    // Customers may write their own edits and restores. Model output is
    // metered and charged, so only the server writes it — after confirming,
    // as the customer, that the profile (and product) are hers.
    const ownEdit = (g.source === "edit" || g.source === "restore") && g.status === "succeeded";
    if (!ownEdit) {
      if (!(await this.getProfile(g.profileId))) throw new Error("not found");
      if (g.productId && !(await this.getProduct(g.productId))) throw new Error("not found");
    }
    const client = ownEdit ? this.db : this.admin();
    const saved = check(await client.from("generations").insert(row).select("*").single());
    return toGeneration(saved as Row);
  }

  async listTasks(profileId: string) {
    const rows = check(
      await this.db
        .from("launch_tasks")
        .select("*")
        .eq("profile_id", profileId)
        .eq("user_id", this.userId),
    );
    return (rows as Row[]).map(toTask);
  }

  async ensureTasks(
    profileId: string,
    tasks: { taskKey: string; category: string; label: string; status: LaunchTask["status"] }[],
  ) {
    if (tasks.length === 0) return;
    check(
      await this.db.from("launch_tasks").upsert(
        tasks.map((t) => ({
          user_id: this.userId,
          profile_id: profileId,
          task_key: t.taskKey,
          category: t.category,
          label: t.label,
          status: t.status,
        })),
        { onConflict: "profile_id,task_key", ignoreDuplicates: true },
      ),
    );
  }

  async updateTask(id: string, patch: { status?: LaunchTask["status"]; notes?: string }) {
    const update: Row = { updated_at: new Date().toISOString() };
    if (patch.status) update.status = patch.status;
    if (patch.notes !== undefined) update.notes = patch.notes;
    const row = check(
      await this.db
        .from("launch_tasks")
        .update(update)
        .eq("id", id)
        .eq("user_id", this.userId)
        .select("*")
        .single(),
    );
    return toTask(row as Row);
  }

  async listEntitlements() {
    const rows = check(await this.db.from("entitlements").select("*").eq("user_id", this.userId));
    return (rows as Row[]).map(toEntitlement);
  }

  async listUsage(sinceIso: string) {
    const rows = check(
      await this.db
        .from("usage_ledger")
        .select("*")
        .eq("user_id", this.userId)
        .gte("created_at", sinceIso),
    );
    return (rows as Row[]).map(toUsage);
  }
}

export class SupabaseSystemRepo implements SystemRepo {
  constructor(private readonly db: SupabaseClient) {}

  async recordUsage(row: Omit<UsageRow, "id" | "createdAt">) {
    check(
      await this.db.from("usage_ledger").insert({
        user_id: row.userId,
        generation_id: row.generationId,
        module: row.module,
        operation: row.operation,
        input_tokens: row.inputTokens,
        output_tokens: row.outputTokens,
        estimated_cost: row.estimatedCost,
      }),
    );
  }

  async platformCostSince(sinceIso: string) {
    const rows = check(
      await this.db.from("usage_ledger").select("estimated_cost").gte("created_at", sinceIso),
    );
    return (rows as Row[]).reduce((sum, r) => sum + Number(r.estimated_cost), 0);
  }

  async upsertPurchase(input: Parameters<SystemRepo["upsertPurchase"]>[0]) {
    const existing = await this.getPurchase(input.provider, input.externalPurchaseId);
    if (existing) {
      const row = check(
        await this.db
          .from("purchases")
          .update({
            status: input.status,
            last_verified_at: new Date().toISOString(),
            ...(input.licenseKey ? { license_key: input.licenseKey } : {}),
          })
          .eq("id", existing.id)
          .select("*")
          .single(),
      );
      return { purchase: toPurchase(row as Row), created: false };
    }
    const result = await this.db
      .from("purchases")
      .insert({
        provider: input.provider,
        external_purchase_id: input.externalPurchaseId,
        product_type: input.productType,
        email: input.email.trim().toLowerCase(),
        status: input.status,
        amount_cents: input.amountCents,
        currency: input.currency,
        license_key: input.licenseKey,
        purchased_at: input.purchasedAt,
      })
      .select("*")
      .single();
    // Two pings for one sale can race; the unique key makes the loser read
    // the winner's row instead of creating a second purchase.
    if (result.error?.code === "23505") {
      const winner = await this.getPurchase(input.provider, input.externalPurchaseId);
      if (winner) return { purchase: winner, created: false };
    }
    return { purchase: toPurchase(check(result) as Row), created: true };
  }

  async getPurchase(provider: "gumroad", externalPurchaseId: string) {
    const row = check(
      await this.db
        .from("purchases")
        .select("*")
        .eq("provider", provider)
        .eq("external_purchase_id", externalPurchaseId)
        .maybeSingle(),
    );
    return row ? toPurchase(row as Row) : null;
  }

  async unclaimedPurchasesFor(email: string) {
    const rows = check(
      await this.db
        .from("purchases")
        .select("*")
        .is("user_id", null)
        .eq("email", email.trim().toLowerCase()),
    );
    return (rows as Row[]).map(toPurchase);
  }

  async attachPurchase(purchaseId: string, userId: string) {
    const row = check(
      await this.db
        .from("purchases")
        .update({ user_id: userId })
        .eq("id", purchaseId)
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .select("*")
        .maybeSingle(),
    );
    if (!row) throw new Error("purchase belongs to another account");
    return toPurchase(row as Row);
  }

  async purchasesToRecheck(sinceIso: string) {
    const rows = check(
      await this.db
        .from("purchases")
        .select("*")
        .eq("status", "paid")
        .gte("purchased_at", sinceIso),
    );
    return (rows as Row[]).map(toPurchase);
  }

  async syncEntitlement(purchase: Purchase) {
    if (!purchase.userId) return null;
    const row = check(
      await this.db
        .from("entitlements")
        .upsert(
          {
            user_id: purchase.userId,
            product_type: purchase.productType,
            payment_provider: purchase.provider,
            external_purchase_id: purchase.externalPurchaseId,
            status: purchase.status === "paid" ? "active" : "refunded",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "payment_provider,external_purchase_id" },
        )
        .select("*")
        .single(),
    );
    return toEntitlement(row as Row);
  }

  async track(event: AnalyticsEvent) {
    check(
      await this.db.from("analytics_events").insert({
        name: event.name,
        user_id: event.userId,
        anonymous_id: event.anonymousId,
        props: event.props,
        created_at: event.createdAt,
      }),
    );
  }

  async adminMetrics(): Promise<AdminMetrics> {
    const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [events, profiles, entitlements, generations, cost, users] = await Promise.all([
      this.db
        .from("analytics_events")
        .select("name,user_id,props,created_at")
        .gte("created_at", since90)
        .limit(50_000),
      this.db.from("business_profiles").select("id", { count: "exact", head: true }),
      this.db.from("entitlements").select("user_id,status"),
      this.db
        .from("generations")
        .select("status,source")
        .in("source", ["ai", "mock"])
        .limit(100_000),
      this.db.from("usage_ledger").select("estimated_cost").gte("created_at", since30),
      this.db.auth.admin.listUsers({ perPage: 1 }),
    ]);
    const ev = (check(events) as Row[]) ?? [];
    const ent = (check(entitlements) as Row[]) ?? [];
    const gen = (check(generations) as Row[]) ?? [];
    const activity = ev
      .filter((e) => e.user_id)
      .map((e) => ({ userId: e.user_id as string, at: e.created_at as string }));
    const { repeat7d, repeat30d } = repeatUsage(activity);
    const total = (users.data as { total?: number } | null)?.total;
    return {
      events: countBy(ev, (e) => e.name as string),
      users: typeof total === "number" ? total : 0,
      profilesCompleted: profiles.count ?? 0,
      activeEntitlements: ent.filter((e) => e.status === "active").length,
      refundedEntitlements: ent.filter((e) => e.status === "refunded").length,
      generations: {
        succeeded: gen.filter((g) => g.status === "succeeded").length,
        failed: gen.filter((g) => g.status === "failed").length,
      },
      costLast30Days: ((check(cost) as Row[]) ?? []).reduce(
        (s, r) => s + Number(r.estimated_cost),
        0,
      ),
      payingCustomers: new Set(ent.filter((e) => e.status === "active").map((e) => e.user_id)).size,
      repeatUsers7d: repeat7d,
      repeatUsers30d: repeat30d,
      sources: countBy(
        ev.filter((e) => e.name === "signup_completed"),
        (e) => String((e.props as Row)?.source ?? "direct"),
      ),
    };
  }

  async deleteUser(userId: string) {
    // Every customer table cascades from auth.users; purchases keep the
    // payment record with user_id set to null, as the law and refunds need.
    const { error } = await this.db.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
  }
}
