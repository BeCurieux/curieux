/**
 * The YAML seed directory → validated rules.
 *
 *   rules/{market}/{category}/{rule_key}.yaml
 *
 * Market, category and rule key come from the path, so the file cannot
 * disagree with where it lives: a file that also states one of them must state
 * the same value, or it is refused. Every file is validated against the rule
 * schema and every problem in the directory is reported at once, with the
 * file it came from — a founder fixing rules one error per run would stop
 * running the loader.
 *
 * This is the only part of the rules pipeline that touches the filesystem;
 * the engine takes what it returns as data.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { MARKET_CODES, Rule, type MarketCode } from "../engine/rules.js";
import { createSnapshot, type RulesSnapshot } from "../engine/snapshot.js";

export class RulesLoadError extends Error {
  constructor(readonly problems: string[]) {
    super(`${problems.length} problem${problems.length === 1 ? "" : "s"} in the rules directory:\n  ${problems.join("\n  ")}`);
    this.name = "RulesLoadError";
  }
}

export type LoadedRule = { file: string; rule: Rule };

export async function loadRules(root: string): Promise<LoadedRule[]> {
  const problems: string[] = [];
  const loaded: LoadedRule[] = [];

  for (const marketDir of await dirs(root)) {
    const market = marketDir.toUpperCase() as MarketCode;
    if (!MARKET_CODES.includes(market)) {
      problems.push(`${marketDir}/: not a market (expected one of ${MARKET_CODES.map((m) => m.toLowerCase()).join(", ")})`);
      continue;
    }
    for (const category of await dirs(path.join(root, marketDir))) {
      const dir = path.join(root, marketDir, category);
      const files = (await readdir(dir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml")).sort();
      for (const file of files) {
        const relative = path.join(marketDir, category, file);
        const rule_key = file.replace(/\.ya?ml$/, "");
        const result = parseRuleFile(await readFile(path.join(dir, file), "utf8"), { market, category, rule_key });
        if (result.ok) loaded.push({ file: relative, rule: result.rule });
        else problems.push(...result.problems.map((p) => `${relative}: ${p}`));
      }
    }
  }

  if (problems.length > 0) throw new RulesLoadError(problems);
  return loaded;
}

export async function loadSnapshot(root: string): Promise<RulesSnapshot> {
  return createSnapshot((await loadRules(root)).map((l) => l.rule));
}

type FromPath = { market: MarketCode; category: string; rule_key: string };

export function parseRuleFile(source: string, from: FromPath): { ok: true; rule: Rule } | { ok: false; problems: string[] } {
  let body: unknown;
  try {
    body = parse(source);
  } catch (error) {
    return { ok: false, problems: [`not valid YAML: ${error instanceof Error ? error.message : String(error)}`] };
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, problems: ["expected one rule (a YAML mapping) per file"] };
  }

  const record = body as Record<string, unknown>;
  const problems: string[] = [];
  for (const [key, expected] of Object.entries(from)) {
    if (key in record && record[key] !== expected) {
      problems.push(`${key} is ${JSON.stringify(record[key])} but the path says ${JSON.stringify(expected)}`);
    }
  }
  if (problems.length > 0) return { ok: false, problems };

  const parsed = Rule.safeParse({ ...record, ...from });
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => `${i.path.length > 0 ? i.path.join(".") : "rule"}: ${i.message}`),
    };
  }
  return { ok: true, rule: parsed.data };
}

async function dirs(at: string): Promise<string[]> {
  const entries = await readdir(at, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}
