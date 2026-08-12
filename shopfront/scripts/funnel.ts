#!/usr/bin/env tsx
/**
 * pnpm funnel <slug>
 *
 * The answer to "is this actually better than sending everyone to my store?",
 * which the brief names as the first retention-deciding question a merchant
 * asks. There is no dashboard — that is Sprint 3 — but the numbers exist from
 * the first published shop, and a number nobody can read is not recorded.
 *
 * Rates are per session rather than per event: a shopper who taps four products
 * has converted once on the question being asked, and counting it four times is
 * how a funnel flatters itself.
 */

import { readFunnel } from "../src/lib/funnel/index";
import { defaultEventStore } from "../src/lib/funnel/index";
import type { FunnelSummary } from "../src/lib/funnel/types";

function parseArgs(argv: string[]): { slug: string; json: boolean } {
  const args = { slug: "", json: false };
  for (const arg of argv) {
    if (arg === "--json") args.json = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else args.slug = arg;
  }
  if (!args.slug) throw new Error("Usage: pnpm funnel <slug> [--json]");
  return args;
}

const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

function render(summary: FunnelSummary): string {
  const lines: string[] = [];

  lines.push(`${summary.slug} — ${summary.sessions} session${summary.sessions === 1 ? "" : "s"}`);
  lines.push("");
  lines.push(`  views            ${summary.views}`);
  lines.push(`  product clicks   ${summary.productClicks}   ${pct(summary.clickRate)} of sessions`);
  lines.push(`  checkout starts  ${summary.checkoutStarts}   ${pct(summary.checkoutRate)} of sessions`);

  if (summary.checkoutStarts === 0 && summary.productClicks > 0) {
    // Worth saying rather than leaving as a zero to puzzle over: a catalogue of
    // multi-variant products legitimately produces clicks and no checkouts,
    // because a shopper has to pick a size on the merchant's own page first.
    lines.push("");
    lines.push("  No checkout starts. A product only gets a cart permalink when there is one");
    lines.push("  variant it could mean — products with sizes send the shopper to pick first.");
  }

  if (summary.bySource.length > 0) {
    lines.push("");
    lines.push("  where they came from");
    for (const row of summary.bySource) {
      lines.push(`    ${row.source.padEnd(12)} ${String(row.sessions).padStart(5)} sessions · ${row.checkoutStarts} checkouts`);
    }
  }

  if (summary.byProduct.length > 0) {
    lines.push("");
    lines.push("  what they touched");
    for (const row of summary.byProduct.slice(0, 12)) {
      lines.push(`    ${row.handle.padEnd(28)} ${String(row.clicks).padStart(4)} clicks · ${row.checkoutStarts} checkouts`);
    }
  }

  if (summary.byVersion.length > 1) {
    lines.push("");
    lines.push("  by version — a regeneration is judged against the one before it");
    for (const row of summary.byVersion) {
      lines.push(`    v${String(row.version).padEnd(4)} ${String(row.views).padStart(5)} views · ${row.checkoutStarts} checkouts`);
    }
  }

  lines.push("");
  // The drawer rule, stated where somebody might otherwise assume otherwise.
  lines.push("  Nothing reads these numbers back into a decision. That is PULSE, and it stays");
  lines.push("  shut until the logs hold enough real sessions to learn from.");

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const store = defaultEventStore();
  const summary = await readFunnel(args.slug, { events: store });

  if (!summary) {
    process.stderr.write(`\nNo events recorded for "${args.slug}" in the ${store.name} store.\n\n`);
    process.exit(1);
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }
  process.stdout.write(`\n${render(summary)}\n\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
});
