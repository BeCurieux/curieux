/**
 * The last rung: a real browser.
 *
 * Most Shopify storefronts hand over their whole catalogue as JSON to anyone
 * who asks, so this exists for the minority that do not — headless-frontend
 * builds, bot-challenge proxies, and stores whose owner has switched the JSON
 * endpoints off. The brief allows exactly this ("fall back to scraping") and
 * nothing more; it is a fallback, not a strategy.
 *
 * It sits behind an interface for two reasons. The ingester's tests must not
 * need a browser binary, and the Playwright launch is expensive enough that
 * the caller — not this module — should decide whether to pay for it.
 */

import type { Browser, BrowserContext } from "playwright-core";
import { DEFAULT_USER_AGENT } from "./http";

export interface RenderedPage {
  url: string;
  html: string;
}

export interface Renderer {
  /** Load a page, run its scripts, hand back the settled DOM. */
  render(url: string): Promise<RenderedPage>;
  /**
   * Fetch JSON from inside the browser context, so the request carries the
   * cookies and headers the page earned. This is what gets a `/products.json`
   * past a challenge that a bare fetch cannot pass.
   */
  json(url: string): Promise<unknown>;
  close(): Promise<void>;
}

export interface PlaywrightRendererOptions {
  /** Defaults to CHROMIUM_PATH. Without a binary the renderer is unavailable. */
  executablePath?: string;
  userAgent?: string;
  timeoutMs?: number;
}

/**
 * Null when there is no browser to launch.
 *
 * Returning null rather than throwing keeps the ladder honest: an ingest that
 * could not reach its last rung reports "renderer unavailable" in the trace,
 * instead of failing in a way that reads like the store had no products.
 */
export function createPlaywrightRenderer(options: PlaywrightRendererOptions = {}): Renderer | null {
  const executablePath = options.executablePath ?? process.env.CHROMIUM_PATH;
  if (!executablePath) return null;

  const userAgent = options.userAgent ?? process.env.INGEST_USER_AGENT ?? DEFAULT_USER_AGENT;
  const timeoutMs = options.timeoutMs ?? 30_000;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  async function ensureContext(): Promise<BrowserContext> {
    if (context) return context;
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
    context = await browser.newContext({
      userAgent,
      // Mobile-first is the product, but a desktop viewport loads the desktop
      // nav and the full collection grid, which is what we are here to read.
      viewport: { width: 1280, height: 1600 },
      locale: "en-US",
    });
    context.setDefaultTimeout(timeoutMs);
    return context;
  }

  return {
    async render(url: string): Promise<RenderedPage> {
      const page = await (await ensureContext()).newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        // networkidle would be better and is unreliable on storefronts that
        // poll; waiting for the product-link selector with a short timeout
        // gets the same result and gives up quickly when there is none.
        await page
          .waitForSelector('a[href*="/products/"]', { timeout: 8_000 })
          .catch(() => {});
        return { url: page.url(), html: await page.content() };
      } finally {
        await page.close().catch(() => {});
      }
    },

    async json(url: string): Promise<unknown> {
      const ctx = await ensureContext();
      const response = await ctx.request.get(url, { timeout: timeoutMs });
      if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
      return (await response.json()) as unknown;
    },

    async close(): Promise<void> {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
      context = null;
      browser = null;
    },
  };
}
