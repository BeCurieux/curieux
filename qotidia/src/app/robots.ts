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

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://qotidia.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
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
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
