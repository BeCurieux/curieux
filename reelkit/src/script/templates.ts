/**
 * Three ads written without a model.
 *
 * These are the floor: what the seller gets with no API key, and what replaces
 * any model draft that fails `check.ts`. They only ever rearrange the seller's
 * own words, so they pass the check by construction — `tests/script.test.ts`
 * holds them to it anyway.
 */

import { clip } from "../product/text.js";
import type { Facts } from "./facts.js";
import { LIMITS, type AdScript, type Angle } from "./types.js";

const fit = (s: string, max: number) => clip(s, max);

function cta(f: Facts, verb: string): string {
  return f.marketplace === "etsy" ? fit(`${verb} on Etsy`, LIMITS.cta) : fit(verb, LIMITS.cta);
}

/** Pad to the minimum scene count with things that are always true. */
function scenes(f: Facts, lines: string[], start: number): AdScript["scenes"] {
  const pool = [...lines];
  if (pool.length < LIMITS.minScenes) pool.push(f.name);
  if (pool.length < LIMITS.minScenes && f.price) pool.push(f.price);
  if (pool.length < LIMITS.minScenes && f.shop) pool.push(`From ${f.shop}`);
  if (pool.length < LIMITS.minScenes) pool.push(f.title);
  return pool.slice(0, 3).map((caption, i) => ({
    caption: fit(caption, LIMITS.caption),
    image: (start + i + 1) % f.imageCount,
  }));
}

function priced(f: Facts, line: string): string {
  return f.price ? fit(`${line} · ${f.price}`, LIMITS.caption) : fit(line, LIMITS.caption);
}

const WRITERS: Record<Angle, (f: Facts) => AdScript> = {
  showcase(f) {
    const hook = `Meet the ${f.name}`.length <= LIMITS.hook ? `Meet the ${f.name}` : "You need to see this";
    const lines = f.highlights.slice(0, 2);
    lines.push(priced(f, f.name));
    return { angle: "showcase", hook, hookImage: 0, scenes: scenes(f, lines, 0), cta: cta(f, "Shop now") };
  },
  gift(f) {
    const lines = [f.name, ...f.highlights.slice(2, 3), ...f.highlights.slice(0, 1)];
    if (f.price) lines.push(priced(f, "A gift idea"));
    return {
      angle: "gift",
      hook: "Looking for a gift?",
      hookImage: 1 % f.imageCount,
      scenes: scenes(f, [...new Set(lines)], 1),
      cta: cta(f, "Get yours"),
    };
  },
  details(f) {
    const lines = f.highlights.length >= 2 ? f.highlights.slice(-3) : [f.name, ...f.highlights];
    return {
      angle: "details",
      hook: "Take a closer look",
      hookImage: 2 % f.imageCount,
      scenes: scenes(f, lines, 2),
      cta: cta(f, "See every detail"),
    };
  },
};

export function templateScript(angle: Angle, facts: Facts): AdScript {
  return WRITERS[angle](facts);
}
