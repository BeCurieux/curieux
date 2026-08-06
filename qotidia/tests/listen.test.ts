// "Hear this moment" — the printed QR that plays a recording.
//
// The privacy shape matters more than the feature: a printed code is handed
// to people who will never have an account, so the boundary has to hold in
// SQL rather than in the UI. These tests pin both.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_QR_INCHES, listenUrl, qrDataUri, qrIsScannable } from "@/lib/listen/qr";
import { renderBookHtml } from "@/lib/pdf/html";
import { colourForAge } from "@/lib/book/colours";
import { IMPRINT } from "@/lib/brand";

const COVER = {
  childName: "Florence", ageWord: "TWO", year: "2028",
  imprint: IMPRINT, colour: colourForAge(2), spineWidthMm: 12.8,
};

const listenSql = readFileSync(
  join(__dirname, "..", "supabase", "migrations", "0005_listen.sql"),
  "utf8"
);

describe("listen URLs and codes", () => {
  it("builds a token-scoped URL per memory", () => {
    const url = listenUrl("tok-123", "mem-456");
    expect(url).toMatch(/\/listen\/tok-123\/mem-456$/);
  });

  it("encodes a QR as a self-contained data URI", async () => {
    const uri = await qrDataUri(listenUrl("tok", "mem"));
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    // Nothing to fetch at print time — the whole code travels in the PDF.
    const svg = Buffer.from(uri.split(",")[1], "base64").toString("utf8");
    expect(svg).toContain("<svg");
    expect(svg).not.toMatch(/https?:\/\/[^"]*\.(png|jpg|css|js)/);
  });

  it("holds a scannable minimum size", () => {
    expect(qrIsScannable(MIN_QR_INCHES)).toBe(true);
    expect(qrIsScannable(MIN_QR_INCHES - 0.05)).toBe(false);
  });
});

describe("the printed page", () => {
  const page = {
    pageNumber: 19,
    archetype: "portrait_plus_story" as const,
    blocks: [{ type: "quote" as const, content: "Moon gone to work." }],
  };

  it("prints no code when there is no recording", () => {
    const html = renderBookHtml({ cover: COVER, pages: [page] }, "print");
    // The stylesheet always carries the rule; what must be absent is the mark.
    expect(html).not.toContain(`<div class="listen">`);
    expect(html).not.toContain("Hear this moment");
  });

  it("prints the code and its label when there is one", () => {
    const html = renderBookHtml(
      { cover: COVER, pages: [{ ...page, listen: { qrDataUri: "data:image/svg+xml;base64,AAA", label: "Hear this moment" } }] },
      "print"
    );
    expect(html).toContain("Hear this moment");
    expect(html).toContain("data:image/svg+xml;base64,AAA");
  });

  it("places the mark on the outer edge, clear of the gutter", () => {
    const html = renderBookHtml(
      { cover: COVER, pages: [{ ...page, listen: { qrDataUri: "d", label: "Hear this moment" } }] },
      "print"
    );
    // Page 19 is odd, so it falls on the right and its outer edge is the right.
    expect(html).toMatch(/class="listen"[^>]*right:16mm/);
  });
});

describe("listen access boundaries (§4)", () => {
  it("only a token that exists resolves anything", () => {
    expect(listenSql).toMatch(/b\.listen_token = token/);
    expect(listenSql).toMatch(/b\.listen_token is not null/);
  });

  it("reaches only recordings actually printed in that token's book", () => {
    // The join chain is the boundary: book → its pages → their blocks → memory.
    expect(listenSql).toMatch(/join book_pages p\s+on p\.book_id = b\.id/);
    expect(listenSql).toMatch(/join book_content_blocks c on c\.page_id = p\.id/);
  });

  it("serves voice memories only, never photographs", () => {
    expect(listenSql).toMatch(/m\.type = 'voice'/);
    expect(listenSql).toMatch(/a\.mime_type like 'audio\/%'/);
  });

  it("exposes resolve_listen to anonymous callers and nothing else", () => {
    expect(listenSql).toMatch(/grant execute on function resolve_listen\(uuid, uuid\) to anon, authenticated/);
    // Minting and revoking must never be reachable anonymously.
    expect(listenSql).toMatch(/revoke all on function mint_listen_token\(uuid\) from public/);
    expect(listenSql).not.toMatch(/grant execute on function mint_listen_token[^;]*anon/);
    expect(listenSql).not.toMatch(/grant execute on function book_listenable[^;]*anon/);
  });

  it("revoking is possible without deleting the recordings", () => {
    expect(listenSql).toMatch(/revoke_listen_token/);
    expect(listenSql).toMatch(/set listen_token = null/);
  });

  it("only the owner may revoke", () => {
    expect(listenSql).toMatch(/where id = bid and owns_book\(bid\)/);
  });

  it("only the owner may list a book's listenable moments", () => {
    expect(listenSql).toMatch(/and owns_book\(bid\)/);
  });
});
