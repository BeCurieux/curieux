/**
 * The only file in this project that touches the network.
 *
 * Everything above it is pure and injects its own `fetch`, so the suite runs
 * without a network and a run never depends on somebody else's storefront
 * being up. That is the same shape the rest of the engine has, and it is what
 * keeps `pnpm test` honest about what it is testing.
 *
 * Three things here are conduct rather than engineering, and they are the
 * reason this file is longer than a `fetch` call:
 *
 *   - **robots.txt is obeyed.** We read a stranger's page and then write to
 *     that stranger about it. See robots.ts.
 *   - **One request at a time, with a pause.** Thirty targets is thirty pages;
 *     there is no reason to arrive as a burst on anybody's store.
 *   - **We say who we are.** A default agent string, and a contact when
 *     `SCAN_CONTACT` is set, which it should be before a real run.
 */

import { ALLOW_ALL, isAllowed, parseRobots, type Robots } from "./robots.js";
import {
  fromHtml,
  fromJsonLd,
  fromShopifyProduct,
  shopifyEndpoints,
  wholePageText,
  THIN_TEXT,
  type Extracted,
  type Via,
} from "./extract.js";

export const AGENT = "ClaimScanBot/0.1";
/** Politeness floor, used when robots.txt does not ask for more. */
export const DEFAULT_DELAY_MS = 1200;
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 4_000_000;

export type Attempt = { rung: string; url?: string; outcome: string; chars?: number };

export type FetchedCopy = {
  requestedUrl: string;
  finalUrl: string;
  title?: string;
  text: string;
  via: Via;
  /** Every rung tried, and what it gave back. "Why is this empty" is the
   *  question the kill test asks thirty times. */
  trace: Attempt[];
  /** Too little text to be a real page — usually a JS shell or a redirect. */
  thin: boolean;
  /**
   * Did any rung come back with markup at all?
   *
   * Distinct from `thin`, and the distinction is the whole point. A JS shell
   * answers 200 with nothing useful in it: retrieved, thin, and a fact worth
   * reporting. A page that timed out, was refused by the network, or 404'd
   * gives the same empty string — but nothing was read, and calling that a
   * fetch is how thirty unreachable stores became thirty clean scores.
   */
  retrieved: boolean;
  /**
   * Characters the page holds that the chosen source did not.
   */
  unseenPageChars: number;
  /**
   * The whole page as text, always, whichever rung won.
   *
   * A structured source is exactly this product and nothing else, which is why
   * it is preferred — but the hero line, the "our promise" block and the
   * sustainability paragraph are not in a product description, and those are
   * where environmental claims actually live. So the caller gets both and can
   * check one against the other; `pnpm scan --whole` scans this instead.
   */
  pageText: string;
};

export class RobotsDisallowed extends Error {
  constructor(readonly url: string) {
    super(
      `robots.txt disallows ${url}.\n` +
        `If this is your own site, pass --own. Otherwise this page is not ours to read.`,
    );
    this.name = "RobotsDisallowed";
  }
}

export type Transport = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) =>
  Promise<{ status: number; headers: { get(name: string): string | null }; text(): Promise<string>; url?: string }>;

export type FetchOptions = {
  /** Injected everywhere but the CLI, so tests need no network. */
  transport?: Transport;
  /** Skip the robots check. Only legitimate for a site the user owns. */
  own?: boolean;
  /** Contact address advertised in the agent string. Never defaulted. */
  contact?: string;
  /** Milliseconds between requests to the same host. */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function agentFor(contact: string | undefined): string {
  return contact ? `${AGENT} (+${contact})` : AGENT;
}

async function get(
  url: string,
  transport: Transport,
  contact: string | undefined,
): Promise<{ status: number; body: string; finalUrl: string; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await transport(url, {
      headers: {
        "user-agent": agentFor(contact),
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "en",
      },
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      status: response.status,
      body: body.length > MAX_BYTES ? body.slice(0, MAX_BYTES) : body,
      finalUrl: response.url ?? url,
      contentType: response.headers.get("content-type") ?? "",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Cached per host for the life of a run, so thirty targets is not thirty
 *  robots.txt fetches at one store. */
const robotsCache = new Map<string, Robots>();

export function clearRobotsCache(): void {
  robotsCache.clear();
}

export async function robotsFor(
  origin: string,
  transport: Transport,
  contact: string | undefined,
): Promise<Robots> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;

  let robots: Robots;
  try {
    const response = await get(`${origin}/robots.txt`, transport, contact);
    if (response.status >= 200 && response.status < 300) {
      robots = parseRobots(response.body, AGENT);
    } else if (response.status >= 400 && response.status < 500) {
      // No robots.txt is the same as an empty one. This is the common case.
      robots = ALLOW_ALL;
    } else {
      // A 5xx means the site could not tell us its rules. Reading anyway and
      // then writing to the owner about what we found is the wrong order of
      // operations, so this fails closed and says so.
      robots = { rules: [{ allow: false, pattern: "/" }], crawlDelaySeconds: null };
    }
  } catch {
    robots = { rules: [{ allow: false, pattern: "/" }], crawlDelaySeconds: null };
  }
  robotsCache.set(origin, robots);
  return robots;
}

function looksLikeJson(contentType: string, body: string): boolean {
  if (contentType.includes("json")) return true;
  const head = body.trimStart()[0];
  return head === "{" || head === "[";
}

/**
 * A URL to the words on it, by the ladder in extract.ts.
 *
 * Every rung lands in the trace whether it worked or not, and the result is
 * the first one that produced real text. Nothing throws for a page that came
 * back thin — a thin page is a fact to report, not a failure to hide.
 */
export async function fetchCopy(pageUrl: string, options: FetchOptions = {}): Promise<FetchedCopy> {
  const transport = options.transport ?? ((url, init) => fetch(url, init) as ReturnType<Transport>);
  const sleep = options.sleep ?? wait;
  const { contact } = options;
  const trace: Attempt[] = [];

  const url = new URL(pageUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${pageUrl} is not an http(s) URL.`);
  }

  let delayMs = options.delayMs ?? DEFAULT_DELAY_MS;

  if (options.own) {
    trace.push({ rung: "robots.txt", outcome: "skipped — --own, this is the user's site" });
  } else {
    const robots = await robotsFor(url.origin, transport, contact);
    if (robots.crawlDelaySeconds !== null) {
      delayMs = Math.max(delayMs, robots.crawlDelaySeconds * 1000);
    }
    const allowed = isAllowed(robots, `${url.pathname}${url.search}`);
    trace.push({
      rung: "robots.txt",
      url: `${url.origin}/robots.txt`,
      outcome: allowed ? "allows this path" : "disallows this path",
    });
    if (!allowed) throw new RobotsDisallowed(pageUrl);
  }

  // ------------------------------------------------- rung 1: Shopify product
  let extracted: Extracted | null = null;
  for (const endpoint of shopifyEndpoints(pageUrl)) {
    if (extracted) break;
    await sleep(delayMs);
    try {
      const response = await get(endpoint, transport, contact);
      if (response.status < 200 || response.status >= 300) {
        trace.push({ rung: "shopify product json", url: endpoint, outcome: `HTTP ${response.status}` });
        continue;
      }
      if (!looksLikeJson(response.contentType, response.body)) {
        trace.push({ rung: "shopify product json", url: endpoint, outcome: "not JSON — theme served HTML" });
        continue;
      }
      const parsed = fromShopifyProduct(JSON.parse(response.body));
      trace.push({
        rung: "shopify product json",
        url: endpoint,
        outcome: parsed ? "product found" : "JSON held no title or description",
        chars: parsed?.text.length,
      });
      if (parsed) extracted = parsed;
    } catch (error) {
      trace.push({
        rung: "shopify product json",
        url: endpoint,
        outcome: error instanceof Error ? error.message.split("\n")[0] ?? "failed" : "failed",
      });
    }
  }

  // ------------------------------------------------------------ the page
  await sleep(delayMs);
  let html = "";
  let finalUrl = pageUrl;
  try {
    const response = await get(pageUrl, transport, contact);
    finalUrl = response.finalUrl;
    if (response.status < 200 || response.status >= 300) {
      trace.push({ rung: "page", url: pageUrl, outcome: `HTTP ${response.status}` });
    } else {
      html = response.body;
      trace.push({ rung: "page", url: pageUrl, outcome: "fetched", chars: html.length });
    }
  } catch (error) {
    trace.push({
      rung: "page",
      url: pageUrl,
      outcome: error instanceof Error ? error.message.split("\n")[0] ?? "failed" : "failed",
    });
  }

  const pageText = html ? wholePageText(html) : "";

  // ---------------------------------------------------- rungs 2, 3 and 4
  if (!extracted && html) {
    const jsonLd = fromJsonLd(html);
    trace.push({
      rung: "json-ld product",
      outcome: jsonLd ? "product found" : "no Product node on the page",
      chars: jsonLd?.text.length,
    });
    if (jsonLd && jsonLd.text.length >= THIN_TEXT) extracted = jsonLd;
  }

  if (!extracted && html) {
    const page = fromHtml(html);
    trace.push({
      rung: page.via === "main-region" ? "main region" : "whole page",
      outcome: "read from the markup",
      chars: page.text.length,
    });
    extracted = page;
  }

  if (!extracted) {
    return {
      requestedUrl: pageUrl,
      finalUrl,
      text: "",
      via: "whole-page",
      trace,
      thin: true,
      retrieved: false,
      unseenPageChars: 0,
      pageText,
    };
  }

  const unseenPageChars = Math.max(0, pageText.length - extracted.text.length);
  if (unseenPageChars > 0 && extracted.via !== "whole-page") {
    trace.push({
      rung: "coverage",
      outcome: `${unseenPageChars} characters of the page sit outside what was read`,
      chars: pageText.length,
    });
  }

  return {
    requestedUrl: pageUrl,
    finalUrl,
    title: extracted.title,
    text: extracted.text,
    via: extracted.via,
    trace,
    thin: extracted.text.length < THIN_TEXT,
    retrieved: true,
    unseenPageChars,
    pageText,
  };
}
