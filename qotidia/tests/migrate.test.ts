// Moving an archive without a network.
//
// The migration runs against MemoryStore at both ends, so everything below
// exercises the real copy loop — the same code that will move somebody's
// photographs — with nothing mocked except the two things that cannot be
// held in a test: the database rows and a store that misbehaves.
//
// The cases worth having are the unhappy ones. A copy loop that works is
// easy; what decides whether a migration is safe is what it does when a row
// points at nothing, when the network blinks, and when the destination says
// 200 and stores something else.

import { describe, expect, it, beforeEach } from "vitest";
import { inventory, dedupe, tally, type StoredObject } from "@/lib/storage/inventory";
import { copyOne, looksMissing, migrate } from "@/lib/storage/migrate";
import type { Bucket, ObjectStore, WriteTicket } from "@/lib/storage/provider";

/**
 * A database that answers the three selects the inventory makes.
 *
 * Chainable because that is the shape supabase-js has; the shape is the only
 * reason this is not a plain function.
 */
function fakeDb(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder = {
        select: () => builder,
        order: () => builder,
        range: (from: number, to: number) =>
          Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
      };
      return builder;
    },
  } as any;
}

/**
 * A store holding its own objects, and nobody else's.
 *
 * Deliberately not MemoryStore. That one keeps its Map on globalThis so that
 * Next's separate module registries in development all see one store — which
 * means two MemoryStore instances *are* the same store. A migration test
 * whose source and destination are the same store proves nothing: every
 * assertion that the bytes arrived passes before the copy runs.
 */
class LocalStore implements ObjectStore {
  readonly name = "local";
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async readUrl(bucket: Bucket, key: string): Promise<string> {
    return `local:${bucket}/${key}`;
  }
  async writeTicket(): Promise<WriteTicket> {
    return { url: "about:blank", method: "PUT", headers: {} };
  }
  async put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(`${bucket}/${key}`, { body: Buffer.from(body), contentType });
  }
  async get(bucket: Bucket, key: string): Promise<Buffer> {
    const found = this.objects.get(`${bucket}/${key}`);
    // Worded like the real stores, because the migration classifies absence
    // by reading the message.
    if (!found) throw new Error(`could not read ${bucket}/${key}: not found`);
    return found.body;
  }
  async remove(bucket: Bucket, keys: string[]): Promise<void> {
    for (const key of keys) this.objects.delete(`${bucket}/${key}`);
  }
}

/** A store that does what it is told to do wrong. */
class AwkwardStore implements ObjectStore {
  readonly name = "awkward";
  constructor(
    private readonly behaviour: {
      onGet?: (key: string) => Buffer | Error;
      onPut?: (key: string) => Error | void;
    }
  ) {}
  async readUrl(): Promise<string> {
    return "about:blank";
  }
  async writeTicket(): Promise<WriteTicket> {
    return { url: "about:blank", method: "PUT", headers: {} };
  }
  async put(_b: Bucket, key: string): Promise<void> {
    const outcome = this.behaviour.onPut?.(key);
    if (outcome instanceof Error) throw outcome;
  }
  async get(_b: Bucket, key: string): Promise<Buffer> {
    const outcome = this.behaviour.onGet?.(key) ?? Buffer.from("default");
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }
  async remove(): Promise<void> {}
}

const object = (over: Partial<StoredObject> = {}): StoredObject => ({
  bucket: "media",
  key: "fam/child/photo.jpg",
  source: "media_assets",
  contentType: "image/jpeg",
  ...over,
});

describe("what the database says is stored", () => {
  it("finds photographs, book PDFs and export archives", async () => {
    const found = await inventory(
      fakeDb({
        media_assets: [{ id: 1, storage_path: "u/s/a.jpg", thumbnail_path: null, mime_type: "image/jpeg" }],
        books: [{ id: 1, digital_pdf_path: "books/d.pdf", print_pdf_path: "books/p.pdf", cover_pdf_path: null }],
        archive_exports: [{ id: 1, storage_path: "exports/f/e.zip" }],
      })
    );

    expect(found).toHaveLength(4);
    expect(found.filter((o) => o.bucket === "media").map((o) => o.key)).toEqual(["u/s/a.jpg"]);
    expect(found.filter((o) => o.bucket === "renders").map((o) => o.key).sort()).toEqual([
      "books/d.pdf",
      "books/p.pdf",
      "exports/f/e.zip",
    ]);
  });

  it("carries the stored mime type rather than guessing from the name", async () => {
    const found = await inventory(
      fakeDb({
        media_assets: [{ id: 1, storage_path: "u/s/clip.mov", thumbnail_path: null, mime_type: "video/quicktime" }],
        books: [],
        archive_exports: [],
      })
    );
    expect(found[0].contentType).toBe("video/quicktime");
  });

  it("includes a thumbnail, which nothing writes today but the schema has", async () => {
    // The column is real and always null right now. A migration that skips
    // it is a bug that only appears once something starts filling it in, by
    // which point the move is over.
    const found = await inventory(
      fakeDb({
        media_assets: [{ id: 1, storage_path: "u/s/a.jpg", thumbnail_path: "u/s/a-thumb.jpg", mime_type: "image/jpeg" }],
        books: [],
        archive_exports: [],
      })
    );
    expect(found.map((o) => o.key)).toContain("u/s/a-thumb.jpg");
    expect(found.find((o) => o.key === "u/s/a-thumb.jpg")?.source).toBe("media_assets.thumbnail");
  });

  it("ignores rows whose path is null or empty", async () => {
    const found = await inventory(
      fakeDb({
        media_assets: [
          { id: 1, storage_path: null, thumbnail_path: null, mime_type: "image/jpeg" },
          { id: 2, storage_path: "", thumbnail_path: null, mime_type: "image/jpeg" },
        ],
        books: [{ id: 1, digital_pdf_path: null, print_pdf_path: null, cover_pdf_path: null }],
        archive_exports: [{ id: 1, storage_path: null }],
      })
    );
    expect(found).toEqual([]);
  });

  it("reads past the thousand-row cap PostgREST applies without saying so", async () => {
    // The failure this prevents: a select that reads "every asset" comes
    // back with exactly 1000 rows, the migration reports success, and the
    // rest of the archive is still in the old bucket.
    const many = Array.from({ length: 2500 }, (_, i) => ({
      id: i,
      storage_path: `u/s/${i}.jpg`,
      thumbnail_path: null,
      mime_type: "image/jpeg",
    }));
    const found = await inventory(fakeDb({ media_assets: many, books: [], archive_exports: [] }));
    expect(found).toHaveLength(2500);
    expect(found.map((o) => o.key)).toContain("u/s/2499.jpg");
  });

  it("counts one object once when two rows name it", () => {
    const deduped = dedupe([
      object({ key: "same.pdf", bucket: "renders", contentType: undefined }),
      object({ key: "same.pdf", bucket: "renders", contentType: "application/pdf" }),
    ]);
    expect(deduped).toHaveLength(1);
    // And keeps the entry that knows what it is.
    expect(deduped[0].contentType).toBe("application/pdf");
  });

  it("keeps the same key in two buckets apart", () => {
    const deduped = dedupe([object({ key: "x", bucket: "media" }), object({ key: "x", bucket: "renders" })]);
    expect(deduped).toHaveLength(2);
  });

  it("tallies by bucket and by table, which is what a report needs", () => {
    const counts = tally([
      object({ key: "a" }),
      object({ key: "b" }),
      object({ key: "c.pdf", bucket: "renders", source: "books" }),
    ]);
    expect(counts).toMatchObject({ total: 3, media: 2, renders: 1, media_assets: 2, books: 1 });
  });
});

describe("copying an object", () => {
  let from: LocalStore;
  let to: LocalStore;
  beforeEach(() => {
    from = new LocalStore();
    to = new LocalStore();
  });

  it("moves the bytes, unchanged", async () => {
    // Not a string: the archive is photographs and video, and a copy path
    // tested only on text is a copy path that has never seen a null byte.
    const body = Buffer.from([0x00, 0xff, 0x10, 0x00, 0x89, 0x50]);
    await from.put("media", "a.jpg", body, "image/jpeg");

    const result = await copyOne(object({ key: "a.jpg" }), from, to, true);

    expect(result.outcome).toBe("copied");
    expect(result.bytes).toBe(6);
    expect((await to.get("media", "a.jpg")).equals(body)).toBe(true);
  });

  it("reports a row that points at a file the source does not have", async () => {
    const result = await copyOne(object({ key: "never-uploaded.jpg" }), from, to, true);
    expect(result.outcome).toBe("missing");
  });

  it("calls an unrecognised error a failure rather than a missing file", async () => {
    // The distinction that matters. Treating every throw as absence turns a
    // network blink into a summary line saying the photograph was never
    // there, and nobody goes looking for it again.
    const flaky = new AwkwardStore({ onGet: () => new Error("503 service unavailable") });
    const result = await copyOne(object(), flaky, to, true);
    expect(result.outcome).toBe("failed");
    expect(result.error).toContain("503");
  });

  it("catches a destination that accepts the write and stores something else", async () => {
    const lying = new AwkwardStore({ onGet: () => Buffer.from("not what you sent") });
    await from.put("media", "a.jpg", Buffer.from("the real photograph"), "image/jpeg");

    const result = await copyOne(object({ key: "a.jpg" }), from, lying, true);

    expect(result.outcome).toBe("failed");
    expect(result.error).toMatch(/does not match source/);
  });

  it("classifies what absence looks like from either provider", () => {
    expect(looksMissing(new Error("could not read media/x: not found"))).toBe(true);
    expect(looksMissing(new Error("could not read media/x: 404 <Error>NoSuchKey</Error>"))).toBe(true);
    expect(looksMissing(new Error("503 service unavailable"))).toBe(false);
    expect(looksMissing(new Error("socket hang up"))).toBe(false);
  });
});

describe("copying the whole archive", () => {
  let from: LocalStore;
  let to: LocalStore;
  beforeEach(() => {
    from = new LocalStore();
    to = new LocalStore();
  });

  const three = [
    object({ key: "one.jpg" }),
    object({ key: "two.jpg" }),
    object({ key: "three.pdf", bucket: "renders", source: "books", contentType: "application/pdf" }),
  ];

  async function seed() {
    await from.put("media", "one.jpg", Buffer.from("1"), "image/jpeg");
    await from.put("media", "two.jpg", Buffer.from("2"), "image/jpeg");
    await from.put("renders", "three.pdf", Buffer.from("3"), "application/pdf");
  }

  it("copies everything and says so", async () => {
    await seed();
    const summary = await migrate({ from, to, objects: three });
    expect(summary).toMatchObject({ total: 3, copied: 3, missing: 0, failed: 0 });
    expect(summary.bytes).toBe(3);
  });

  it("keeps going past a missing file and reports it at the end", async () => {
    await seed();
    const summary = await migrate({
      from,
      to,
      objects: [...three, object({ key: "gone.jpg" })],
    });
    expect(summary.copied).toBe(3);
    expect(summary.missing).toBe(1);
    expect(summary.problems.map((p) => p.key)).toEqual(["gone.jpg"]);
    // The point: one bad row does not cost the other three.
    expect(await to.get("media", "one.jpg")).toBeTruthy();
  });

  it("skips what the ledger already has, so an interrupted run resumes", async () => {
    await seed();
    const summary = await migrate({
      from,
      to,
      objects: three,
      alreadyDone: new Set(["media/one.jpg", "media/two.jpg"]),
    });
    expect(summary).toMatchObject({ skipped: 2, copied: 1 });
    // And the skipped ones were genuinely not written.
    await expect(to.get("media", "one.jpg")).rejects.toThrow(/not found/);
  });

  it("reports every object exactly once, for the ledger to be trustworthy", async () => {
    await seed();
    const seen: string[] = [];
    await migrate({ from, to, objects: three, onDone: (r) => void seen.push(`${r.bucket}/${r.key}`) });
    expect(seen.sort()).toEqual(["media/one.jpg", "media/two.jpg", "renders/three.pdf"]);
  });

  it("holds only a few objects at a time, because they are whole files in memory", async () => {
    // Not a formality. The seam hands whole buffers around, so concurrency
    // is a multiplier on resident memory, and this archive holds phone
    // video. Eight 200MB files in flight is 1.6GB and an OOM two hours in.
    await seed();
    let inFlight = 0;
    let peak = 0;
    const slow: ObjectStore = {
      name: "slow",
      readUrl: async () => "about:blank",
      writeTicket: async () => ({ url: "about:blank", method: "PUT" as const, headers: {} }),
      put: async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 10));
        inFlight--;
      },
      get: async () => Buffer.from("x"),
      remove: async () => {},
    };

    await migrate({ from, to: slow, objects: three, concurrency: 2, verify: false });

    // Three objects, two workers: it must actually reach two, and never three.
    expect(peak).toBe(2);
  });
});
