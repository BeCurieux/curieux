/**
 * The one place that talks to somebody else's server.
 *
 * Everything above this file is pure: give it strings, it gives you a
 * catalogue. That is what makes the ingester testable without a network, and
 * it is why `fetchImpl` is injectable rather than `fetch` being called
 * directly from six modules.
 *
 * The manners here are not decoration. During the kill-test we ingest thirty
 * storefronts that never asked us to, so: one request at a time per host, a
 * gap between them, a real timeout, a body cap, and a User-Agent that names
 * us and links somewhere a merchant can read.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpResult {
  /** Final URL after redirects — how we learn the canonical origin. */
  url: string;
  status: number;
  ok: boolean;
  contentType: string;
  body: string;
  /** True when the body hit `maxBytes` and we stopped reading. */
  truncated: boolean;
  /** Set when the request never produced a response at all. */
  error?: string;
}

export interface HttpClientOptions {
  fetchImpl?: FetchLike;
  userAgent?: string;
  timeoutMs?: number;
  /** Minimum gap between two requests to the same host. */
  minIntervalMs?: number;
  maxBytes?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_USER_AGENT =
  "PopuupBot/0.1 (+https://popuup.com/bot; reads public storefront data)";

const DEFAULTS = {
  timeoutMs: 15_000,
  minIntervalMs: 250,
  maxBytes: 4 * 1024 * 1024,
  maxAttempts: 3,
} as const;

export interface HttpClient {
  get(url: string, opts?: { accept?: string }): Promise<HttpResult>;
  /**
   * Raise the gap between requests. Called once robots.txt has been read, so
   * a store that asks for a slower crawl gets one — which cannot happen at
   * construction time, because reading robots.txt needs the client.
   */
  setMinIntervalMs(ms: number): void;
  readonly userAgent: string;
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const fetchImpl = options.fetchImpl ?? ((u, i) => fetch(u, i));
  const userAgent = options.userAgent ?? process.env.INGEST_USER_AGENT ?? DEFAULT_USER_AGENT;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  let minIntervalMs = options.minIntervalMs ?? DEFAULTS.minIntervalMs;
  const maxBytes = options.maxBytes ?? DEFAULTS.maxBytes;
  const maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  // Serialised per host rather than globally: ingesting one store is a chain
  // of requests to one origin, and a global lock would make the Shopify CDN
  // wait behind the storefront for no reason.
  const lastRequestAt = new Map<string, number>();

  async function throttle(host: string): Promise<void> {
    const previous = lastRequestAt.get(host);
    const now = Date.now();
    if (previous !== undefined) {
      const wait = previous + minIntervalMs - now;
      if (wait > 0) await sleep(wait);
    }
    lastRequestAt.set(host, Date.now());
  }

  async function once(url: string, accept: string): Promise<HttpResult> {
    const response = await fetchImpl(url, {
      headers: {
        "user-agent": userAgent,
        accept,
        "accept-language": "en",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    const contentType = response.headers.get("content-type") ?? "";
    const { text, truncated } = await readCapped(response, maxBytes, contentType);

    return {
      url: response.url || url,
      status: response.status,
      ok: response.ok,
      contentType,
      body: text,
      truncated,
    };
  }

  async function get(url: string, opts: { accept?: string } = {}): Promise<HttpResult> {
    const accept = opts.accept ?? "text/html,application/json;q=0.9,*/*;q=0.8";
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      return { url, status: 0, ok: false, contentType: "", body: "", truncated: false, error: "bad url" };
    }

    let lastError = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await throttle(host);
      try {
        const result = await once(url, accept);
        // 4xx other than 429 is an answer, not a hiccup: /products.json
        // returning 404 means this rung of the ladder is closed, and retrying
        // it twice more only makes us a worse guest.
        if (result.status === 429 || result.status >= 500) {
          lastError = `HTTP ${result.status}`;
          if (attempt < maxAttempts) {
            await sleep(backoffMs(attempt));
            continue;
          }
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < maxAttempts) await sleep(backoffMs(attempt));
      }
    }

    return { url, status: 0, ok: false, contentType: "", body: "", truncated: false, error: lastError };
  }

  return {
    get,
    setMinIntervalMs: (ms) => {
      // Only ever slower. A robots.txt asking for 0.1s must not be able to
      // make us ruder than our own floor.
      if (Number.isFinite(ms) && ms > minIntervalMs) minIntervalMs = ms;
    },
    userAgent,
  };
}

function backoffMs(attempt: number): number {
  return 500 * 2 ** (attempt - 1);
}

/**
 * Read a body, stopping at `maxBytes`.
 *
 * `response.text()` would buffer whatever the server chose to send, which on
 * a storefront homepage with an inlined theme can be tens of megabytes. We
 * only ever want the head of a document anyway — meta tags, JSON-LD, the
 * first style block — so a truncated read is a real result, not a failure.
 */
async function readCapped(
  response: Response,
  maxBytes: number,
  contentType: string,
): Promise<{ text: string; truncated: boolean }> {
  const decoder = decoderFor(contentType);

  if (!response.body) {
    const text = await response.text();
    return { text: text.slice(0, maxBytes), truncated: text.length > maxBytes };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
        truncated = true;
        break;
      }
      chunks.push(value);
    }
  } finally {
    // Cancelling matters when we broke early: without it the connection is
    // held open until the server gives up on writing the rest.
    await reader.cancel().catch(() => {});
  }

  const joined = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { text: decoder.decode(joined), truncated };
}

function decoderFor(contentType: string): TextDecoder {
  const match = /charset=["']?([\w-]+)/i.exec(contentType);
  const label = match?.[1];
  if (!label) return new TextDecoder("utf-8");
  try {
    return new TextDecoder(label);
  } catch {
    return new TextDecoder("utf-8");
  }
}

/** Did this response actually carry JSON, whatever it claims in the body? */
export function looksLikeJson(result: HttpResult): boolean {
  if (!result.ok) return false;
  if (result.contentType.includes("json")) return true;
  // Some storefronts serve products.json as text/plain. Sniffing the first
  // non-whitespace character is cheaper than being wrong about it.
  return /^\s*[[{]/.test(result.body);
}
