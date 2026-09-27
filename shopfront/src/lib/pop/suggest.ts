/**
 * Which POPs can this catalogue make well?
 *
 * One Father's Day page is a feature; twenty self-maintaining shops, one per
 * audience and occasion, is a product. This reads the Genome and proposes the
 * campaign shops a catalogue has real depth for: occasion × audience ×
 * (optionally) use context, each with enough confident, buyable products, a
 * price cap that keeps most of them, and a ready brief. No model is called;
 * it costs nothing.
 *
 * Each suggestion is ranked by how many products fit **and how many of them a
 * keyword collection would miss**. The second number is the one that matters:
 * a suggestion whose products all say "dad" in the title is a collection the
 * merchant already has. It also doubles as the kill-test screen. A store with
 * several suggestions that are mostly Genome-only is a store where POPUUP has
 * something to show. A store with none is one to skip.
 */

import type { Catalogue } from "@/lib/ingest/types";
import { resolve, type GenomeValue } from "@/lib/genome/v1/records";
import { dimension, UNKNOWN } from "@/lib/genome/v1/taxonomy";
import { PopBrief, TARGET_DIMENSIONS, type TargetDimension } from "./brief";
import { collectionBaseline } from "./baseline";

export interface Suggestion {
  sentence: string;
  brief: PopBrief;
  /** Products that fit, in catalogue order. */
  handles: string[];
  /** Of those, how many no keyword collection would find. */
  genomeOnly: string[];
  priceCap: number | null;
  rank: number;
}

const OCCASION_WORDS: Record<string, string> = {
  mothers_day: "Mother's Day",
  fathers_day: "Father's Day",
  christmas_holiday: "Christmas",
  valentines: "Valentine's Day",
  birthday: "birthday",
  summer_travel: "summer getaway",
};

const CONTEXT_PHRASES: Record<string, string> = {
  water_coastal: "who love the water",
  outdoor: "who love the outdoors",
  travel: "who travel",
  work: "who work with their hands",
  home: "who love being at home",
  fitness: "who train",
  social_evening: "who love a night out",
  personal_care: "who look after themselves",
};

function audiencePhrase(audience: string, occasion: string): string {
  if (audience === "men") return occasion === "fathers_day" ? "dads" : "him";
  if (audience === "women") return occasion === "mothers_day" ? "mums" : "her";
  if (audience === "kids") return "kids";
  if (audience === "baby") return "little ones";
  if (audience === "household") return "the home";
  return "everyone";
}

const NICE_CAPS = [25, 30, 40, 50, 60, 75, 80, 100, 120, 150, 200, 250, 300, 400, 500];

/** The smallest round cap that keeps ≥75% of these prices and at least `min` of them; null if none does. */
export function niceCap(prices: readonly number[], min: number): number | null {
  const sorted = [...prices].sort((a, b) => a - b);
  for (const cap of NICE_CAPS) {
    const kept = sorted.filter((p) => p <= cap).length;
    if (kept >= min && kept / sorted.length >= 0.75) return cap;
  }
  return null;
}

export interface SuggestOptions {
  /** Fewest products a POP should have. */
  minProducts?: number;
  /** Minimum measured confidence for an occasion to count (0.8 = four runs of five). */
  minConfidence?: number;
  limit?: number;
  currencySymbol?: string;
}

export function suggestPops(catalogue: Catalogue, genome: readonly GenomeValue[], options: SuggestOptions = {}): Suggestion[] {
  const min = options.minProducts ?? 6;
  const minConfidence = options.minConfidence ?? 0.8;
  const symbol = options.currencySymbol ?? (catalogue.currency === "GBP" ? "£" : catalogue.currency === "EUR" ? "€" : "$");

  const byHandle = new Map<string, GenomeValue[]>();
  for (const v of resolve(genome)) byHandle.set(v.handle, [...(byHandle.get(v.handle) ?? []), v]);
  const confident = (handle: string, dim: string) =>
    (byHandle.get(handle) ?? []).filter((v) => v.dimension === dim && v.value !== UNKNOWN && (v.confidence ?? 0) >= minConfidence).map((v) => v.value);

  const buyable = catalogue.products.filter((p) => p.availabilityKnown && p.available && p.variants.some((v) => v.available));
  const price = new Map(buyable.map((p) => [p.handle, Math.min(...p.variants.filter((v) => v.available).map((v) => v.price))]));

  // occasion|audience|context → handles
  const combos = new Map<string, Set<string>>();
  const add = (key: string, handle: string) => combos.set(key, (combos.get(key) ?? new Set()).add(handle));
  for (const p of buyable) {
    const occasions = confident(p.handle, "occasion_fit").filter((o) => o in OCCASION_WORDS);
    const audiences = confident(p.handle, "audience_fit");
    const fits = audiences.includes("unisex_adult") ? [...new Set([...audiences, "men", "women"])] : audiences;
    const contexts = confident(p.handle, "use_context");
    for (const o of occasions) {
      for (const a of fits.filter((x) => x !== "unisex_adult")) {
        add(`${o}|${a}|`, p.handle);
        for (const c of contexts) add(`${o}|${a}|${c}`, p.handle);
      }
    }
  }

  const out: Suggestion[] = [];
  for (const [key, set] of combos) {
    if (set.size < min) continue;
    const [occasion, audience, context] = key.split("|") as [string, string, string];
    const handles = buyable.map((p) => p.handle).filter((h) => set.has(h));
    const cap = niceCap(handles.map((h) => price.get(h)!), min);
    const within = cap === null ? handles : handles.filter((h) => price.get(h)! <= cap);
    const who = `${audiencePhrase(audience, occasion)}${context ? ` ${CONTEXT_PHRASES[context] ?? ""}` : ""}`.trim();
    const occasionWords = OCCASION_WORDS[occasion]!;
    const sentence = `Make a ${occasionWords} shop for ${who}.${cap !== null ? ` Under ${symbol}${cap}.` : ""}`;
    const targets = Object.fromEntries(TARGET_DIMENSIONS.map((d) => [d, [] as string[]])) as Record<TargetDimension, string[]>;
    if (context) targets.use_context.push(context);
    const brief = PopBrief.parse({
      sentence,
      who: { audienceFit: [audience], persona: who },
      why: { occasionFit: [occasion], campaign: dimension("occasion_fit").values.find((v) => v.id === occasion)?.label ?? null },
      goal: "conversion",
      rules: { priceMax: cap, priceScope: "per_item", minUnits: null, includeHandles: [], excludeHandles: [], shipBy: null, marginMin: null },
      targets,
      mentions: [],
      ruleSource: { priceMax: cap === null ? "none" : "pattern" },
    });
    const baseline = collectionBaseline(catalogue, brief, within);
    out.push({
      sentence,
      brief,
      handles: within,
      genomeOnly: baseline.popOnly,
      priceCap: cap,
      // Depth up to a full page, then what keywords would miss counts double.
      rank: Math.min(within.length, 12) + 2 * baseline.popOnly.length - (context ? 0 : 0.5),
    });
  }

  // A context-narrowed POP that shows exactly its parent's products adds nothing.
  const deduped = out.filter((s) => {
    const parent = out.find((o) => o !== s && o.brief.targets.use_context.length === 0 && o.brief.why.occasionFit[0] === s.brief.why.occasionFit[0] && o.brief.who.audienceFit[0] === s.brief.who.audienceFit[0]);
    return !(s.brief.targets.use_context.length && parent && parent.handles.join() === s.handles.join());
  });
  return deduped.filter((s) => s.handles.length >= min).sort((a, b) => b.rank - a.rank || a.sentence.localeCompare(b.sentence)).slice(0, options.limit ?? 10);
}

/** The kill-test reading of a catalogue: is there something here keywords could not make? */
export function catalogueVerdict(suggestions: readonly Suggestion[]): { viable: number; genomeLed: number; verdict: "strong" | "thin" | "skip" } {
  const genomeLed = suggestions.filter((s) => s.genomeOnly.length / s.handles.length >= 0.3).length;
  const verdict = genomeLed >= 3 ? "strong" : suggestions.length >= 2 ? "thin" : "skip";
  return { viable: suggestions.length, genomeLed, verdict };
}
