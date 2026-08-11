/**
 * Brand context from a homepage: name, logo, colours, voice.
 *
 * Every field is sourced in a stated order of preference, and every field is
 * allowed to come back missing. The temptation in a file like this is to fill
 * gaps — to title-case the domain into a "brand name", to call the first
 * image a logo. That is how a generated shop ends up subtly wrong in a way
 * the merchant notices immediately and we never do.
 *
 * `name` is the one exception, and only because a shop with no name cannot
 * render at all: it falls back to the hostname, and says so in a warning.
 */

import type { BrandContext, VoiceEvidence } from "./types";
import {
  collapse,
  extractAnchors,
  extractButtonLabels,
  extractHeadings,
  extractHtmlLang,
  extractImages,
  extractJsonLd,
  extractLinks,
  extractMeta,
  extractProse,
  extractScriptSrcs,
  extractStyleBlocks,
  extractTitle,
  jsonLdOfType,
} from "./html";
import { collectColours, suggestColorway } from "./colour";
import { absoluteUrl } from "./url";

export interface BrandExtractionInput {
  html: string;
  /** The canonical storefront origin, after redirects. */
  storeUrl: URL;
  /** Stylesheet bodies fetched alongside the homepage, if any. */
  stylesheets?: string[];
}

export interface BrandExtraction {
  brand: BrandContext;
  warnings: string[];
  /** Review platform detected on the page, for the honesty rule in types.ts. */
  reviewPlatform: string | null;
  /** True if the page carries Shopify's fingerprints. */
  looksShopify: boolean;
}

const SOCIAL_HOSTS: Record<string, string> = {
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "facebook.com": "facebook",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "pinterest.com": "pinterest",
  "threads.net": "threads",
  "threads.com": "threads",
  "linkedin.com": "linkedin",
};

const REVIEW_PLATFORMS: Record<string, string> = {
  "judge.me": "judge.me",
  "yotpo.com": "yotpo",
  "okendo.io": "okendo",
  "stamped.io": "stamped.io",
  "loox.io": "loox",
  "reviews.io": "reviews.io",
  "trustpilot.com": "trustpilot",
  "junip.co": "junip",
};

export function extractBrandContext(input: BrandExtractionInput): BrandExtraction {
  const { html, storeUrl } = input;
  const warnings: string[] = [];
  const meta = extractMeta(html);
  const jsonLd = extractJsonLd(html);
  const organisations = jsonLdOfType(jsonLd, "Organization", "Store", "OnlineStore", "WebSite", "LocalBusiness");

  // ---- name ----------------------------------------------------------
  // Ordered by how deliberately each source was set. og:site_name and JSON-LD
  // are configured; <title> is a template with the page name glued on.
  const jsonLdName = firstString(organisations, "name");
  const name =
    meta.first("og:site_name", "application-name", "apple-mobile-web-app-title") ??
    jsonLdName ??
    shopifyShopName(html) ??
    titleBrand(extractTitle(html)) ??
    hostnameBrand(storeUrl);

  if (!meta.first("og:site_name") && !jsonLdName) {
    warnings.push(
      `Brand name inferred rather than declared (using "${name}") — the storefront sets no og:site_name or JSON-LD organisation name.`,
    );
  }

  // ---- description / tagline ------------------------------------------
  const description = meta.first("og:description", "description", "twitter:description");
  const tagline = description ? firstSentence(description) : taglineFromTitle(extractTitle(html), name);

  // ---- logo ------------------------------------------------------------
  const logoUrl = findLogo(html, organisations, storeUrl);
  if (!logoUrl) warnings.push("No logo found on the homepage — the renderer will set the name as type.");

  const socialImageUrl = absoluteUrl(meta.first("og:image", "twitter:image"), storeUrl);

  // ---- colour ----------------------------------------------------------
  // Inline <style> first: on a Shopify storefront that is where the theme's
  // colour schemes live, and it is present even when the external stylesheet
  // is too large to be worth fetching.
  const cssSources = [...extractStyleBlocks(html), ...(input.stylesheets ?? [])];
  const palette = collectColours(cssSources).slice(0, 24);
  const themeColor = meta.first("theme-color");
  const suggestedColorway = suggestColorway(palette, themeColor);
  if (palette.length === 0) {
    warnings.push("No colours readable from the homepage — falling back to a neutral colourway.");
  }

  // ---- links -----------------------------------------------------------
  const anchors = extractAnchors(html);
  const { links, socialLinks } = partitionLinks(anchors, storeUrl);

  // ---- voice -----------------------------------------------------------
  const voice: VoiceEvidence = {
    headings: dedupe(extractHeadings(html).map((h) => h.text)).slice(0, 20),
    sentences: dedupe([
      ...(description ? [collapse(description)] : []),
      ...extractProse(html),
    ]).slice(0, 25),
    navLabels: dedupe(links.map((l) => l.label)).slice(0, 20),
    buttonLabels: dedupe(extractButtonLabels(html)).slice(0, 12),
  };
  if (voice.headings.length + voice.sentences.length < 3) {
    warnings.push(
      "Very little copy on the homepage — it probably renders client-side, so voice evidence is thin.",
    );
  }

  const scriptSrcs = extractScriptSrcs(html);
  const reviewPlatform = detectReviewPlatform([...scriptSrcs, html.slice(0, 200_000)]);
  const looksShopify =
    /cdn\.shopify\.com|Shopify\.shop|shopify-features|myshopify\.com/i.test(html);

  return {
    brand: {
      name,
      storeUrl: storeUrl.toString(),
      ...(tagline ? { tagline } : {}),
      ...(description ? { description: collapse(description) } : {}),
      ...(logoUrl ? { logoUrl } : {}),
      ...(socialImageUrl ? { socialImageUrl } : {}),
      palette,
      suggestedColorway,
      ...(themeColor ? { themeColor } : {}),
      ...(extractHtmlLang(html) ? { locale: extractHtmlLang(html)! } : {}),
      voice,
      links,
      socialLinks,
    },
    warnings,
    reviewPlatform,
    looksShopify,
  };
}

/**
 * The shop's own name, as the Shopify runtime knows it.
 *
 * Themes emit `Shopify.shop = "brand.myshopify.com"` (the subdomain, not the
 * name) but also, in most themes, a `shop.name` in the analytics meta blob.
 * This is a better source than <title> when og:site_name is missing.
 */
function shopifyShopName(html: string): string | undefined {
  const match = /"shopName"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(html);
  if (!match?.[1]) return undefined;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return undefined;
  }
}

/**
 * "Allbirds | Wool Runners" -> "Allbirds".
 *
 * Titles are templated `{brand} {separator} {page}` or the reverse. The brand
 * is the shorter side often enough, but "shortest" alone picks "Home", so we
 * take the first segment unless it reads like a page name.
 */
const PAGE_WORDS = /^(home|shop|store|all products|new|collections?|products?|index)$/i;

function titleBrand(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const parts = title.split(/\s+[|–—·•\-]\s+/).map((p) => p.trim()).filter(Boolean);
  // A title of just "Home" names the page, not the shop. Returning it would
  // publish a shop called Home; falling through to the hostname at least
  // produces something the merchant recognises.
  const candidate = parts.find((p) => !PAGE_WORDS.test(p));
  if (!candidate || candidate.length > 60) return undefined;
  return candidate;
}

function taglineFromTitle(title: string | undefined, name: string): string | undefined {
  if (!title) return undefined;
  const parts = title.split(/\s+[|–—·•\-]\s+/).map((p) => p.trim()).filter(Boolean);
  const rest = parts.filter((p) => p.toLowerCase() !== name.toLowerCase() && !PAGE_WORDS.test(p));
  const candidate = rest.length ? rest[rest.length - 1] : undefined;
  return candidate && candidate.length <= 100 ? candidate : undefined;
}

function hostnameBrand(storeUrl: URL): string {
  const host = storeUrl.hostname.replace(/^www\./, "").replace(/\.myshopify\.com$/, "");
  const label = host.split(".")[0] ?? host;
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function findLogo(
  html: string,
  organisations: Record<string, unknown>[],
  storeUrl: URL,
): string | undefined {
  // 1. Declared in JSON-LD. The only source that says "this is our logo".
  for (const node of organisations) {
    const logo = node["logo"];
    const href =
      typeof logo === "string"
        ? logo
        : logo && typeof logo === "object" && typeof (logo as Record<string, unknown>)["url"] === "string"
          ? ((logo as Record<string, unknown>)["url"] as string)
          : undefined;
    const resolved = absoluteUrl(href, storeUrl);
    if (resolved) return resolved;
  }

  // 2. An <img> that calls itself a logo. Themes are consistent about this.
  const header = html.slice(0, Math.max(0, html.search(/<\/header>/i)) || 120_000);
  for (const attributes of extractImages(header)) {
    const haystack = [attributes["class"], attributes["id"], attributes["alt"], attributes["src"]]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!/\blogo|wordmark|brandmark\b/.test(haystack)) continue;
    // srcset first: theme logos are usually responsive, and `src` in that case
    // is often a 1px placeholder or the smallest rendition.
    const resolved =
      absoluteUrl(largestFromSrcset(attributes["srcset"]), storeUrl) ??
      absoluteUrl(attributes["src"], storeUrl);
    if (resolved) return resolved;
  }

  // 3. An icon. Square, low-resolution and often a favicon crop — a weak
  // logo, but a real asset from the brand rather than a guess.
  const icons = extractLinks(html)
    .filter((a) => (a["rel"] ?? "").toLowerCase().split(/\s+/).some((r) => r === "apple-touch-icon" || r === "icon"))
    .map((a) => ({ href: a["href"], size: Number.parseInt(a["sizes"] ?? "0", 10) || 0 }))
    .sort((a, b) => b.size - a.size);
  for (const icon of icons) {
    const resolved = absoluteUrl(icon.href, storeUrl);
    // SVG favicons are fine; .ico is a 16px browser artefact, not brand art.
    if (resolved && !resolved.toLowerCase().endsWith(".ico")) return resolved;
  }

  return undefined;
}

function largestFromSrcset(srcset: string | undefined): string | undefined {
  if (!srcset) return undefined;
  const entries = srcset
    .split(",")
    .map((entry) => entry.trim().split(/\s+/))
    .map(([url, descriptor]) => ({ url, width: Number.parseInt(descriptor ?? "", 10) || 0 }))
    .filter((e): e is { url: string; width: number } => Boolean(e.url));
  if (entries.length === 0) return undefined;
  return entries.sort((a, b) => b.width - a.width)[0]?.url;
}

function partitionLinks(
  anchors: { href: string; text: string }[],
  storeUrl: URL,
): Pick<BrandContext, "links" | "socialLinks"> {
  const links: BrandContext["links"] = [];
  const socialLinks: BrandContext["socialLinks"] = [];
  const seenLinks = new Set<string>();
  const seenSocial = new Set<string>();

  for (const anchor of anchors) {
    const url = absoluteUrl(anchor.href, storeUrl);
    if (!url) continue;
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }

    const platform = Object.entries(SOCIAL_HOSTS).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1];
    if (platform) {
      if (!seenSocial.has(platform)) {
        seenSocial.add(platform);
        socialLinks.push({ platform, url });
      }
      continue;
    }

    // Same-site nav only. Off-site links that are not social are affiliate
    // widgets and press mentions — not the merchant's own link list.
    if (host !== storeUrl.hostname.replace(/^www\./, "")) continue;
    const label = anchor.text;
    if (!label || label.length > 40) continue;
    // Product and collection URLs are the catalogue's job, not the footer's.
    if (/\/(products|cart|checkout|account|search)\b/.test(new URL(url).pathname)) continue;
    const key = `${label.toLowerCase()}|${url}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    if (links.length < 30) links.push({ label, url });
  }

  return { links, socialLinks };
}

function detectReviewPlatform(haystacks: string[]): string | null {
  const joined = haystacks.join(" ").toLowerCase();
  for (const [needle, platform] of Object.entries(REVIEW_PLATFORMS)) {
    if (joined.includes(needle)) return platform;
  }
  return null;
}

function firstString(nodes: Record<string, unknown>[], key: string): string | undefined {
  for (const node of nodes) {
    const value = node[key];
    if (typeof value === "string" && value.trim()) return collapse(value);
  }
  return undefined;
}

function firstSentence(text: string): string {
  const collapsed = collapse(text);
  const match = /^(.{10,100}?[.!?])(\s|$)/.exec(collapsed);
  if (match?.[1]) return match[1];
  return collapsed.length <= 100 ? collapsed : `${collapsed.slice(0, 97).trimEnd()}…`;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = collapse(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}
