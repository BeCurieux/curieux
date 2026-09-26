/**
 * The Supabase adapter for Genome v1.
 *
 * Service role only. Every table it touches has RLS on and no policy, and
 * `rls-check.sql` proves an anon key reads none of them.
 *
 * **Unverified against a live project**, like `lib/publish/supabase.ts` before
 * it: this container cannot reach Supabase. The names it uses are
 * cross-checked against `schema.sql` by `tests/genome-v1-store-contract.test.ts`,
 * since strings do not typecheck; behaviour needs PostgREST, and the first
 * run against a real project is where to check it.
 *
 * A Genome row hangs off a `stores` row. The adapter finds it by URL and
 * refuses rather than inventing one. The store is created by ingest/publish,
 * which own the catalogue, and a Genome for a catalogue the database has
 * never seen would have nothing to be a Genome *of*.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleClient } from "@/lib/publish/supabase";
import type { ProductRecord } from "./classify";
import type { GenomeValue } from "./records";
import { PRICE_BAND_REFERENCES } from "./price-bands";
import type { EvalRun, GateVerdict, GenomeV1Store, GoldItem, GoldLabel, Labeller } from "./store";
import { DIMENSIONS, permittedValues, TAXONOMY_VERSION, valueId, type DimensionId, type ParentCategory } from "./taxonomy";

export function createSupabaseGenomeV1Store(client?: SupabaseClient): GenomeV1Store {
  const db = client ?? serviceRoleClient();

  const fail = (what: string, error: { message: string } | null): never => {
    throw new Error(`Supabase ${what} failed: ${error?.message ?? "unknown error"}`);
  };

  const storeIds = new Map<string, string>();
  const storeId = async (storeUrl: string): Promise<string> => {
    const cached = storeIds.get(storeUrl);
    if (cached) return cached;
    const { data, error } = await db.from("stores").select("id").eq("store_url", storeUrl).maybeSingle();
    if (error) fail("store lookup", error);
    if (!data) throw new Error(`No stores row for ${storeUrl}. Ingest or publish it into Supabase first.`);
    storeIds.set(storeUrl, data.id as string);
    return data.id as string;
  };

  const productIds = async (sid: string): Promise<Map<string, string>> => {
    const { data, error } = await db.from("products").select("id, handle").eq("store_id", sid);
    if (error) fail("product lookup", error);
    return new Map((data ?? []).map((r) => [r.handle as string, r.id as string]));
  };

  const toValueRow = (sid: string, ids: Map<string, string>) => (v: GenomeValue) => ({
    product_id: ids.get(v.handle),
    store_id: sid,
    dimension: v.dimension,
    value: v.value,
    layer: v.layer,
    taxonomy_version: v.taxonomyVersion,
    provenance: v.provenance,
    confidence: v.confidence,
    evidence_state: v.evidenceState,
    raw_value: v.rawValue,
    comparison_scope: v.comparisonScope,
    comparison_n: v.comparisonN,
    percentile: v.percentile,
    derived_at: v.derivedAt,
    inputs_hash: v.inputsHash,
    run_agreement: v.runAgreement,
    model: v.model,
    prompt_version: v.promptVersion,
  });

  return {
    name: "supabase",

    async saveClassification(storeUrl, products, values) {
      const sid = await storeId(storeUrl);
      const { error: upsertError } = await db.from("products").upsert(
        products.map((p) => ({
          store_id: sid,
          handle: p.handle,
          shopify_id: p.shopifyId,
          title: p.title,
          parent_category: p.parentCategory,
          inputs_hash: p.inputsHash,
          classified_with: p.classifiedWith,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "store_id,handle" },
      );
      if (upsertError) fail("product upsert", upsertError);

      const ids = await productIds(sid);
      const touched = products.map((p) => ids.get(p.handle)).filter((x): x is string => Boolean(x));
      const { error: deleteError } = await db
        .from("genome_values")
        .delete()
        .in("product_id", touched)
        .in("provenance", ["taxonomy_model", "deterministic_rule", "behaviour_inferred"]);
      if (deleteError) fail("genome value replace", deleteError);

      const rows = values.filter((v) => v.provenance !== "merchant_declared" && v.provenance !== "human_reviewed").map(toValueRow(sid, ids));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from("genome_values").insert(rows.slice(i, i + 500));
        if (error) fail("genome value insert", error);
      }
    },

    async loadClassification(storeUrl) {
      const sid = await storeId(storeUrl);
      const { data: products, error: pe } = await db.from("products").select("id, handle, shopify_id, title, parent_category, inputs_hash, classified_with").eq("store_id", sid);
      if (pe) fail("product load", pe);
      const handleOf = new Map((products ?? []).map((p) => [p.id as string, p.handle as string]));
      const { data: values, error: ve } = await db
        .from("genome_values")
        .select("product_id, dimension, value, layer, taxonomy_version, provenance, confidence, evidence_state, raw_value, comparison_scope, comparison_n, percentile, derived_at, inputs_hash, run_agreement, model, prompt_version")
        .eq("store_id", sid);
      if (ve) fail("genome value load", ve);
      return {
        products: (products ?? []).map((p) => ({
          storeUrl,
          handle: p.handle,
          shopifyId: p.shopify_id,
          title: p.title,
          parentCategory: p.parent_category as ParentCategory | null,
          inputsHash: p.inputs_hash,
          classifiedWith: p.classified_with,
        })),
        values: (values ?? []).map((v) => ({
          storeUrl,
          handle: handleOf.get(v.product_id as string)!,
          dimension: v.dimension as DimensionId,
          value: v.value,
          layer: v.layer,
          taxonomyVersion: v.taxonomy_version,
          provenance: v.provenance,
          confidence: v.confidence === null ? null : Number(v.confidence),
          evidenceState: v.evidence_state,
          rawValue: v.raw_value,
          comparisonScope: v.comparison_scope,
          comparisonN: v.comparison_n,
          percentile: v.percentile === null ? null : Number(v.percentile),
          derivedAt: v.derived_at,
          inputsHash: v.inputs_hash,
          runAgreement: v.run_agreement,
          model: v.model,
          promptVersion: v.prompt_version,
        })),
      };
    },

    async saveDeclaration(storeUrl, handle, dimension, rows) {
      const sid = await storeId(storeUrl);
      const ids = await productIds(sid);
      const pid = ids.get(handle);
      if (!pid) throw new Error(`No classified product ${handle} for ${storeUrl}. Classify the catalogue first.`);
      const { error: de } = await db.from("genome_values").delete().eq("product_id", pid).eq("dimension", dimension).eq("provenance", "merchant_declared");
      if (de) fail("declaration replace", de);
      const { error } = await db.from("genome_values").insert(rows.map(toValueRow(sid, ids)));
      if (error) fail("declaration insert", error);
    },

    async addGoldItems(items) {
      const { data, error } = await db
        .from("gold_items")
        .upsert(
          items.map((i) => ({ gold_set: i.goldSet, store_url: i.storeUrl, handle: i.handle, parent_category: i.parentCategory, snapshot: i.snapshot })),
          { onConflict: "gold_set,store_url,handle", ignoreDuplicates: false },
        )
        .select("id, gold_set, store_url, handle, parent_category, snapshot, created_at");
      if (error) fail("gold item upsert", error);
      return (data ?? []).map(toGoldItem);
    },

    async listGoldItems(goldSet) {
      let query = db.from("gold_items").select("id, gold_set, store_url, handle, parent_category, snapshot, created_at").order("created_at");
      if (goldSet) query = query.eq("gold_set", goldSet);
      const { data, error } = await query;
      if (error) fail("gold item list", error);
      return (data ?? []).map(toGoldItem);
    },

    async createLabeller(name, tokenHash) {
      const { data, error } = await db.from("labellers").insert({ name, token_hash: tokenHash }).select("id, name, token_hash, created_at, revoked_at").single();
      if (error) fail("labeller insert", error);
      return toLabeller(data!);
    },

    async findLabeller(tokenHash) {
      const { data, error } = await db.from("labellers").select("id, name, token_hash, created_at, revoked_at").eq("token_hash", tokenHash).is("revoked_at", null).maybeSingle();
      if (error) fail("labeller lookup", error);
      return data ? toLabeller(data) : null;
    },

    async listLabellers() {
      const { data, error } = await db.from("labellers").select("id, name, token_hash, created_at, revoked_at");
      if (error) fail("labeller list", error);
      return (data ?? []).map(toLabeller);
    },

    async saveLabel(label) {
      const { error } = await db.from("gold_labels").upsert(
        {
          item_id: label.itemId,
          labeller_id: label.labellerId,
          dimension: label.dimension,
          labels: label.labels,
          taxonomy_version: label.taxonomyVersion,
          labelled_at: label.labelledAt,
        },
        { onConflict: "item_id,labeller_id,dimension,taxonomy_version" },
      );
      if (error) fail("label upsert", error);
    },

    async listLabels(filter) {
      let query = db.from("gold_labels").select("item_id, labeller_id, dimension, labels, taxonomy_version, labelled_at");
      if (filter?.labellerId) query = query.eq("labeller_id", filter.labellerId);
      const { data, error } = await query;
      if (error) fail("label list", error);
      return (data ?? []).map(
        (l): GoldLabel => ({
          itemId: l.item_id,
          labellerId: l.labeller_id,
          dimension: l.dimension as DimensionId,
          labels: l.labels as string[],
          taxonomyVersion: l.taxonomy_version,
          labelledAt: l.labelled_at,
        }),
      );
    },

    async saveEvalRun(run) {
      const { data, error } = await db
        .from("eval_runs")
        .insert({ kind: run.kind, taxonomy_version: run.taxonomyVersion, prompt_version: run.promptVersion, model: run.model, config: run.config, metrics: run.metrics })
        .select("id, kind, taxonomy_version, prompt_version, model, config, metrics, created_at")
        .single();
      if (error) fail("eval run insert", error);
      return toEvalRun(data!);
    },

    async listEvalRuns() {
      const { data, error } = await db.from("eval_runs").select("id, kind, taxonomy_version, prompt_version, model, config, metrics, created_at").order("created_at");
      if (error) fail("eval run list", error);
      return (data ?? []).map(toEvalRun);
    },

    async saveGate(verdicts) {
      const { error } = await db.from("taxonomy_gate").upsert(
        verdicts.map((v) => ({
          taxonomy_version: v.taxonomyVersion,
          dimension: v.dimension,
          kappa: v.kappa,
          items: v.items,
          verdict: v.verdict,
          eval_run_id: v.evalRunId,
          decided_at: v.decidedAt,
        })),
        { onConflict: "taxonomy_version,dimension" },
      );
      if (error) fail("gate upsert", error);
    },

    async listGate(taxonomyVersion) {
      const { data, error } = await db.from("taxonomy_gate").select("taxonomy_version, dimension, kappa, items, verdict, eval_run_id, decided_at").eq("taxonomy_version", taxonomyVersion);
      if (error) fail("gate list", error);
      return (data ?? []).map(
        (g): GateVerdict => ({
          taxonomyVersion: g.taxonomy_version,
          dimension: g.dimension as DimensionId,
          kappa: g.kappa === null ? null : Number(g.kappa),
          items: g.items,
          verdict: g.verdict,
          evalRunId: g.eval_run_id,
          decidedAt: g.decided_at,
        }),
      );
    },
  };
}

/**
 * Publish the taxonomy and price bands from code into the database. Upserts,
 * so re-running is safe. It never deletes, because a released value is never
 * removed.
 */
export async function seedTaxonomy(client?: SupabaseClient): Promise<{ values: number; bands: number }> {
  const db = client ?? serviceRoleClient();
  const check = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`Supabase ${what} failed: ${error.message}`);
  };

  check("taxonomy version upsert", (await db.from("taxonomy_versions").upsert({ version: TAXONOMY_VERSION, status: "active" }, { onConflict: "version" })).error);

  const values = DIMENSIONS.flatMap((d) =>
    permittedValues(d.id).map((value) => {
      const def = d.values.find((x) => x.id === value);
      return {
        version: TAXONOMY_VERSION,
        dimension: d.id,
        value,
        value_id: valueId(d.id, value),
        layer: d.layer,
        label: def?.label ?? "Unknown",
        definition: def?.definition ?? "The evidence does not support any other value.",
      };
    }),
  );
  check("taxonomy value upsert", (await db.from("taxonomy_values").upsert(values, { onConflict: "version,value_id" })).error);

  const bands = PRICE_BAND_REFERENCES.map((r) => ({
    version: TAXONOMY_VERSION,
    parent_category: r.parentCategory,
    currency: r.currency,
    budget_max: r.budgetMax,
    mid_max: r.midMax,
    premium_max: r.premiumMax,
  }));
  check("price band upsert", (await db.from("price_band_references").upsert(bands, { onConflict: "version,parent_category,currency" })).error);

  return { values: values.length, bands: bands.length };
}

const toGoldItem = (r: Record<string, any>): GoldItem => ({
  id: r.id,
  goldSet: r.gold_set,
  storeUrl: r.store_url,
  handle: r.handle,
  parentCategory: r.parent_category,
  snapshot: r.snapshot,
  createdAt: r.created_at,
});

const toLabeller = (r: Record<string, any>): Labeller => ({
  id: r.id,
  name: r.name,
  tokenHash: r.token_hash,
  createdAt: r.created_at,
  revokedAt: r.revoked_at,
});

const toEvalRun = (r: Record<string, any>): EvalRun => ({
  id: r.id,
  kind: r.kind,
  taxonomyVersion: r.taxonomy_version,
  promptVersion: r.prompt_version,
  model: r.model,
  config: r.config,
  metrics: r.metrics,
  createdAt: r.created_at,
});
