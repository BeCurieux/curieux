/**
 * robots.txt, honoured.
 *
 * This is not legalism. The kill-test in the brief has us generating shops
 * from thirty storefronts whose owners have not asked us to and do not yet
 * know we exist — and then DMing them about it. The first contact is meant to
 * be honest ("it isn't synced yet, and we don't claim it is"). Ignoring a
 * store's crawl rules on the way to that message would make the message a
 * lie about our conduct rather than our product.
 *
 * There is an escape hatch (`respectRobots: false`) for the case that arrives
 * with OAuth: a merchant who has connected their own store has asked us to
 * read it, and robots.txt is addressed to strangers.
 *
 * A deliberately small implementation of the de-facto standard: group
 * selection by the most specific matching User-agent, `*` and `$` wildcards,
 * longest-match-wins with Allow beating Disallow on a tie.
 */

export interface RobotsRules {
  isAllowed(pathAndQuery: string): boolean;
  crawlDelayMs: number | null;
  /** True when we never got a robots.txt and are proceeding on that basis. */
  assumed: boolean;
}

interface Rule {
  allow: boolean;
  pattern: string;
}

/** Nothing to obey — used when robots.txt is missing, empty or a 5xx. */
export const ALLOW_ALL: RobotsRules = {
  isAllowed: () => true,
  crawlDelayMs: null,
  assumed: true,
};

export function parseRobots(text: string, userAgentToken: string): RobotsRules {
  const token = userAgentToken.toLowerCase();

  // agent -> rules. Directives before any User-agent line belong to nobody,
  // which is what real crawlers do with them.
  const groups = new Map<string, { rules: Rule[]; crawlDelay: number | null }>();
  let current: string[] = [];
  let expectingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      // Consecutive User-agent lines share one block of rules.
      if (!expectingAgents) current = [];
      expectingAgents = true;
      const agent = value.toLowerCase();
      current.push(agent);
      if (!groups.has(agent)) groups.set(agent, { rules: [], crawlDelay: null });
      continue;
    }

    expectingAgents = false;
    if (current.length === 0) continue;

    for (const agent of current) {
      const group = groups.get(agent);
      if (!group) continue;
      if (field === "allow" || field === "disallow") {
        // "Disallow:" with an empty value means allow everything — it is the
        // conventional way to write a permissive group, not a rule matching "".
        if (field === "disallow" && value === "") continue;
        group.rules.push({ allow: field === "allow", pattern: value });
      } else if (field === "crawl-delay") {
        const seconds = Number.parseFloat(value);
        if (Number.isFinite(seconds) && seconds >= 0) group.crawlDelay = seconds;
      }
    }
  }

  const group = selectGroup(groups, token);
  if (!group) return { isAllowed: () => true, crawlDelayMs: null, assumed: false };

  const rules = group.rules;
  return {
    isAllowed(pathAndQuery: string) {
      let best: { length: number; allow: boolean } | null = null;
      for (const rule of rules) {
        if (!matches(rule.pattern, pathAndQuery)) continue;
        const length = rule.pattern.length;
        if (!best || length > best.length || (length === best.length && rule.allow)) {
          best = { length, allow: rule.allow };
        }
      }
      return best ? best.allow : true;
    },
    crawlDelayMs: group.crawlDelay === null ? null : Math.round(group.crawlDelay * 1000),
    assumed: false,
  };
}

function selectGroup(
  groups: Map<string, { rules: Rule[]; crawlDelay: number | null }>,
  token: string,
): { rules: Rule[]; crawlDelay: number | null } | undefined {
  let bestKey: string | undefined;
  for (const key of groups.keys()) {
    if (key === "*") continue;
    // Substring rather than equality: robots.txt names products ("googlebot"),
    // and our full UA string is "PopuupBot/0.1 (+https://...)".
    if (token.includes(key) && (!bestKey || key.length > bestKey.length)) bestKey = key;
  }
  return groups.get(bestKey ?? "*");
}

function matches(pattern: string, path: string): boolean {
  if (pattern === "") return false;
  const anchoredEnd = pattern.endsWith("$");
  const body = anchoredEnd ? pattern.slice(0, -1) : pattern;
  const segments = body.split("*");

  let index = 0;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i] ?? "";
    if (segment === "") continue;
    if (i === 0) {
      if (!path.startsWith(segment)) return false;
      index = segment.length;
      continue;
    }
    const found = path.indexOf(segment, index);
    if (found === -1) return false;
    index = found + segment.length;
  }

  if (anchoredEnd) {
    const tail = segments[segments.length - 1] ?? "";
    // A trailing "*" before "$" means "anything then end", which is any path
    // that got this far; otherwise the last literal must sit at the end.
    return tail === "" ? true : path.endsWith(tail);
  }
  return true;
}
