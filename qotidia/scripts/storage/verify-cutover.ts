// Can the store we are actually running on serve the archive?
//
//   npm run verify:cutover              check everything
//   npm run verify:cutover -- --sample 50    spot-check
//
// Run it after STORAGE_PROVIDER changes. migrate.ts already compared every
// copy to its source byte for byte, so this is not asking "did the copy
// work" — it is asking the different and more important question of whether
// the provider the application is *configured to use right now* can serve
// every object the database points at. Those come apart in the ways that
// matter: a bucket name that differs by a hyphen, a key prefix that the old
// provider added and the new one does not, a token scoped to one bucket of
// the two. Each of those migrates perfectly and then serves nothing.
//
// ## Why this does not download the archive
//
// A signed read URL is fetched with `Range: bytes=0-0`, so the store returns
// the first byte and stops. Presence, permission and the signature are all
// exercised; sixty gigabytes are not moved to learn it. Range is not a
// signed header, so adding it does not disturb the signature — only the
// headers that were signed are bound.

import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "../env.mjs";
import { inventory, tally, type StoredObject } from "@/lib/storage/inventory";
import { getObjectStore, TTL } from "@/lib/storage/provider";

const argv = process.argv.slice(2);
const value = (name: string, fallback: string) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};

interface Problem {
  object: StoredObject;
  detail: string;
}

/** Spread a sample across the whole inventory rather than taking the front. */
function sample<T>(items: T[], size: number): T[] {
  if (size <= 0 || items.length <= size) return items;
  const step = items.length / size;
  return Array.from({ length: size }, (_, i) => items[Math.floor(i * step)]);
}

async function check(object: StoredObject): Promise<Problem | null> {
  let url: string;
  try {
    url = await getObjectStore().readUrl(object.bucket, object.key, TTL.view);
  } catch (error) {
    return { object, detail: `could not sign a URL: ${error instanceof Error ? error.message : error}` };
  }

  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-0" } });
    // 206 is the ranged answer; 200 is a store that ignored the range and
    // sent the object, which still proves it is there.
    if (res.status === 200 || res.status === 206) {
      await res.arrayBuffer().catch(() => undefined);
      return null;
    }
    return { object, detail: `HTTP ${res.status}` };
  } catch (error) {
    return { object, detail: `fetch failed: ${error instanceof Error ? error.message : error}` };
  }
}

async function main() {
  const size = Number(value("sample", "0"));
  const concurrency = Number(value("concurrency", "8"));

  const { url, key } = requireSupabase({ needSecret: true });
  const db = createClient(url!, key!, { auth: { persistSession: false } });

  const store = getObjectStore();
  console.log(`STORAGE_PROVIDER resolves to: ${store.name}`);
  if (store.name === "memory") {
    // MemoryStore answers a read for an unknown key with a generated demo
    // photograph rather than a failure, so every check here would pass and
    // prove nothing at all.
    console.error(`\nThe in-memory store cannot be verified — it invents an image for any key.\n`);
    process.exit(1);
  }

  const all = await inventory(db);
  const counts = tally(all);
  const objects = sample(all, size);
  console.log(
    `${counts.total} objects referenced (${counts.media} media, ${counts.renders} renders)` +
      (objects.length < all.length ? `\nchecking a spread sample of ${objects.length}` : `\nchecking all of them`)
  );

  const problems: Problem[] = [];
  const queue = [...objects];
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        const problem = await check(next);
        done++;
        if (problem) {
          problems.push(problem);
          console.log(`  UNREADABLE  ${problem.object.bucket}/${problem.object.key} — ${problem.detail}`);
        } else if (done % 100 === 0) {
          console.log(`  … ${done}/${objects.length}`);
        }
      }
    })
  );

  if (problems.length === 0) {
    console.log(`\nAll ${objects.length} readable from ${store.name}.`);
    return;
  }

  // Which table a key came from is the fastest route to the cause: all of
  // one source failing is a prefix or bucket problem, a scatter across all
  // of them is credentials or an incomplete copy.
  const byTable = problems.reduce<Record<string, number>>((acc, p) => {
    acc[p.object.source] = (acc[p.object.source] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `\n${problems.length} of ${objects.length} could not be read from ${store.name}:\n` +
      Object.entries(byTable).map(([t, n]) => `  ${String(n).padStart(7)}  ${t}`).join("\n") +
      `\n\nDo not leave the application on this provider. Switch STORAGE_PROVIDER back,\n` +
      `confirm the archive is readable again, then work out what the copy missed.`
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
