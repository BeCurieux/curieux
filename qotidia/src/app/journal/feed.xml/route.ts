// The feed.
//
// Worth the forty lines for a reason that has nothing to do with traffic: it
// is the one distribution channel nobody owns. A search engine can change its
// mind about a site overnight and a social network can decide links are worth
// less this quarter; a feed is a file, and somebody who subscribes to it stays
// subscribed. For a product whose whole argument is that things should outlast
// the companies that made them, publishing one is close to obligatory.
//
// Atom rather than RSS: dates are unambiguous, the spec is shorter, and every
// reader handles it.
//
// Read from the same published() list as the index and the sitemap, so an
// entry cannot be live in one place and missing from another.

import { BRAND, ONE_LINER } from "@/lib/brand";
import { BASE } from "@/app/robots";
import { lastPublished, published } from "@/lib/journal/entries";

export const dynamic = "force-static";

/** XML has five characters that must not appear raw. Prose has all of them. */
function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * A date-only string as the timestamp Atom requires.
 *
 * Validated rather than trusted. The value comes from our own registry and
 * is a date, so interpolating it raw is safe — but "safe because of where it
 * came from" is the reasoning that stops being true the day somebody adds a
 * field. Checking the shape here makes it safe because of what it is, and
 * means the escaping guard in tests/journal.test.ts does not need an
 * exception carved into it.
 */
function atomTime(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`journal date is not a date: ${JSON.stringify(day)}`);
  }
  return `${day}T00:00:00Z`;
}

export async function GET() {
  const entries = published();

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escape(BRAND)} — journal</title>
  <subtitle>${escape(ONE_LINER)}</subtitle>
  <link href="${BASE}/journal/feed.xml" rel="self"/>
  <link href="${BASE}/journal"/>
  <id>${BASE}/journal</id>
  <updated>${atomTime(lastPublished())}</updated>
${entries
  .map(
    (e) => `  <entry>
    <title>${escape(e.title)}</title>
    <link href="${BASE}/journal/${e.slug}"/>
    <id>${BASE}/journal/${e.slug}</id>
    <published>${atomTime(e.published)}</published>
    <updated>${atomTime(e.updated ?? e.published)}</updated>
    <summary>${escape(e.description)}</summary>
  </entry>`
  )
  .join("\n")}
</feed>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      // An hour. Long enough to be worth caching, short enough that a
      // correction to something published in error is not stuck for a day.
      "cache-control": "public, max-age=3600",
    },
  });
}
