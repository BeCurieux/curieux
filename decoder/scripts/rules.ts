/**
 * Onboarding, on the command line.
 *
 *   pnpm rules "I'm vegan. I avoid artificial sweeteners and carrageenan. I don't care about seed oils. Flag anything with caffeine."
 *
 * BRIEF.md §6's example sentence, and the confirmation screen it produces. Runs
 * offline by default — see `draftRulesLocally` for why that path exists rather
 * than being a shortcut — and with `--model` it uses the same closed vocabulary
 * through the Anthropic adapter.
 */

import { draftRules, draftRulesLocally } from "@/lib/rules/author";
import { AnthropicRuleAuthor } from "@/lib/rules/anthropic";

const argv = process.argv.slice(2);
const useModel = argv.includes("--model");
const description = argv.filter((a) => !a.startsWith("--")).join(" ");

if (!description) {
  console.error('usage: pnpm rules "<what you want us to watch for>" [--model]');
  process.exit(1);
}

if (useModel && !process.env["ANTHROPIC_API_KEY"]) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

const draft = useModel
  ? await draftRules(description, new AnthropicRuleAuthor())
  : draftRulesLocally(description);

const byKind = {
  avoid: draft.ruleSet.rules.filter((r) => r.kind === "avoid"),
  flag: draft.ruleSet.rules.filter((r) => r.kind === "flag"),
  "never-flag": draft.ruleSet.rules.filter((r) => r.kind === "never-flag"),
};

console.log("\n  YOUR RULES\n");
if (byKind.avoid.length > 0) {
  console.log("  Avoid:");
  for (const rule of byKind.avoid) console.log(`    ✓ ${rule.label}`);
  console.log();
}
if (byKind.flag.length > 0) {
  console.log("  Flag:");
  for (const rule of byKind.flag) console.log(`    ✓ ${rule.label}`);
  console.log();
}
if (byKind["never-flag"].length > 0) {
  console.log("  Don't flag:");
  for (const rule of byKind["never-flag"]) console.log(`    ✓ ${rule.label}`);
  console.log();
}

if (draft.ruleSet.rules.length === 0) console.log("  (nothing yet — try naming what you avoid)\n");

// §6 ends with "The user then confirms them", and this is the half of that
// screen that matters: what we could not turn into a rule, in their own words,
// rather than quietly dropped.
if (draft.unmapped.length > 0) {
  console.log("  WE COULDN'T TURN THESE INTO RULES YET\n");
  for (const item of draft.unmapped) console.log(`    · ${item}`);
  console.log();
}

console.log(`  Looks right? →   (${draft.provenance.source}, ${draft.provenance.promptVersion})\n`);
