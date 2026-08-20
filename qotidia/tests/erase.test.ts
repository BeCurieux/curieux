// Does "delete everything" delete everything?
//
// This function had no test at all, which is how two ways of leaving files
// behind lived in it: it never looked at thumbnail_path, and it read the
// asset list unpaged, so a family with more than a thousand assets kept
// whatever fell past the first page — while the rows that recorded where
// those files lived were deleted in the same call, making them unfindable
// rather than gone.
//
// Both are invisible from the outside. The function returns a count, the
// count looks plausible, and the promise in DELETION_TERMS is not kept.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { eraseFamily } from "@/lib/privacy/erase";
import { setObjectStore } from "@/lib/storage/provider";
import type { Bucket, ObjectStore, WriteTicket } from "@/lib/storage/provider";

/** A store that remembers what it was asked to delete, in order. */
class RecordingStore implements ObjectStore {
  readonly name = "recording";
  readonly removed: { bucket: Bucket; keys: string[] }[] = [];
  constructor(private readonly log: string[]) {}
  async readUrl(): Promise<string> {
    return "about:blank";
  }
  async writeTicket(): Promise<WriteTicket> {
    return { url: "about:blank", method: "PUT", headers: {} };
  }
  async put(): Promise<void> {}
  async get(): Promise<Buffer> {
    throw new Error("erase never reads");
  }
  async remove(bucket: Bucket, keys: string[]): Promise<void> {
    this.removed.push({ bucket, keys });
    this.log.push(`remove:${bucket}`);
  }
  keysFor(bucket: Bucket): string[] {
    return this.removed.filter((r) => r.bucket === bucket).flatMap((r) => r.keys);
  }
}

/** Enough of PostgREST's shape to answer a paged, filtered select. */
function fakeDb(tables: Record<string, Record<string, unknown>[]>, log: string[] = []) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder: Record<string, unknown> = {};
      Object.assign(builder, {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        range: (from: number, to: number) =>
          Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
      });
      return {
        ...builder,
        delete: () => ({
          eq: () => {
            log.push(`delete:${table}`);
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  } as never;
}

const asset = (n: number, thumb = false) => ({
  id: `asset-${String(n).padStart(5, "0")}`,
  storage_path: `fam/child/${n}.jpg`,
  thumbnail_path: thumb ? `fam/child/${n}-thumb.jpg` : null,
});

describe("erasing a family", () => {
  let log: string[];
  let store: RecordingStore;

  beforeEach(() => {
    log = [];
    store = new RecordingStore(log);
    setObjectStore(store);
  });
  afterEach(() => setObjectStore(null));

  it("deletes the thumbnail as well as the photograph", async () => {
    // A thumbnail is a derived copy of the same child's face. Nothing about
    // the word "deleted" makes an exception for a smaller one.
    const db = fakeDb({
      subjects: [{ id: "s1" }],
      media_assets: [asset(1, true)],
      books: [],
      archive_exports: [],
    });

    const result = await eraseFamily(db, "fam-1");

    expect(store.keysFor("media")).toEqual(["fam/child/1.jpg", "fam/child/1-thumb.jpg"]);
    expect(result.filesRemoved).toBe(2);
  });

  it("leaves a null thumbnail alone rather than deleting a key called null", async () => {
    const db = fakeDb({
      subjects: [{ id: "s1" }],
      media_assets: [asset(1)],
      books: [],
      archive_exports: [],
    });

    await eraseFamily(db, "fam-1");

    expect(store.keysFor("media")).toEqual(["fam/child/1.jpg"]);
  });

  it("deletes every asset, not the first thousand", async () => {
    // The failure this prevents is the worst one in the product: the files
    // stay, the rows that said where they were do not, and the family is
    // told it is done.
    const db = fakeDb({
      subjects: [{ id: "s1" }],
      media_assets: Array.from({ length: 2500 }, (_, i) => asset(i)),
      books: [],
      archive_exports: [],
    });

    const result = await eraseFamily(db, "fam-1");

    expect(store.keysFor("media")).toHaveLength(2500);
    expect(store.keysFor("media")).toContain("fam/child/2499.jpg");
    expect(result.filesRemoved).toBe(2500);
  });

  it("pages the books and the exports too", async () => {
    const db = fakeDb({
      subjects: [{ id: "s1" }],
      media_assets: [],
      books: Array.from({ length: 1200 }, (_, i) => ({
        id: `book-${String(i).padStart(5, "0")}`,
        print_pdf_path: `books/${i}-print.pdf`,
        digital_pdf_path: null,
        cover_pdf_path: null,
      })),
      archive_exports: Array.from({ length: 1100 }, (_, i) => ({
        id: `exp-${String(i).padStart(5, "0")}`,
        storage_path: `exports/${i}.zip`,
      })),
    });

    await eraseFamily(db, "fam-1");

    const renders = store.keysFor("renders");
    expect(renders).toHaveLength(2300);
    expect(renders).toContain("books/1199-print.pdf");
    expect(renders).toContain("exports/1099.zip");
  });

  it("takes all three of a book's PDFs", async () => {
    const db = fakeDb({
      subjects: [{ id: "s1" }],
      media_assets: [],
      books: [
        {
          id: "b1",
          print_pdf_path: "books/p.pdf",
          digital_pdf_path: "books/d.pdf",
          cover_pdf_path: "books/c.pdf",
        },
      ],
      archive_exports: [],
    });

    await eraseFamily(db, "fam-1");

    expect(store.keysFor("renders").sort()).toEqual(["books/c.pdf", "books/d.pdf", "books/p.pdf"]);
  });

  it("removes the files before the rows", async () => {
    // The order is the whole design. Delete the rows first and the
    // photographs become unreachable orphans that are still there — which
    // is indistinguishable from deletion right up until it matters.
    const db = fakeDb(
      {
        subjects: [{ id: "s1" }],
        media_assets: [asset(1, true)],
        books: [{ id: "b1", print_pdf_path: "books/p.pdf", digital_pdf_path: null, cover_pdf_path: null }],
        archive_exports: [],
      },
      log
    );

    await eraseFamily(db, "fam-1");

    expect(log).toEqual(["remove:media", "remove:renders", "delete:families"]);
  });

  it("does nothing to storage for a family that never uploaded anything", async () => {
    const db = fakeDb(
      { subjects: [{ id: "s1" }], media_assets: [], books: [], archive_exports: [] },
      log
    );

    const result = await eraseFamily(db, "fam-1");

    expect(store.removed).toEqual([]);
    expect(result).toEqual({ filesRemoved: 0, subjectsRemoved: 1 });
    // The rows still go, even with no files.
    expect(log).toEqual(["delete:families"]);
  });

  it("counts subjects, and still erases a family with none", async () => {
    const db = fakeDb({ subjects: [], media_assets: [], books: [], archive_exports: [] }, log);

    const result = await eraseFamily(db, "fam-1");

    expect(result.subjectsRemoved).toBe(0);
    expect(log).toEqual(["delete:families"]);
  });
});
