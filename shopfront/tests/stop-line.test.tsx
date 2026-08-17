/**
 * Step 7 — Stop — as a test.
 *
 * "OAuth sync, email capture, billing, word-editing and TikTok-URL input are
 * Sprint 3, gated on the kill-test result."
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
 * to delete it or to open the gate on purpose.
 *
 * **Creator shops were opened on purpose, ahead of the kill test, on the
 * owner's explicit call.** Their two checks used to live here and were deleted
 * in the commit that built the feature. That is the shape this file wants an
 * override to take: the rule is removed where it is written down, in the same
 * change, by somebody who has decided — not satisfied by naming a field
 * something else.
 *
 * **The Shopify app's offline core was opened the same way (2026-08-17).** The
 * OAuth check below used to be absolute and is now narrower; the comment above
 * it says exactly what was opened, what stays shut, and what would have to be
 * decided again. Nothing was renamed to get past it.
 *
 * Every other check below is untouched and still means what it said, and the
 * last one — the drawer — means it most of all: refresh reads stock, and
 * nothing here may read an outcome.
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
  /*
   * **This check was narrowed on purpose, on the owner's call (2026-08-17), and
   * it used to be absolute.**
   *
   * It read "has no Shopify OAuth or Admin API anywhere" and it banned the
   * Admin API URL, the access-token header, the OAuth endpoints and the token
   * prefixes outright. `src/lib/shopify/admin/client.ts` trips two of those,
   * with the real `/admin/api/<version>/graphql.json` path and the real
   * `X-Shopify-Access-Token` header, because the alternative was to name them
   * something else — and a guard you dodge by renaming a constant is a guard
   * that has stopped meaning anything. The creator-shops override is the
   * precedent: the rule gets removed where it is written down, in the commit
   * that builds the thing, by somebody who has decided.
   *
   * What was opened: the offline core of the Shopify app — HMAC verification,
   * the delivery envelope, idempotency, the token lifecycle, an Admin client
   * behind an injected transport, and the catalogue mapper. All of it pure, all
   * of it tested against fakes, none of it reachable from the running app.
   *
   * What stays shut, and is what the three assertions below now hold:
   *
   *   1. No OAuth endpoint is called. The token *lifecycle* is built; the token
   *      *acquisition* is not. `token.ts` takes an injected refresh function and
   *      names no Shopify URL.
   *   2. No route is wired. Nothing under `app/` reaches `lib/shopify`, so
   *      there is no install flow, no callback and no webhook endpoint — the
   *      app cannot be installed by anybody.
   *   3. The credential-free ingester does not depend on any of it. This is the
   *      important one and it is new: `pnpm ingest` reads a public
   *      `/products.json` with no credentials, and that is what lets a shop be
   *      built for a merchant who has agreed to nothing. The app is an upgrade
   *      path, not a replacement, and a one-way dependency is how that stays
   *      true under people who did not read this comment.
   *
   * See SHOPIFY-APP.md. Building past stage 0 means opening this again.
   */
  it("builds no Shopify OAuth endpoint call and wires the app into no route", async () => {
    const files = await sourceFiles();

    const shopify = files.filter(({ file }) => file.startsWith("lib/shopify/"));
    // A guard about an empty directory passes for the wrong reason.
    expect(shopify.length).toBeGreaterThan(0);

    // 1. The lifecycle exists; the endpoint does not. Acquiring a token is what
    //    turns this from a library into an installable app, and that is stage 1.
    const acquires = files.filter(({ text }) =>
      /oauth\/authorize|oauth\/access_token/.test(code(text)),
    );
    expect(acquires.map((o) => o.file)).toEqual([]);

    // 2. Nothing serves it. No install route, no callback, no webhook endpoint.
    const routed = files.filter(
      ({ file, text }) => file.startsWith("app/") && /lib\/shopify|@\/lib\/shopify/.test(text),
    );
    expect(routed.map((o) => o.file)).toEqual([]);
  });

  it("keeps the credential-free ingester independent of the app", async () => {
    // The public path is not a stopgap. It is what makes the kill test possible
    // at all — thirty shops built from public storefront data for merchants who
    // have agreed to nothing — and it is the whole sales motion. The app maps
    // *into* the ingester's output type and depends on it one way.
    //
    // Stated as a dependency rather than a word list, for the same reason the
    // refresh guard below is: this is the real boundary. `lib/shopify` may know
    // everything about the ingester's contract; the ingester may not know the
    // app exists.
    const files = await sourceFiles();

    const publicPath = files.filter(
      ({ file }) =>
        file.startsWith("lib/ingest/") ||
        file.startsWith("lib/genome/") ||
        file.startsWith("lib/merchandise/") ||
        file.startsWith("lib/render/") ||
        file.startsWith("lib/smart/") ||
        file.startsWith("lib/killtest/"),
    );
    expect(publicPath.length).toBeGreaterThan(0);

    const offenders = publicPath.filter(({ text }) => /lib\/shopify|@\/lib\/shopify/.test(text));
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

  it("refreshes a shop against stock, never against what anybody clicked", async () => {
    // The specific way the drawer would open now that shops can rebuild
    // themselves. "Products nobody clicked drop down the page" is one import
    // away from the refresh rules and is a learned weight wearing a sensible
    // hat, so the import is what gets forbidden.
    //
    // Stated as a dependency rather than as a word list because that is the
    // real boundary: `lib/smart` may know everything about a catalogue and
    // nothing about a session.
    const files = await sourceFiles();
    const smart = files.filter(({ file }) => file.startsWith("lib/smart/"));
    expect(smart.length).toBeGreaterThan(0);

    const offenders = smart.filter(({ text }) => /from\s+["']@?[\w/.-]*funnel/i.test(text));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });
});
