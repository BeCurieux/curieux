/**
 * Where Genome v1 lives: classifications, merchant declarations, the gold set,
 * the labellers, their labels and the eval's verdicts.
 *
 * Same arrangement as `lib/publish`: `store-supabase.ts` is production and this
 * file's local implementation is a JSON file under `.cache/genome-v1/`. The
 * local one is not a stub. The classifier, the labelling page and the eval
 * all run end to end on it, which is how they are tested and how this
 * container (which cannot reach Supabase) ran them at all.
 *
 * Two rules the implementations share:
 *
 * - Saving a classification replaces the model and rule rows for those
 *   products and **never touches a merchant declaration or a human review**.
 *   Re-running the classifier cannot overwrite something a person said.
 * - A labeller is found by the sha256 of their invite token. The token itself
 *   is shown once, when the invite is made, and stored nowhere.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { storeNameFromEnv } from "@/lib/publish/store";
import type { ProductRecord } from "./classify";
import type { GenomeValue } from "./records";
import type { DimensionId } from "./taxonomy";

export interface GoldSnapshot {
  title: string;
  description: string;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  options: string[];
  images: string[];
  price: number | null;
  currency: string | null;
  url: string;
}

export interface GoldItem {
  id: string;
  goldSet: string;
  storeUrl: string;
  handle: string;
  parentCategory: string | null;
  snapshot: GoldSnapshot;
  createdAt: string;
}

export interface Labeller {
  id: string;
  name: string;
  tokenHash: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface GoldLabel {
  itemId: string;
  labellerId: string;
  dimension: DimensionId;
  labels: string[];
  taxonomyVersion: string;
  labelledAt: string;
}

export interface EvalRun {
  id: string;
  kind: "agreement" | "model";
  taxonomyVersion: string;
  promptVersion: string | null;
  model: string | null;
  config: Record<string, unknown>;
  metrics: Record<string, unknown>;
  createdAt: string;
}

export type Verdict = "keep" | "tighten" | "redefine" | "insufficient";

export interface GateVerdict {
  taxonomyVersion: string;
  dimension: DimensionId;
  kappa: number | null;
  items: number;
  verdict: Verdict;
  evalRunId: string | null;
  decidedAt: string;
}

export interface GenomeV1Store {
  readonly name: string;

  saveClassification(storeUrl: string, products: readonly ProductRecord[], values: readonly GenomeValue[]): Promise<void>;
  loadClassification(storeUrl: string): Promise<{ products: ProductRecord[]; values: GenomeValue[] }>;
  /** Replace the merchant's declaration for one product and dimension. */
  saveDeclaration(storeUrl: string, handle: string, dimension: DimensionId, rows: readonly GenomeValue[]): Promise<void>;

  addGoldItems(items: readonly Omit<GoldItem, "id" | "createdAt">[]): Promise<GoldItem[]>;
  listGoldItems(goldSet?: string): Promise<GoldItem[]>;

  createLabeller(name: string, tokenHash: string): Promise<Labeller>;
  findLabeller(tokenHash: string): Promise<Labeller | null>;
  listLabellers(): Promise<Labeller[]>;

  /** Upsert on (item, labeller, dimension, taxonomy version). */
  saveLabel(label: GoldLabel): Promise<void>;
  listLabels(filter?: { labellerId?: string }): Promise<GoldLabel[]>;

  saveEvalRun(run: Omit<EvalRun, "id" | "createdAt">): Promise<EvalRun>;
  listEvalRuns(): Promise<EvalRun[]>;
  saveGate(verdicts: readonly GateVerdict[]): Promise<void>;
  listGate(taxonomyVersion: string): Promise<GateVerdict[]>;
}

// ------------------------------------------------------------------- local

interface LocalData {
  products: ProductRecord[];
  values: GenomeValue[];
  goldItems: GoldItem[];
  labellers: Labeller[];
  labels: GoldLabel[];
  evalRuns: EvalRun[];
  gate: GateVerdict[];
}

const EMPTY: LocalData = { products: [], values: [], goldItems: [], labellers: [], labels: [], evalRuns: [], gate: [] };

export function localGenomeV1Path(root = process.cwd()): string {
  return path.join(root, ".cache", "genome-v1", "db.json");
}

const PERSON_SET = new Set(["merchant_declared", "human_reviewed"]);

export function createLocalGenomeV1Store(file = localGenomeV1Path()): GenomeV1Store {
  // Writes are serialised so two label submissions landing together cannot
  // interleave a read-modify-write and lose one.
  let queue: Promise<unknown> = Promise.resolve();

  const read = async (): Promise<LocalData> => {
    try {
      return { ...EMPTY, ...(JSON.parse(await readFile(file, "utf8")) as Partial<LocalData>) };
    } catch {
      return structuredClone(EMPTY);
    }
  };
  const mutate = <T>(fn: (data: LocalData) => T): Promise<T> => {
    const run = queue.then(async () => {
      const data = await read();
      const out = fn(data);
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(data));
      await rename(tmp, file);
      return out;
    });
    queue = run.catch(() => undefined);
    return run;
  };
  const now = () => new Date().toISOString();

  return {
    name: "local",

    saveClassification: (storeUrl, products, values) =>
      mutate((data) => {
        const handles = new Set(products.map((p) => p.handle));
        data.products = data.products.filter((p) => !(p.storeUrl === storeUrl && handles.has(p.handle))).concat(products);
        data.values = data.values
          .filter((v) => !(v.storeUrl === storeUrl && handles.has(v.handle) && !PERSON_SET.has(v.provenance)))
          .concat(values.filter((v) => !PERSON_SET.has(v.provenance)));
      }),

    async loadClassification(storeUrl) {
      const data = await read();
      return {
        products: data.products.filter((p) => p.storeUrl === storeUrl),
        values: data.values.filter((v) => v.storeUrl === storeUrl),
      };
    },

    saveDeclaration: (storeUrl, handle, dimension, rows) =>
      mutate((data) => {
        data.values = data.values
          .filter((v) => !(v.storeUrl === storeUrl && v.handle === handle && v.dimension === dimension && v.provenance === "merchant_declared"))
          .concat(rows);
      }),

    addGoldItems: (items) =>
      mutate((data) => {
        const out: GoldItem[] = [];
        for (const item of items) {
          const existing = data.goldItems.find((g) => g.goldSet === item.goldSet && g.storeUrl === item.storeUrl && g.handle === item.handle);
          if (existing) {
            out.push(existing);
            continue;
          }
          const created = { ...item, id: randomUUID(), createdAt: now() };
          data.goldItems.push(created);
          out.push(created);
        }
        return out;
      }),

    async listGoldItems(goldSet) {
      const items = (await read()).goldItems;
      return goldSet ? items.filter((g) => g.goldSet === goldSet) : items;
    },

    createLabeller: (name, tokenHash) =>
      mutate((data) => {
        const labeller: Labeller = { id: randomUUID(), name, tokenHash, createdAt: now(), revokedAt: null };
        data.labellers.push(labeller);
        return labeller;
      }),

    async findLabeller(tokenHash) {
      return (await read()).labellers.find((l) => l.tokenHash === tokenHash && !l.revokedAt) ?? null;
    },

    async listLabellers() {
      return (await read()).labellers;
    },

    saveLabel: (label) =>
      mutate((data) => {
        data.labels = data.labels
          .filter(
            (l) =>
              !(l.itemId === label.itemId && l.labellerId === label.labellerId && l.dimension === label.dimension && l.taxonomyVersion === label.taxonomyVersion),
          )
          .concat(label);
      }),

    async listLabels(filter) {
      const labels = (await read()).labels;
      return filter?.labellerId ? labels.filter((l) => l.labellerId === filter.labellerId) : labels;
    },

    saveEvalRun: (run) =>
      mutate((data) => {
        const saved = { ...run, id: randomUUID(), createdAt: now() };
        data.evalRuns.push(saved);
        return saved;
      }),

    async listEvalRuns() {
      return (await read()).evalRuns;
    },

    saveGate: (verdicts) =>
      mutate((data) => {
        const keys = new Set(verdicts.map((v) => `${v.taxonomyVersion}:${v.dimension}`));
        data.gate = data.gate.filter((g) => !keys.has(`${g.taxonomyVersion}:${g.dimension}`)).concat(verdicts);
      }),

    async listGate(taxonomyVersion) {
      return (await read()).gate.filter((g) => g.taxonomyVersion === taxonomyVersion);
    },
  };
}

export async function defaultGenomeV1Store(): Promise<GenomeV1Store> {
  if (storeNameFromEnv() === "supabase") {
    const { createSupabaseGenomeV1Store } = await import("./store-supabase");
    return createSupabaseGenomeV1Store();
  }
  return createLocalGenomeV1Store();
}
