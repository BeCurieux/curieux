// Provenance system (brief §14).
// Every AI-generated factual statement must retain references to the source
// memories/answers that support it. Statements without support are rejected
// before they ever reach a page.

import type { ContentBlockDraft, SourceRef } from "@/lib/types";

const FACTUAL_TYPES = new Set(["text", "caption", "quote"]);

export interface ProvenanceVerdict {
  ok: boolean;
  errors: string[];
}

/** A single block is valid if it is parent-authored, non-factual, or cited. */
export function validateBlock(block: ContentBlockDraft): ProvenanceVerdict {
  const errors: string[] = [];
  if (block.ai_generated && FACTUAL_TYPES.has(block.type)) {
    if (!Array.isArray(block.source_ids) || block.source_ids.length === 0) {
      errors.push(`ai-generated ${block.type} block has no sources: "${truncate(block.content)}"`);
    }
  }
  for (const ref of block.source_ids ?? []) {
    if (!isValidRef(ref)) errors.push(`malformed source ref: ${JSON.stringify(ref)}`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validate that every cited source actually exists in the known source set.
 * Guards against the model hallucinating memory ids.
 */
export function validateSourcesExist(
  block: ContentBlockDraft,
  knownIds: Set<string>
): ProvenanceVerdict {
  const errors: string[] = [];
  for (const ref of block.source_ids ?? []) {
    if (isValidRef(ref) && !knownIds.has(ref.id)) {
      errors.push(`source ${ref.kind}:${ref.id} does not exist`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Filter AI-drafted blocks down to those with valid, existing provenance.
 * Invalid blocks are omitted — never repaired or invented (§29).
 */
export function enforceProvenance(
  blocks: ContentBlockDraft[],
  knownIds: Set<string>
): { kept: ContentBlockDraft[]; rejected: { block: ContentBlockDraft; errors: string[] }[] } {
  const kept: ContentBlockDraft[] = [];
  const rejected: { block: ContentBlockDraft; errors: string[] }[] = [];
  for (const block of blocks) {
    const structural = validateBlock(block);
    const existence = validateSourcesExist(block, knownIds);
    const errors = [...structural.errors, ...existence.errors];
    if (errors.length === 0) kept.push(block);
    else rejected.push({ block, errors });
  }
  return { kept, rejected };
}

function isValidRef(ref: unknown): ref is SourceRef {
  return (
    typeof ref === "object" && ref !== null &&
    ["memory", "answer", "little_thing"].includes((ref as SourceRef).kind) &&
    typeof (ref as SourceRef).id === "string" && (ref as SourceRef).id.length > 0
  );
}

function truncate(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
