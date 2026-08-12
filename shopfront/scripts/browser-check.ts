#!/usr/bin/env tsx
/**
 * pnpm browser:check
 *
 * Does the ingester's last rung actually have a browser, and does it work?
 *
 * The rung resolves its Chromium from `CHROMIUM_PATH` and nothing else, and it
 * fails in two quiet ways. Unset, the ladder skips it and the trace reads "no
 * browser available" — a closed-feed store comes back thin and nothing says
 * why. Set to a path that is not there, the renderer builds anyway (the code
 * checks the variable, not the file) and every store fails at launch, one line
 * deep in a diagnostics trace nobody reads until the batch is over.
 *
 * A path can also look right and be wrong: `playwright-core` reports the build
 * its own version expects, which is not necessarily the build on disk. So this
 * does not stop at resolving a string — it launches, renders a page whose
 * content only exists after JavaScript runs, and checks it came back.
 *
 * Run it once before a batch. It prints the line to export.
 */

import { existsSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { chromium } from "playwright-core";

const ok = (message: string) => process.stdout.write(`  ✓ ${message}\n`);
const bad = (message: string) => process.stderr.write(`  × ${message}\n`);

/** Where the ingester itself would look, then where Playwright thinks it put one. */
function candidates(): { source: string; path: string }[] {
  const found: { source: string; path: string }[] = [];
  const fromEnv = process.env.CHROMIUM_PATH ?? process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (fromEnv) found.push({ source: "CHROMIUM_PATH", path: fromEnv });
  try {
    const resolved = chromium.executablePath();
    if (resolved) found.push({ source: "playwright-core", path: resolved });
  } catch {
    // No browsers directory at all. The env var, if set, is still worth trying.
  }
  return found;
}

/** A page whose only product link is written by a script, after a tick. */
async function startProbeStore(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html><body><div id="g"></div><script>
      setTimeout(() => {
        const a = document.createElement("a");
        a.setAttribute("href", "/produ" + "cts/probe");
        // Text matters. The rung waits for the selector to be *visible*, which
        // is Playwright's default, and an empty anchor has no size — a probe
        // without this reports a broken browser on a working one.
        a.textContent = "Probe product";
        document.getElementById("g").appendChild(a);
      }, 200);
    </script></body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/collections/all`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function main(): Promise<number> {
  process.stdout.write("\n  Checking the browser the ingester's last rung would use.\n\n");

  const found = candidates();
  if (found.length === 0) {
    bad("No Chromium anywhere: CHROMIUM_PATH is unset and playwright-core reports none.");
    process.stderr.write("\n  Install one, then re-run:\n\n    pnpm exec playwright install chromium\n\n");
    return 1;
  }

  for (const { source, path } of found) {
    if (!existsSync(path)) {
      // The common case, and the one worth naming: the version pinned in
      // package.json expects a build number that was never downloaded.
      bad(`${source} points at ${path}, which does not exist.`);
      continue;
    }
    ok(`${source}: ${path}`);

    const store = await startProbeStore();
    let browser;
    try {
      browser = await chromium.launch({ executablePath: path, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.goto(store.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector('a[href*="/products/"]', { timeout: 8_000 });
      ok("Launched, and read a catalogue that only exists after JavaScript runs.");

      if (source !== "CHROMIUM_PATH") {
        process.stdout.write(
          `\n  This one works, but the ingester will not use it — it reads CHROMIUM_PATH only.\n  Export it:\n\n    export CHROMIUM_PATH=${path}\n\n`,
        );
        return 1;
      }
      process.stdout.write("\n  The Playwright rung is on for this shell.\n\n");
      return 0;
    } catch (error) {
      bad(`Launched from ${path} and failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browser?.close().catch(() => {});
      await store.close();
    }
  }

  process.stderr.write("\n  No candidate launched. Install a matching build:\n\n    pnpm exec playwright install chromium\n\n");
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    bad(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
