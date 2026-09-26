/**
 * The POP engine (HANDOFF §7): brief → hard filter → score → assemble →
 * validate → decisions.
 *
 * The assembly step is the existing merchandiser, unchanged, handed a
 * catalogue that contains **only the shortlist**. That is how "the model may
 * only choose from the candidate set" is enforced structurally, not by
 * instruction: the merchandiser already refuses any handle that is not in the
 * catalogue it was given, and here that catalogue is the candidates. The
 * renderer, publishing and the funnel then work on a POP exactly as on any
 * other shop. The AI still fills a schema and never writes markup
 * (`CLAUDE.md`).
 *
 * This is M2's public-path engine, opened on the owner's call (2026-09-26).
 * The embedded admin (brief chips, lock/remove in a UI) needs the installed
 * app and stays behind the kill-test gate with M0.
 */

import type { CatalogueGenome } from "@/lib/genome/types";
import type { GenomeValue } from "@/lib/genome/v1/records";
import type { IngestResult } from "@/lib/ingest/types";
import { merchandise, type MerchandiseResult } from "@/lib/merchandise/index";
import type { MerchandiseProvider } from "@/lib/merchandise/provider";
import type { ShopConfig } from "@/lib/schema";
import { BriefError, targetsOf, unenforceable, type PopBrief } from "./brief";
import { decisionsFor, type PopDecision } from "./decisions";
import { hardFilter, type Excluded } from "./filter";
import { guardPop } from "./guard";
import { scoreCandidates, shortlist as cut, type Scored } from "./score";

export interface PopOptions {
  ingest: IngestResult;
  brief: PopBrief;
  /** Genome v1 values for this store; resolved (merchant declarations win) inside. */
  genome: readonly GenomeValue[];
  /** The v0 Genome the merchandiser already reads, if the store has one. */
  legacyGenome?: CatalogueGenome;
  provider?: MerchandiseProvider;
  /** How many ranked candidates the model assembles from. */
  shortlistSize?: number;
  /** What the public path cannot know; true only with the installed app. */
  facts?: { hasUnits: boolean; hasCost: boolean };
  now?: () => Date;
}

export interface PopResult {
  config: ShopConfig;
  brief: PopBrief;
  shortlist: Scored[];
  excluded: Excluded[];
  decisions: PopDecision[];
  repairs: string[];
  warnings: string[];
  merchandise: MerchandiseResult["diagnostics"];
}

export const DEFAULT_SHORTLIST = 24;

export async function generatePop(options: PopOptions): Promise<PopResult> {
  const { ingest, brief } = options;

  // 1. Rules this path cannot check are refused before anything is spent.
  const refused = unenforceable(brief, options.facts ?? { hasUnits: false, hasCost: false });
  if (refused.length) throw new BriefError(`The brief has rules this POP could not keep:\n- ${refused.join("\n- ")}`);

  // 2. Hard filter, in code.
  const filtered = hardFilter(ingest.catalogue, brief);
  if (filtered.conflicts.length) throw new BriefError(`The brief contradicts itself:\n- ${filtered.conflicts.join("\n- ")}`);
  if (filtered.candidates.length === 0) {
    throw new BriefError(`Nothing in ${ingest.store.storeUrl} passes the rules (${filtered.excluded.length} products excluded). Loosen the brief.`);
  }

  // 3. Score and cut.
  const warnings: string[] = [];
  const scored = scoreCandidates(filtered.candidates, brief, options.genome);
  const unclassified = scored.filter((s) => !s.classified).length;
  if (unclassified === scored.length) warnings.push("No Genome v1 for this store: candidates are ranked on the brief alone. Run `pnpm genome:classify` first.");
  else if (unclassified) warnings.push(`${unclassified} of ${scored.length} candidates have no Genome v1 values.`);
  const shortlist = cut(scored, options.shortlistSize ?? DEFAULT_SHORTLIST);

  // 4. Assemble, from the shortlist and nothing else.
  const restricted: IngestResult = {
    ...ingest,
    catalogue: {
      ...ingest.catalogue,
      products: shortlist.map((s) => s.candidate.product),
      productCount: shortlist.length,
      truncated: false,
    },
  };
  const assembled = await merchandise(restricted, assemblyPrompt(brief, shortlist), {
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.legacyGenome ? { genome: options.legacyGenome } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  // The page's provenance is the merchant's sentence, not our working.
  const config: ShopConfig = { ...assembled.config, meta: { ...assembled.config.meta, prompt: brief.sentence } };

  // 5. Validate against the rules again, in code; repair, and say so.
  const guarded = guardPop(config, brief, shortlist);

  // 6. The decision log.
  const decisions = decisionsFor(guarded.config, shortlist, guarded.added);

  return {
    config: guarded.config,
    brief,
    shortlist,
    excluded: filtered.excluded,
    decisions,
    repairs: guarded.repairs,
    warnings: [...warnings, ...assembled.diagnostics.warnings],
    merchandise: assembled.diagnostics,
  };
}

/**
 * What the merchandiser is told: the merchant's sentence first and verbatim,
 * then the brief as settled, then the ranking and why. The ranking is advice;
 * the shortlist is the constraint, and it is enforced by what the catalogue
 * contains rather than by anything written here.
 */
export function assemblyPrompt(brief: PopBrief, shortlist: readonly Scored[]): string {
  const targets = [...targetsOf(brief)].filter(([, v]) => v.size).map(([d, v]) => `${d}: ${[...v].join(", ")}`);
  const lines = [
    brief.sentence,
    "",
    "This is a campaign shop (a POP). The brief, as the merchant confirmed it:",
    `- For: ${brief.who.persona || "(not stated)"}`,
    ...(brief.why.campaign ? [`- Occasion: ${brief.why.campaign}`] : []),
    `- Goal: ${brief.goal}`,
    ...(brief.rules.priceMax !== null ? [`- Every product is already at or under ${brief.rules.priceMax} per item.`] : []),
    ...(targets.length ? [`- Concepts: ${targets.join("; ")}`] : []),
    "",
    "Every product in the catalogue below has already passed the merchant's rules and is ranked for this brief, best first. Lead with the strongest hero among the top of the ranking, and choose the rest in roughly this order unless a lower-ranked product clearly serves the brief better.",
    "",
    ...shortlist.map((s, i) => `${i + 1}. ${s.candidate.product.handle}${s.locked ? " (locked in by the merchant: must appear)" : ""}${s.matched.length ? ` — ${s.matched.join(", ")}` : ""}`),
  ];
  return lines.join("\n");
}
