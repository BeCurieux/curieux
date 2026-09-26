/**
 * The Supabase adapter for POPs. Service role only; see `schema.sql`.
 *
 * Unverified against a live project, like the other adapters: this container
 * cannot reach Supabase. Its select strings are cross-checked against
 * `schema.sql` by `tests/publish-supabase-contract.test.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleClient } from "@/lib/publish/supabase";
import type { PopDecision } from "./decisions";
import { popFields, versionFields, type PopRecord, type PopStore, type PopVersionRecord } from "./store";

export function createSupabasePopStore(client?: SupabaseClient): PopStore {
  const db = client ?? serviceRoleClient();
  const fail = (what: string, error: { message: string } | null): never => {
    throw new Error(`Supabase ${what} failed: ${error?.message ?? "unknown error"}`);
  };

  return {
    name: "supabase",

    async record(input) {
      const fields = popFields(input);
      const { data: pop, error: pe } = await db
        .from("pops")
        .upsert(
          {
            shop_slug: input.shopSlug,
            sentence: fields.sentence,
            brief: fields.brief,
            locked_handles: fields.lockedHandles,
            excluded_handles: fields.excludedHandles,
          },
          { onConflict: "shop_slug" },
        )
        .select("id, shop_slug, sentence, brief, status, locked_handles, excluded_handles, created_at")
        .single();
      if (pe) fail("pop upsert", pe);

      const { count, error: ce } = await db.from("pop_versions").select("id", { count: "exact", head: true }).eq("pop_id", pop!.id);
      if (ce) fail("pop version count", ce);

      const v = versionFields(input);
      const { data: version, error: ve } = await db
        .from("pop_versions")
        .insert({
          pop_id: pop!.id,
          shop_version_id: v.shopVersionId,
          version: (count ?? 0) + 1,
          brief: v.brief,
          shortlist: v.shortlist,
          excluded: v.excluded,
          repairs: v.repairs,
          taxonomy_version: v.taxonomyVersion,
          brief_prompt_version: v.briefPromptVersion,
        })
        .select("id, pop_id, shop_version_id, version, brief, shortlist, excluded, repairs, taxonomy_version, brief_prompt_version, created_at")
        .single();
      if (ve) fail("pop version insert", ve);

      if (v.decisions.length) {
        const { error: de } = await db.from("pop_decisions").insert(
          v.decisions.map((d) => ({
            pop_version_id: version!.id,
            handle: d.handle,
            position: d.position,
            role: d.role,
            reason: d.reason,
            concepts: d.concepts,
            score: d.score,
            is_exploration: false,
            decision_source: d.decisionSource,
          })),
        );
        if (de) fail("pop decision insert", de);
      }
      return { pop: toPop(pop!), version: toVersion(version!, v.decisions) };
    },

    async find(slug) {
      const { data: pop, error: pe } = await db
        .from("pops")
        .select("id, shop_slug, sentence, brief, status, locked_handles, excluded_handles, created_at")
        .eq("shop_slug", slug)
        .maybeSingle();
      if (pe) fail("pop lookup", pe);
      if (!pop) return null;
      const { data: versions, error: ve } = await db
        .from("pop_versions")
        .select("id, pop_id, shop_version_id, version, brief, shortlist, excluded, repairs, taxonomy_version, brief_prompt_version, created_at")
        .eq("pop_id", pop.id)
        .order("version");
      if (ve) fail("pop version list", ve);
      const ids = (versions ?? []).map((v) => v.id as string);
      const { data: decisions, error: de } = ids.length
        ? await db.from("pop_decisions").select("pop_version_id, handle, position, role, reason, concepts, score, decision_source").in("pop_version_id", ids).order("position")
        : { data: [], error: null };
      if (de) fail("pop decision list", de);
      return {
        pop: toPop(pop),
        versions: (versions ?? []).map((v) =>
          toVersion(
            v,
            (decisions ?? [])
              .filter((d) => d.pop_version_id === v.id)
              .map((d) => ({
                handle: d.handle,
                position: d.position,
                role: d.role,
                reason: d.reason,
                concepts: d.concepts,
                score: Number(d.score ?? 0),
                isExploration: false,
                decisionSource: d.decision_source,
              })),
          ),
        ),
      };
    },
  };
}

const toPop = (r: Record<string, any>): PopRecord => ({
  id: r.id,
  shopSlug: r.shop_slug,
  sentence: r.sentence,
  brief: r.brief,
  status: r.status,
  lockedHandles: r.locked_handles,
  excludedHandles: r.excluded_handles,
  createdAt: r.created_at,
});

const toVersion = (r: Record<string, any>, decisions: PopDecision[]): PopVersionRecord => ({
  id: r.id,
  popId: r.pop_id,
  shopVersionId: r.shop_version_id,
  version: r.version,
  brief: r.brief,
  shortlist: r.shortlist,
  excluded: r.excluded,
  repairs: r.repairs,
  taxonomyVersion: r.taxonomy_version,
  briefPromptVersion: r.brief_prompt_version,
  decisions,
  createdAt: r.created_at,
});
