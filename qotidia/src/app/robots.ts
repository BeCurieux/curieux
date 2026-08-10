// What a crawler may look at.
//
// Almost none of it. Everything behind a login is unreachable to a crawler
// anyway, so this file exists for the one route that is deliberately not:
// /m/<token>, the story a family sent to somebody who has no account.
//
// That page already sets robots meta. This is the second lock on the same
// door, and the redundancy is deliberate — a search engine that indexes one
// of these has made a family's private story public permanently, and there
// is no version of "we noticed and took it down" that undoes it. Two
// independent mechanisms, both cheap.

import type { MetadataRoute } from "next";

/** Where the app is served from. */
export const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://qotidia.com";

/**
 * Everything a crawler must not touch.
 *
 * Exported so sitemap.ts can be checked against it. One list, so a public
 * page cannot be added to the sitemap that this file is simultaneously
 * telling crawlers to stay out of — the two files disagreeing is precisely
 * the mistake that puts a family's route in front of a search engine.
 */
export const OFF_LIMITS = [
  // Shared stories. The reason this file exists.
  "/m/",
  // Everything else that is a family's, in case a route is ever
  // reachable without a session by accident.
  "/subjects/",
  "/books/",
  "/family/",
  "/settings/",
  "/listen/",
  "/invite/",
  "/api/",
  "/home",
  // The support view can reach a granting family's archive. It is behind a
  // login and an is_admin check and a grant, and it still has no business
  // in an index.
  "/admin",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/"], disallow: OFF_LIMITS }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
