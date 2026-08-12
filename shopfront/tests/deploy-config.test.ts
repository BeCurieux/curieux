/**
 * The settings that only matter once this is on Vercel.
 *
 * Each of these is one line in a file, each is easy to delete while tidying,
 * and none of them fails locally when it goes. `next dev` renders every route
 * on every request, so a page that lost `force-dynamic` behaves identically
 * here and freezes in production; a route that lost `runtime = "nodejs"` runs
 * fine on a laptop and loses the Node APIs it needs on an edge deployment.
 *
 * Read as source rather than through a build, on purpose. The alternative is
 * asserting against `.next/`, which means every run of the unit suite waits
 * for a production build — and the thing being protected is a line of code,
 * not an artefact.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const SHOP_PAGE = "src/app/[slug]/page.tsx";
const EVENTS_ROUTE = "src/app/api/events/route.ts";

describe("the published shop page", () => {
  it("renders on every request, so prices cannot freeze", () => {
    // The product rule this protects is not a preference: "prices,
    // availability and imagery come from ingested data only" and "nothing on
    // the page may claim sync/liveness that isn't yet wired". A statically
    // cached shop page would serve the price that was true at build time,
    // under a dateline saying otherwise — the page would be lying, quietly,
    // and only in production.
    expect(read(SHOP_PAGE)).toMatch(/export const dynamic = "force-dynamic"/);
  });
});

describe("the funnel endpoint", () => {
  it("runs on Node rather than the edge", () => {
    // It reaches the Supabase client and the service-role key. Edge would
    // fail on a laptop's dev server in no way at all and fail in production
    // on the first event.
    expect(read(EVENTS_ROUTE)).toMatch(/export const runtime = "nodejs"/);
  });

  it("renders on every request", () => {
    expect(read(EVENTS_ROUTE)).toMatch(/export const dynamic = "force-dynamic"/);
  });
});

describe("the service-role key", () => {
  it("is never read from a NEXT_PUBLIC_ variable", async () => {
    // `NEXT_PUBLIC_` is not a naming convention — it is the instruction that
    // inlines a value into the browser bundle. A key that bypasses row-level
    // security must never be one, and the mistake is a nine-character edit
    // that looks like a fix for an undefined variable.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) => /NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET|KEY)/.test(text));
    expect(offenders.map((f) => f.file)).toEqual([]);
  });

  it("is named in two files, and only one of them uses the value", async () => {
    // `store.ts` tests whether it is *set*, to choose an adapter; it never
    // reads the value into anything. `supabase.ts` is the single place the
    // secret reaches a client. Both are fine and neither is redundant, so the
    // assertion is the exact pair rather than a count.
    //
    // A third file appearing here is the thing worth looking at: it is how a
    // secret starts travelling, and it is much easier to see in a failing test
    // than in a diff that adds one plausible line.
    const files = await sourceFiles();
    const readers = files.filter(({ text }) => text.includes("SUPABASE_SERVICE_ROLE_KEY")).map((f) => f.file);
    expect(readers.sort()).toEqual(["lib/publish/store.ts", "lib/publish/supabase.ts"]);
  });
});

describe("the image pipeline", () => {
  it("keeps Next's optimiser off, so no remote host needs allowlisting", () => {
    // With the optimiser on, every merchant CDN would have to be added to
    // `remotePatterns` before their photographs would load — a per-merchant
    // config edit standing between a generated shop and a working one, and a
    // failure that appears only once deployed.
    expect(read("next.config.mjs")).toMatch(/images:\s*\{\s*unoptimized:\s*true\s*\}/);
  });
});

/** Every `.ts`/`.tsx` under `src`, as text. */
async function sourceFiles(): Promise<{ file: string; text: string }[]> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir("src", { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => {
      const full = `${entry.parentPath}/${entry.name}`;
      return { file: full.replace(/^src\//, ""), text: read(full) };
    });
}
