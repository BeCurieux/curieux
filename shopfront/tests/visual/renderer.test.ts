/**
 * The ingester's last rung, run against a real browser.
 *
 * `createPlaywrightRenderer` is the only part of the ingester that has never
 * been executed by a test. `tests/ingest.test.ts` covers the ladder thoroughly,
 * but with a hand-written `Renderer` object — so it proves the ladder *calls*
 * the rung correctly and proves nothing about whether the rung works. This file
 * launches Chromium and points it at a fixture storefront.
 *
 * The fixture is the argument for the rung existing. Its `/collections/all`
 * carries no product links in the HTML the server sends; a script writes them
 * in on load. A plain `fetch` of that page finds nothing, which is exactly the
 * store the ladder falls through three rungs to reach. The first test asserts
 * both halves of that — the miss and the hit — because a fixture that a plain
 * fetch could also read would make the whole file pass without a browser.
 *
 * Lives in the browser suite for the reason the suite exists: it needs a
 * Chromium, and a machine without one should skip rather than go red.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPlaywrightRenderer, type Renderer } from "@/lib/ingest/renderer";
import { browserAvailable, chromiumPath } from "./harness";

/** Handles the fixture will admit to, once it has run its script. */
const HANDLES = ["oat-crew", "wool-throw", "linen-tea-towel"];

interface Fixture {
  origin: string;
  close(): Promise<void>;
}

/**
 * A storefront whose catalogue only exists after JavaScript runs.
 *
 * Not a strawman: a store on a headless or app-shell theme serves exactly this
 * — a container and a script — and its `/products.json` is off, which is how a
 * request gets down here in the first place.
 */
async function startJsOnlyStore(): Promise<Fixture> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (url.pathname === "/collections/all") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      // Built through the DOM rather than by assembling an HTML string: a
      // string-building script would put the literal `href="/products/` into
      // the source it is supposed to be withholding, and the miss assertion
      // below would fail against its own fixture. (It did, the first time.)
      res.end(`<!doctype html><html><head><title>Kelp &amp; Cotton</title></head><body>
<div id="grid"></div>
<script>
  const handles = ${JSON.stringify(HANDLES)};
  // Deliberately after a tick. A synchronous script would already be done by
  // the time \`domcontentloaded\` fires, so the renderer would find the links
  // whether or not it waits for them — and the wait is the part that makes
  // this rung work on a storefront that fetches its own catalogue.
  setTimeout(() => {
    const grid = document.getElementById("grid");
    for (const h of handles) {
      const a = document.createElement("a");
      a.setAttribute("href", "/produ" + "cts/" + h);
      a.textContent = h;
      grid.appendChild(a);
    }
  }, 400);
</script>
</body></html>`);
      return;
    }

    const product = /^\/products\/([a-z0-9-]+)\.json$/.exec(url.pathname);
    if (product) {
      const handle = product[1]!;
      if (!HANDLES.includes(handle)) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ product: { handle, title: handle.replace(/-/g, " ") } }));
      return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const describeBrowser = browserAvailable() ? describe : describe.skip;

describeBrowser("the Playwright renderer", () => {
  let fixture: Fixture;
  let renderer: Renderer;

  beforeAll(async () => {
    fixture = await startJsOnlyStore();
    // Passed explicitly rather than left to the environment — see the
    // CHROMIUM_PATH test at the bottom for why that distinction matters.
    const built = createPlaywrightRenderer({ executablePath: chromiumPath()! });
    expect(built, "a browser was found but the renderer refused to build").not.toBeNull();
    renderer = built!;
  }, 120_000);

  afterAll(async () => {
    await renderer?.close();
    await fixture?.close();
  });

  it("reads a catalogue that only exists after JavaScript runs", async () => {
    const target = `${fixture.origin}/collections/all`;

    // The miss first. If this ever finds links, the fixture has stopped being
    // the kind of store this rung is for and the assertion below proves
    // nothing.
    const served = await fetch(target).then((r) => r.text());
    expect(served).not.toContain('href="/products/');

    const { html, url } = await renderer.render(target);
    expect(url).toBe(target);
    for (const handle of HANDLES) {
      expect(html, `rendered HTML is missing ${handle}`).toContain(`/products/${handle}`);
    }
  });

  it("fetches product JSON through the browser's own context", async () => {
    // Not a convenience wrapper around fetch: going through the browser
    // context carries the session and headers the render already established,
    // which is what makes this rung reach stores that answer a bare request
    // with a challenge page.
    const body = await renderer.json(`${fixture.origin}/products/oat-crew.json`);
    expect(body).toEqual({ product: { handle: "oat-crew", title: "oat crew" } });
  });

  it("throws on a missing product rather than returning a 404 body", async () => {
    // The ladder catches this per-handle and records it in the trace; if it
    // resolved instead, a 404 page would be parsed as a product.
    await expect(renderer.json(`${fixture.origin}/products/nope.json`)).rejects.toThrow("HTTP 404");
  });

  it("gives up quickly on a page with no products rather than hanging", async () => {
    // `render` waits for a product link with its own short timeout and then
    // returns what it has. A store with none must not cost the caller the full
    // page timeout.
    const started = Date.now();
    const { html } = await renderer.render(`${fixture.origin}/nothing-here`);
    expect(html).toContain("not found");
    expect(Date.now() - started).toBeLessThan(20_000);
  });

  it("is unavailable without CHROMIUM_PATH, even where Playwright has a browser", async () => {
    // Current behaviour, asserted rather than assumed, because it is the sharp
    // edge in this file: the renderer resolves *only* from CHROMIUM_PATH and
    // does not fall back to the browser `playwright install` puts on disk. On
    // a machine where the visual suite runs green, the ingester's last rung can
    // still be switched off — and it says so in the trace as "no browser
    // available" rather than failing, so nothing draws attention to it.
    //
    // Left as-is rather than quietly changed: turning the rung on where it is
    // currently off changes what the ingester does to real storefronts, which
    // is a decision rather than a fix.
    const saved = process.env.CHROMIUM_PATH;
    const savedAlt = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    delete process.env.CHROMIUM_PATH;
    delete process.env.PLAYWRIGHT_CHROMIUM_PATH;
    try {
      expect(createPlaywrightRenderer()).toBeNull();
    } finally {
      if (saved !== undefined) process.env.CHROMIUM_PATH = saved;
      if (savedAlt !== undefined) process.env.PLAYWRIGHT_CHROMIUM_PATH = savedAlt;
    }
  });
});
