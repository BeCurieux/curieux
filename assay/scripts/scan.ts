/**
 * `pnpm scan` — the whole engine from a terminal, with no key and no network.
 *
 * Built for the kill test in the brief's §10: thirty real pages, read by hand,
 * before any of the product around this exists. A founder pastes a page in,
 * gets the findings and the arithmetic out, and writes the score card from
 * that rather than from memory. It is also the fastest way to feel whether a
 * rule is too loud, which is the thing rule authoring gets wrong first.
 *
 *   pnpm scan --text "Clinically proven to clear acne in 7 days."
 *   pnpm scan --file ./page.txt --markets AU,EU
 *   pnpm scan --file ./page.txt --json > result.json
 */

import { readFileSync } from "node:fs";
import { scan, weakestMarket } from "../src/engine/evaluate.js";
import { badgeEligible } from "../src/engine/score.js";
import { supportedJurisdictions } from "../src/engine/registry.js";
import { citationLabel } from "../src/engine/framing.js";
import type { Jurisdiction, ScanResult } from "../src/engine/types.js";

type Options = { text: string; markets: Jurisdiction[]; json: boolean; reference?: string };

function parse(argv: string[]): Options {
  let text: string | undefined;
  let reference: string | undefined;
  let markets = supportedJurisdictions();
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--text" && next !== undefined) {
      text = next;
      i += 1;
    } else if (arg === "--file" && next !== undefined) {
      text = readFileSync(next, "utf8");
      reference = next;
      i += 1;
    } else if (arg === "--markets" && next !== undefined) {
      markets = next.split(",").map((m) => m.trim().toUpperCase()) as Jurisdiction[];
      i += 1;
    } else if (arg === "--json") {
      json = true;
    } else if (arg && !arg.startsWith("--") && text === undefined) {
      text = arg;
    }
  }

  if (text === undefined) {
    throw new Error(
      "Nothing to scan. Pass copy as --text \"…\", a path as --file ./page.txt, or the copy as the first argument.\n" +
        `Markets available: ${supportedJurisdictions().join(", ")}.`,
    );
  }
  return { text, markets, json, reference };
}

const BAR = "─".repeat(72);

function render(result: ScanResult): string {
  const lines: string[] = [];
  const weakest = weakestMarket(result);

  lines.push(BAR);
  lines.push(`Claim Confidence  ${result.score.value}/100   ${result.score.band.toUpperCase()}`);
  lines.push(
    `Markets           ${result.jurisdictions
      .map((j) => `${j} ${result.byJurisdiction[j]?.value ?? "—"}`)
      .join("   ")}   (headline is ${weakest}, the weakest)`,
  );
  lines.push(`Badge             ${badgeEligible(result.score) ? "eligible" : "not eligible"}`);
  lines.push(`Read              ${result.claims.length} claims, ${result.findings.length} findings`);
  lines.push(BAR);

  if (result.findings.length === 0) {
    lines.push("Nothing in this copy trips a rule in the selected markets.");
  }

  for (const finding of result.findings) {
    lines.push("");
    lines.push(`[${finding.jurisdiction}] ${finding.ruleTitle}  (${finding.severity})`);
    lines.push(`  “${finding.trigger.text}”`);
    lines.push(`  ${finding.headline}`);
    lines.push(`  Concern: ${finding.concern}`);
    lines.push(`  Fix:     ${finding.remedy}`);
    lines.push(`  Rule:    ${finding.ruleId} · ${citationLabel(finding.citation)}`);
  }

  lines.push("");
  lines.push(BAR);
  lines.push(`Score arithmetic (${weakest})`);
  const deductions = result.byJurisdiction[weakest]?.deductions ?? [];
  if (deductions.length === 0) lines.push("  100, nothing deducted.");
  for (const deduction of deductions) {
    lines.push(`  −${String(deduction.points).padStart(2)}  ${deduction.ruleTitle}  — ${deduction.reason}`);
  }
  lines.push("");
  lines.push(
    `Checked against: ${Object.entries(result.packVersions)
      .map(([market, version]) => `${market} ${version}`)
      .join(", ")}`,
  );
  lines.push("");
  lines.push(result.disclaimer);
  lines.push(BAR);
  return lines.join("\n");
}

function main() {
  const options = parse(process.argv.slice(2));
  const result = scan({
    text: options.text,
    source: options.reference ? { kind: "upload", reference: options.reference } : { kind: "paste" },
    jurisdictions: options.markets,
  });
  console.log(options.json ? JSON.stringify(result, null, 2) : render(result));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
