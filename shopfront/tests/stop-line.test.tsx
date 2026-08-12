/**
 * Step 7 — Stop — as a test.
 *
 * "OAuth sync, email capture, creator shops, billing, word-editing and
 * TikTok-URL input are Sprint 3, gated on the kill-test result."
 *
 * Every other rule in CLAUDE.md has something enforcing it. This one had
 * nothing, and it is the easiest of all of them to break: none of these
 * features arrives announcing itself as Sprint 3. Email capture arrives as "the
 * capture block already exists in the schema, it's twenty minutes." Word-editing
 * arrives as "EditMove is defined, we may as well apply it." Each is individually
 * reasonable and collectively the reason the kill test never gets run.
 *
 * So the line is a test. If one of these starts failing, that is not a bug —
 * it is somebody having built a Sprint 3 feature, and the honest fix is either
 * to delete it or to run the kill test and delete this file.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockView } from "@/components/shop/blocks";
import { EditMove, ShopConfig } from "@/lib/schema";
import { SPRINT_1_BLOCK_TYPES } from "@/lib/merchandise/plan";

const SRC = path.join(process.cwd(), "src");

async function sourceFiles(): Promise<{ file: string; text: string }[]> {
  const { glob } = await import("node:fs/promises");
  const files: string[] = [];
  for await (const entry of glob("**/*.{ts,tsx}", { cwd: SRC })) files.push(entry as string);

  return Promise.all(
    files.map(async (file) => ({ file, text: await readFile(path.join(SRC, file), "utf8") })),
  );
}

/** Code, with comments stripped — a rule about behaviour, not about prose. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ")
    .toLowerCase();
}

describe("the Sprint 3 line holds", () => {
  it("has no Shopify OAuth or Admin API anywhere", async () => {
    // Step 1 is explicit: "No Shopify OAuth in this phase." Everything the
    // ingester reads is public storefront data, which is also what lets the
    // kill test run at all — no app approval needed to demo.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) => {
      const source = code(text);
      return (
        /admin\/api\/\d{4}-\d{2}/.test(source) ||
        /\bshpat_|\bshpca_/.test(source) ||
        /oauth\/authorize|oauth\/access_token/.test(source) ||
        /x-shopify-access-token/.test(source)
      );
    });
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("collects no email address", async () => {
    // The capture block is in schema.ts and renders nothing. A form that posts
    // into nothing is the dishonesty the brief rules out, and a form that posts
    // somewhere real is Sprint 3.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) => /<input|<form|type="email"/i.test(text));
    expect(offenders.map((o) => o.file)).toEqual([]);

    const html = renderToStaticMarkup(
      <BlockView
        id="capture"
        block={{ type: "capture", channel: "email", headline: "Get the drop first" }}
        context={{} as never}
      />,
    );
    expect(html).toBe("");
  });

  it("keeps `capture` and `reviews` out of what the merchandiser may choose", () => {
    expect(SPRINT_1_BLOCK_TYPES).not.toContain("capture");
    expect(SPRINT_1_BLOCK_TYPES).not.toContain("reviews");
    // Both still exist in the contract, which is the point: they are one line
    // from available once the thing behind them is built and the gate is open.
    const types = ShopConfig.shape.blocks.element.shape.block.options.map((o) => o.shape.type.value);
    expect(types).toContain("capture");
    expect(types).toContain("reviews");
  });

  it("defines the word-editing moves and applies none of them", async () => {
    // EditMove is deliberately specified now and unimplemented — the brief is
    // clear that open-ended editing against arbitrary page state is where trust
    // dies, so the legal set was worth designing early and is not worth
    // shipping until the gate opens.
    expect(EditMove.options.length).toBeGreaterThan(0);

    const files = await sourceFiles();
    const users = files.filter(
      ({ file, text }) => file !== "lib/schema.ts" && /\bEditMove\b/.test(text),
    );
    expect(users.map((u) => u.file)).toEqual([]);
  });

  it("takes no payment and knows nothing about a subscription", async () => {
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) => /\bstripe\b|\bcheckout\.session|\bprice_1[a-z0-9]/i.test(code(text)));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("has no creator-shop concept beyond a reserved word", async () => {
    // Creator shops are nearly the same object as a brand shop, which is what
    // makes them cheap later and tempting now.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) => /\bcreatorshop|\bcreator_id|\bcreators?\s*:/i.test(code(text)));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("accepts a store URL and a sentence, not a TikTok link", async () => {
    // "Paste a URL, not a prompt" is the demo-of-demos and explicitly a
    // fast-follow. Nothing should be reading a video yet.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) => /tiktok\.com\/@?[\w.]+\/video|oembed|transcri(be|pt)/i.test(code(text)));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("has no learned weights, experiments or scoring — the drawer stays shut", async () => {
    // PULSE. The funnel logs faithfully and nothing reads it back into a
    // decision; a column or a constant shaped for one would be the whole rule
    // broken quietly.
    const files = await sourceFiles();
    const offenders = files.filter(({ text }) =>
      /\bexperiment\b|\bvariant_?group|\bab_?test|\bbandit\b|\bweights?\s*[:=]\s*[[{]|\bpulse\b/i.test(code(text)),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });
});
