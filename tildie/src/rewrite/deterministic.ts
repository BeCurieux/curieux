/**
 * The rewrites that need no model.
 *
 * Two of twenty-one rules have an exact fix — a permitted-indication verb and
 * an availability qualifier — and an exact fix should never wait on a network
 * call, cost a token, or be subject to a model's mood. It also means the kill
 * test gets real rewrites on a laptop with no key, which is the same property
 * every other part of this engine has.
 *
 * The rest return null rather than guessing. "No nasties" becomes the brand's
 * own exclusion list and nothing here knows what is in it; a whole-product
 * claim needs the component named and nothing here knows which. A mechanical
 * rewrite that guesses is worse than no rewrite, because the remedy beside it
 * is already correct and a wrong draft displaces it.
 */

import type { Finding, Rule } from "../engine/types.js";
import { ruleById } from "../engine/registry.js";

/** Match the replacement to the case of what it replaces: Boosts → Supports. */
function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source !== source.toLowerCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) {
    return replacement[0]?.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * An exact rewrite for this claim, or null when the rule has no mechanical fix.
 *
 * `claim` is the sentence, not just the matched trigger: swapping a verb needs
 * the words around it to come back with the swap in place.
 */
export function mechanicalRewrite(finding: Finding, claim: string, rule?: Rule): string | null {
  const found = rule ?? ruleById(finding.ruleId);
  const mechanical = found?.mechanical;
  if (!mechanical) return null;

  if (mechanical.kind === "swap") {
    const pattern = new RegExp(`\\b(${mechanical.from.map(escape).join("|")})\\b`, "gi");
    if (!pattern.test(claim)) return null;
    pattern.lastIndex = 0;
    return claim.replace(pattern, (word) => matchCase(word, mechanical.to));
  }

  // Qualify: put the suffix after the trigger, inside the sentence, rather
  // than at the end — "The bottle is recyclable where facilities exist; the
  // carton is card" reads correctly and "…; the carton is card where
  // facilities exist" does not.
  const trigger = finding.trigger.text;
  const at = claim.indexOf(trigger);
  if (at === -1) return null;
  const after = at + trigger.length;
  if (claim.slice(after).toLowerCase().startsWith(mechanical.suffix.toLowerCase())) return null;
  return `${claim.slice(0, after)}${mechanical.suffix}${claim.slice(after)}`;
}

function escape(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
