// Applying what the family told us.
//
// buildEntities() produces one entity per tag key: `person:mimi` and
// `person:grandma sue` are two threads, because from the archive's point of
// view they are two words. This is the step that turns them into one
// grandmother, using nothing but an answer somebody gave.
//
// It sits *after* the graph is built rather than inside it, and that
// separation is the point. buildEntities is arithmetic over what a family
// typed and has no memory between runs. This is the layer that remembers.
// Keeping them apart means the counting stays testable without a database,
// and the knowing stays auditable — every merge here traces to a row in
// entity_resolutions with a person's id on it.
//
// What it does not do: decide anything. A resolution arrives or it does not.

import type { Entity } from "./presence";

export interface Resolution {
  /**
   * The entity this resolves to. A uuid from the entities table, so the
   * merged thread has a durable identity rather than a string that changes
   * the moment somebody renames a tag.
   */
  id: string;
  /** What to call it. The family's choice, not the most frequent spelling. */
  label: string;
  /**
   * The graph ids that are all this one thing — `person:mimi`,
   * `person:grandma sue`. Stored as entity aliases.
   */
  keys: string[];
}

/**
 * One graph, with the family's answers applied.
 *
 * Merged threads take the resolution's label and id and the union of the
 * mentions. A resolution naming keys that are not in this graph is ignored
 * rather than being an error: a book covering one year legitimately does not
 * contain every person a family has ever resolved.
 */
export function applyResolutions(entities: Entity[], resolutions: Resolution[]): Entity[] {
  if (resolutions.length === 0) return entities;

  const canonical = new Map<string, Resolution>();
  for (const r of resolutions) {
    for (const key of r.keys) canonical.set(key, r);
  }

  const merged = new Map<string, Entity>();
  const untouched: Entity[] = [];

  for (const entity of entities) {
    const r = canonical.get(entity.id);
    if (!r) {
      untouched.push(entity);
      continue;
    }

    const already = merged.get(r.id);
    if (!already) {
      merged.set(r.id, { ...entity, id: r.id, label: r.label, mentions: [...entity.mentions] });
      continue;
    }

    // Keyed by memory id, so a memory tagged with both names counts once.
    // Without this, resolving two names a family uses interchangeably would
    // *inflate* the count — and the weekly note would announce a surge that
    // was an administrative event.
    const seen = new Set(already.mentions.map((m) => m.memoryId));
    for (const m of entity.mentions) {
      if (!seen.has(m.memoryId)) {
        already.mentions.push(m);
        seen.add(m.memoryId);
      }
    }
  }

  return [...untouched, ...merged.values()].sort(
    (a, b) => b.mentions.length - a.mentions.length
  );
}

/**
 * Every pair a family has already ruled on, as keys for identity.ts.
 *
 * Both answers count. A "yes" is here because the pair no longer exists to
 * ask about; a "no" is here because it does exist and must never be raised
 * again.
 */
export function settledPairs(rows: { pair_key: string }[]): string[] {
  return rows.map((r) => r.pair_key);
}
