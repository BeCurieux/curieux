// Move the archive from one store to another.
//
//   npm run migrate:storage                  what would move, and how much
//   npm run migrate:storage -- --apply       actually move it
//   npm run migrate:storage -- --apply --limit 20    a cautious first run
//
// Nothing is written without --apply. The default is a count, because the
// first question anybody has is "how much is there" and the worst way to
// find out is to start moving it.
//
// ## Resuming
//
// Every copied object is appended to a ledger file as it lands, so an
// interrupted run — and a run over a real archive will be interrupted —
// picks up where it stopped instead of starting again. Delete the ledger to
// force a full re-copy.
//
// ## What it will not do
//
// It does not delete anything from the source, ever. A migration that
// removes as it goes has no way back from a bad run, and the source is the
// only copy of somebody's photographs until the new store is proven. Freeing
// the old bucket is a separate decision made by a person after the new one
// has been serving traffic for a while.

import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "../env.mjs";
import { inventory, tally, type StoredObject } from "@/lib/storage/inventory";
import { migrate } from "@/lib/storage/migrate";
import { MemoryStore } from "@/lib/storage/memory";
import { R2Store } from "@/lib/storage/r2";
import { SupabaseStore } from "@/lib/storage/supabase-store";
import type { ObjectStore } from "@/lib/storage/provider";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string, fallback: string) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};

const storeNamed = (name: string): ObjectStore => {
  if (name === "supabase") return new SupabaseStore();
  if (name === "r2") return new R2Store();
  if (name === "memory") return new MemoryStore();
  throw new Error(`unknown store "${name}" — expected supabase, r2 or memory`);
};

const bytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${n}B`;

async function main() {
  const apply = flag("apply");
  const from = value("from", "supabase");
  const to = value("to", "r2");
  const ledgerPath = value("ledger", ".migrate-ledger");
  const concurrency = Number(value("concurrency", "4"));
  const limit = Number(value("limit", "0"));
  const verify = !flag("no-verify");

  if (from === to) {
    console.error(`Source and destination are both "${from}". Nothing to do.`);
    process.exit(1);
  }

  // Both ends are resolved before anything else happens. Reading the
  // inventory of a real archive is not instant, and finding out about a
  // mistyped provider after it is the sort of small rudeness that makes
  // people stop trusting a tool they are already nervous about running.
  const source = storeNamed(from);
  const destination = storeNamed(to);

  const { url, key } = requireSupabase({ needSecret: true });
  const db = createClient(url!, key!, { auth: { persistSession: false } });

  console.log(`Reading the inventory from the database…`);
  let objects: StoredObject[] = await inventory(db);
  const counts = tally(objects);
  console.log(
    `\n${counts.total} objects referenced\n` +
      Object.entries(counts)
        .filter(([k]) => k !== "total")
        .map(([k, v]) => `  ${String(v).padStart(7)}  ${k}`)
        .join("\n")
  );

  if (limit > 0) {
    objects = objects.slice(0, limit);
    console.log(`\n--limit ${limit}: only the first ${objects.length} will be considered.`);
  }

  if (!apply) {
    console.log(
      `\nThis was a dry run and nothing was written. It reports what the database\n` +
        `points at, not what the source store holds — a row can name a file that is\n` +
        `not there, and only a real run finds those.\n\n` +
        `To move it:  npm run migrate:storage -- --apply\n`
    );
    return;
  }

  // The ledger is read once and appended to as we go, so kill -9 costs at
  // most the objects that were in flight.
  const alreadyDone = new Set<string>(
    existsSync(ledgerPath)
      ? readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean)
      : []
  );
  if (alreadyDone.size) {
    console.log(`\nLedger ${ledgerPath}: ${alreadyDone.size} already copied, and will be skipped.`);
  }

  console.log(`\nCopying ${from} → ${to}, ${concurrency} at a time${verify ? ", verifying each" : ""}…\n`);

  let done = 0;
  const summary = await migrate({
    from: source,
    to: destination,
    objects,
    alreadyDone,
    verify,
    concurrency,
    onDone: (result) => {
      done++;
      if (result.outcome === "copied") appendFileSync(ledgerPath, `${result.bucket}/${result.key}\n`);
      // Problems are printed as they happen. A summary at the end is no use
      // to somebody watching a run that has hours left.
      if (result.outcome === "missing" || result.outcome === "failed") {
        console.log(`  ${result.outcome.toUpperCase()}  ${result.bucket}/${result.key} — ${result.error}`);
      } else if (done % 50 === 0) {
        console.log(`  … ${done}/${objects.length}`);
      }
    },
  });

  console.log(
    `\n${summary.copied} copied (${bytes(summary.bytes)}), ${summary.skipped} already done, ` +
      `${summary.missing} missing at source, ${summary.failed} failed.`
  );

  if (summary.missing) {
    console.log(
      `\nMissing means a database row names a file the source store does not have.\n` +
        `That is worth looking into but does not make the move incomplete — there is\n` +
        `nothing to copy. The keys are listed above.`
    );
  }
  if (summary.failed) {
    console.log(`\n${summary.failed} failed. Re-run the same command; the ledger skips what already landed.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
