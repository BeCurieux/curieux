/**
 * Where a shop lives before there is anywhere to publish it.
 *
 * A rendered shop needs two things: the `ShopConfig` the merchandiser wrote,
 * and the catalogue to resolve it against. This reads and writes that pair as
 * a file under `.cache/shop/`.
 *
 * It is deliberately the only thing in the renderer that knows about storage,
 * because step 4 replaces exactly this with Supabase and a public URL per
 * shop. Everything above it takes a config and a catalogue as arguments.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { Catalogue } from "@/lib/ingest/types";
import { ShopConfig } from "@/lib/schema";

export const ShopRenderInput = z.object({
  config: ShopConfig,
  /**
   * A snapshot, not a subscription. Until OAuth sync exists this catalogue is
   * as fresh as the last ingest and no fresher — which is precisely why no
   * part of the page is allowed to say it is live.
   */
  catalogue: Catalogue,
  ingestedAt: z.string(),
});
export type ShopRenderInput = z.infer<typeof ShopRenderInput>;

const DIR = path.join(process.cwd(), ".cache", "shop");

/**
 * The demo shops, committed.
 *
 * `.cache/` is gitignored, so on a fresh checkout — or a deployment, which is
 * always a fresh checkout — there is not a single shop to render. That was
 * invisible while the only reader was a developer with a warm cache, and it
 * stopped being invisible the moment `/examples` claimed every image on it
 * links to a working page.
 *
 * So the cache is checked first and this second. Nothing generated locally is
 * shadowed by a fixture, and a deployment still has the ten shops the
 * marketing site points at. `scripts/demo-fixtures.ts` writes them and refuses
 * any store that is not a reserved example domain.
 */
const FIXTURES = path.join(process.cwd(), "fixtures", "shops");

export async function saveShop(key: string, input: ShopRenderInput): Promise<string> {
  const file = path.join(DIR, `${safeKey(key)}.json`);
  await mkdir(DIR, { recursive: true });
  await writeFile(file, JSON.stringify(ShopRenderInput.parse(input), null, 2));
  return file;
}

export async function loadShop(key: string): Promise<ShopRenderInput | null> {
  const safe = safeKey(key);
  for (const dir of [DIR, FIXTURES]) {
    try {
      return ShopRenderInput.parse(JSON.parse(await readFile(path.join(dir, `${safe}.json`), "utf8")));
    } catch {
      // Missing here, or unparseable here. Either way try the next directory
      // before giving up — a half-written cache file must not hide a fixture.
    }
  }
  return null;
}

export interface ShopSummary {
  key: string;
  name: string;
  blocks: number;
  prompt: string;
  /** The tokens themselves, so the bench can compare theming at a glance. */
  theme: ShopRenderInput["config"]["theme"];
}

export async function listShops(): Promise<ShopSummary[]> {
  let files: string[];
  try {
    files = await readdir(DIR);
  } catch {
    return [];
  }

  const shops = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const key = file.replace(/\.json$/, "");
        const shop = await loadShop(key);
        return shop
          ? {
              key,
              name: shop.config.brand.name,
              blocks: shop.config.blocks.length,
              prompt: shop.config.meta.prompt,
              theme: shop.config.theme,
            }
          : null;
      }),
  );
  return shops.filter((shop): shop is NonNullable<typeof shop> => shop !== null);
}

/** No traversal out of the cache directory from a URL segment. */
function safeKey(key: string): string {
  const cleaned = key.replace(/[^a-z0-9._-]/gi, "_");
  if (!cleaned || cleaned.startsWith(".")) throw new Error(`Unusable shop key: ${key}`);
  return cleaned;
}
