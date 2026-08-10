// The seam, and the rules it exists to keep.
//
// Signing correctness lives in sigv4.test.ts, against vectors computed by
// Amazon rather than by us. This file is about everything else: that the
// store behaves the same whichever implementation is underneath, that
// nothing routes around it, and that the promises made in the interface's
// comment are true of the code rather than only of the comment.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUCKETS, TTL, getObjectStore, setObjectStore, type ObjectStore } from "@/lib/storage/provider";
import { MemoryStore, clearMemoryStore } from "@/lib/storage/memory";

const SRC = new URL("../src", import.meta.url).pathname;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * The file with its comments taken out.
 *
 * Without this the guards below match the sentences explaining why the rule
 * exists — provider.ts names both `db.storage.from(...)` and getPublicUrl in
 * prose — and a rule that is broken by documenting it is a rule nobody will
 * keep.
 */
const code = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("nothing reaches past the seam", () => {
  // The reason this is a test and not a convention: there were fourteen
  // direct call sites before the seam existed, and every one of them was
  // written by somebody doing the obvious thing. The next one will be too.
  const ALLOWED = ["src/lib/storage/supabase-store.ts"];

  it("no file outside the storage adapter calls .storage.from", () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => /storage\s*\.\s*from\(/.test(code(f)))
      .map((f) => f.slice(f.indexOf("src/")))
      .filter((f) => !ALLOWED.includes(f));
    expect(offenders).toEqual([]);
  });

  it("nothing anywhere asks for a permanent public URL", () => {
    // getPublicUrl is one call away at all times and would turn a private
    // archive into a set of links that work for ever and cannot be recalled.
    const offenders = sourceFiles(SRC)
      .filter((f) => code(f).includes("getPublicUrl"))
      .map((f) => f.slice(f.indexOf("src/")));
    expect(offenders).toEqual([]);
  });

  it("no bucket is named as a bare string outside the adapter", () => {
    // from("media") disappearing into a helper is how a third bucket gets
    // invented and how files end up somewhere nothing looks for them.
    const offenders = sourceFiles(SRC)
      .filter((f) => !f.includes("src/lib/storage/"))
      .filter((f) => /from\(["'](media|renders)["']\)/.test(code(f)))
      .map((f) => f.slice(f.indexOf("src/")));
    expect(offenders).toEqual([]);
  });
});

describe("how long a URL lives", () => {
  it("is minutes for anything a person is looking at", () => {
    expect(TTL.view).toBeLessThanOrEqual(600);
    expect(TTL.listen).toBeLessThanOrEqual(600);
    expect(TTL.download).toBeLessThanOrEqual(600);
  });

  it("is longer only where something else does the fetching", () => {
    // A printer fetches on its own schedule and an upload may be a large
    // video on bad wifi. Both are named exceptions, not the default.
    expect(TTL.print).toBeLessThanOrEqual(3600);
    expect(TTL.upload).toBeLessThanOrEqual(3600);
  });

  it("never issues anything that outlives a session", () => {
    for (const [name, seconds] of Object.entries(TTL)) {
      expect(seconds, `${name} is longer than an hour`).toBeLessThanOrEqual(3600);
    }
  });
});

describe("an in-memory store behaves like a real one", () => {
  let store: ObjectStore;
  beforeEach(() => {
    clearMemoryStore();
    store = new MemoryStore();
  });

  it("returns what was put in", async () => {
    await store.put("media", "a/b.jpg", Buffer.from("hello"), "image/jpeg");
    expect((await store.get("media", "a/b.jpg")).toString()).toBe("hello");
  });

  it("throws for a key that was never written", async () => {
    // Not an empty buffer. The scanner and the export builder both have a
    // branch for a missing file and a permissive stub is how it goes
    // untested.
    await expect(store.get("media", "nope.jpg")).rejects.toThrow(/not found/);
  });

  it("keeps buckets apart", async () => {
    await store.put("media", "same.jpg", Buffer.from("photo"), "image/jpeg");
    await store.put("renders", "same.jpg", Buffer.from("pdf"), "application/pdf");
    expect((await store.get("media", "same.jpg")).toString()).toBe("photo");
    expect((await store.get("renders", "same.jpg")).toString()).toBe("pdf");
  });

  it("deletes, and deleting twice is not an error", async () => {
    await store.put("media", "x.jpg", Buffer.from("x"), "image/jpeg");
    await store.remove("media", ["x.jpg"]);
    await expect(store.remove("media", ["x.jpg"])).resolves.toBeUndefined();
    await expect(store.get("media", "x.jpg")).rejects.toThrow();
  });

  it("hands back a generated photograph for a key it has never seen", async () => {
    // Demo mode. It must be an actual image rather than a coloured block —
    // a grid of flat colours reads as a paint chart, which this product has
    // already shipped once.
    const url = await store.readUrl("media", "demo/photo-7.jpg", 300);
    expect(url.startsWith("data:image/")).toBe(true);
    expect(url.length).toBeGreaterThan(500);
  });
});

describe("the R2 store, without the network", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_ENDPOINT = "https://acct.r2.example";
    process.env.R2_MEDIA_BUCKET = "qotidia-media";
    setObjectStore(null);
  });
  afterEach(() => {
    process.env = { ...env };
    setObjectStore(null);
    vi.unstubAllGlobals();
  });

  const r2 = async () => new (await import("@/lib/storage/r2")).R2Store();

  it("says which setting is missing rather than throwing at a URL", async () => {
    delete process.env.R2_SECRET_ACCESS_KEY;
    const store = await r2();
    await expect(store.readUrl("media", "a.jpg", 300)).rejects.toThrow(/R2_SECRET_ACCESS_KEY/);
  });

  it("puts the bucket in the path and never in the hostname", async () => {
    // R2 is addressed path-style. Virtual-host style would need DNS per
    // bucket and would silently 404 here.
    const url = await (await r2()).readUrl("media", "fam/child/a.jpg", 300);
    expect(new URL(url).host).toBe("acct.r2.example");
    expect(new URL(url).pathname).toBe("/qotidia-media/fam/child/a.jpg");
  });

  it("signs an upload for exactly the declared size", async () => {
    const ticket = await (await r2()).writeTicket("media", "fam/a.jpg", 900, {
      contentType: "image/jpeg",
      contentLength: 4096,
    });
    expect(ticket.method).toBe("PUT");
    expect(ticket.headers["content-length"]).toBe("4096");
    expect(new URL(ticket.url).searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
  });

  it("strips quotes and newlines out of a download filename", async () => {
    // The filename can carry user data, and a newline in a response header
    // is header injection.
    const url = await (await r2()).readUrl("renders", "e.zip", 300, {
      downloadAs: 'evil".zip\r\nX-Injected: yes',
    });
    const disposition = new URL(url).searchParams.get("response-content-disposition")!;
    expect(disposition).not.toMatch(/[\r\n"]/.source.replace(/"/, '"'));
    expect(disposition).toContain("evil.zipX-Injected: yes".slice(0, 8));
  });

  it("treats a missing object as deleted rather than as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    await expect((await r2()).remove("media", ["gone.jpg"])).resolves.toBeUndefined();
  });

  it("names the object when a delete genuinely fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect((await r2()).remove("media", ["x.jpg"])).rejects.toThrow(/x\.jpg/);
  });

  it("deletes a large set without firing them all at once", async () => {
    let live = 0;
    let peak = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        peak = Math.max(peak, ++live);
        await new Promise((r) => setTimeout(r, 1));
        live--;
        return new Response(null, { status: 204 });
      })
    );
    await (await r2()).remove("media", Array.from({ length: 60 }, (_, i) => `k${i}.jpg`));
    expect(peak).toBeLessThanOrEqual(8);
  });
});

describe("choosing a store", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    setObjectStore(null);
  });

  it("stays on Supabase unless told otherwise", () => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.DEMO_MODE;
    setObjectStore(null);
    expect(getObjectStore().name).toBe("supabase");
  });

  it("uses the in-memory one in demo mode, which provisions nothing", () => {
    delete process.env.STORAGE_PROVIDER;
    process.env.DEMO_MODE = "1";
    setObjectStore(null);
    expect(getObjectStore().name).toBe("memory");
  });

  it("switches to R2 on one setting", () => {
    process.env.STORAGE_PROVIDER = "r2";
    setObjectStore(null);
    expect(getObjectStore().name).toBe("r2");
  });

  it("treats a blank setting as unset rather than as a provider", () => {
    // Copying .env.example and filling in only some of it leaves variables
    // present and empty. `??` would take "" and try to load a provider by
    // that name; every one of these has to be `||`.
    process.env.STORAGE_PROVIDER = "";
    delete process.env.DEMO_MODE;
    setObjectStore(null);
    expect(getObjectStore().name).toBe("supabase");
  });

  it("falls back to the real bucket names when they are blank", async () => {
    process.env.STORAGE_PROVIDER = "r2";
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "k";
    process.env.R2_SECRET_ACCESS_KEY = "s";
    process.env.R2_ENDPOINT = "";
    process.env.R2_MEDIA_BUCKET = "";
    setObjectStore(null);
    const url = await getObjectStore().readUrl("media", "a.jpg", 300);
    expect(new URL(url).host).toBe("acct.r2.cloudflarestorage.com");
    expect(new URL(url).pathname).toBe("/qotidia-media/a.jpg");
  });

  it("has exactly two buckets", () => {
    expect(BUCKETS).toEqual(["media", "renders"]);
  });
});

describe("what a browser is allowed to store", () => {
  const actions = readFileSync(new URL("../src/app/actions.ts", import.meta.url), "utf8");
  const list = actions.slice(actions.indexOf("const STORABLE"), actions.indexOf("};", actions.indexOf("const STORABLE")));

  it("refuses SVG", () => {
    // An SVG is a document that can carry script, served from our own
    // origin through a signed URL. It is the one image type that is also an
    // attack.
    expect(list).not.toContain("svg");
  });

  it("refuses anything a browser would execute or render as a page", () => {
    for (const dangerous of ["text/html", "application/xhtml", "text/javascript", "application/pdf"]) {
      expect(list).not.toContain(dangerous);
    }
  });

  it("allows the formats a phone actually produces", () => {
    for (const ok of ["image/jpeg", "image/png", "image/heic", "audio/webm", "audio/mp4"]) {
      expect(list).toContain(ok);
    }
  });

  it("computes the path from the signed-in user rather than accepting one", () => {
    // The old upload path was built in the browser and policed by a storage
    // policy. There is no such policy on R2, so this is now the only thing
    // standing between a client and another family's prefix.
    expect(actions).toContain("const storagePath = `${user.id}/${input.subjectId}/${safeChecksum}.${extension}`");
    expect(actions).toContain('if (!storagePath.startsWith(`${user.id}/`)) throw new Error("not yours to remove")');
  });
});
