/**
 * robots.txt, honoured.
 *
 * This is not a technicality here and it is not really about crawling. The
 * kill test scans a stranger's product page and then writes to that stranger
 * about it. If the first thing the message can be answered with is "you
 * ignored our robots.txt", the pitch has become a conversation about our
 * conduct rather than about their copy, and there is no version of that
 * conversation the product wins.
 *
 * The parse is the ordinary one: group by User-agent, take the group matching
 * our token if there is one and the `*` group otherwise, and let the longest
 * matching rule win with Allow beating Disallow on a tie. Wildcards and `$`
 * are supported because real robots.txt files use them.
 */

export type RobotsRule = { allow: boolean; pattern: string };
export type Robots = { rules: RobotsRule[]; crawlDelaySeconds: number | null };

/** Nothing to obey. What a 404 on robots.txt means. */
export const ALLOW_ALL: Robots = { rules: [], crawlDelaySeconds: null };

function matchesAgent(declared: string, ours: string): boolean {
  const value = declared.trim().toLowerCase();
  return value === "*" || ours.toLowerCase().startsWith(value);
}

export function parseRobots(body: string, userAgent: string): Robots {
  // Two passes, because a file may name us after it names `*`, and the
  // specific group wins wherever it appears.
  const groups: { agents: string[]; rules: RobotsRule[]; delay: number | null }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastLineWasAgent = false;

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#")[0]?.trim() ?? "";
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastLineWasAgent) {
        current = { agents: [], rules: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value);
      lastLineWasAgent = true;
      continue;
    }
    lastLineWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      // An empty Disallow means "nothing is disallowed" and is not a rule.
      if (field === "disallow" && value === "") continue;
      current.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "crawl-delay") {
      const delay = Number.parseFloat(value);
      if (Number.isFinite(delay) && delay >= 0) current.delay = delay;
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && matchesAgent(a, userAgent)));
  const wildcard = groups.filter((g) => g.agents.some((a) => a.trim() === "*"));
  const chosen = specific.length > 0 ? specific : wildcard;

  return {
    rules: chosen.flatMap((g) => g.rules),
    crawlDelaySeconds: chosen.map((g) => g.delay).find((d) => d !== null) ?? null,
  };
}

/** A robots pattern to a regex: `*` is any run, `$` anchors the end. */
function toRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`);
}

/**
 * Longest matching pattern wins; Allow wins a tie. That is the rule every
 * major crawler settled on, and picking a different one here would mean
 * reading a site more freely than its owner's other visitors do.
 */
export function isAllowed(robots: Robots, pathAndQuery: string): boolean {
  let best: { length: number; allow: boolean } | null = null;
  for (const rule of robots.rules) {
    if (!rule.pattern) continue;
    if (!toRegExp(rule.pattern).test(pathAndQuery)) continue;
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) {
      best = { length, allow: rule.allow };
    }
  }
  return best ? best.allow : true;
}
