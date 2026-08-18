# CLAUDE.md — assay (working name TBD)

Read BRIEF.md before doing anything. This file is the short version that must
never be violated.

## North star

**The badge is the product. The scan is the funnel.**

Every decision serves a brand voluntarily putting a mark on their own product
page. If a feature makes the scan more thorough but the result less shareable,
it is the wrong trade. If a feature makes the badge easier to display but
easier to display dishonestly, it is a much worse one.

## The three laws

**1. No verdict exists that a rule did not produce.**

A model may segment the document and may draft a rewrite afterwards. Between
those two points nothing decides anything except a rule in a versioned pack.
Every finding carries the id and citation of the rule that produced it, and
every point the score deducts carries the same. There is no path from model
output to a finding, and there must never be one — the whole product is that a
brand can argue with a named instrument instead of with a number.

**2. This product characterises risk. It does not rule on a page.**

Finding headlines are composed from `Modality`, a closed set of four guidance
framings in `src/engine/framing.ts`. Rule authors write `concern` and `remedy`;
they never write the headline. `BANNED_ABSOLUTES` keeps verdict language out of
every field that speaks about the brand's copy, and `tests/framing.test.ts`
enforces it across the whole corpus. Adding a fifth modality is a decision
about what this product asserts — it goes through a review, not through a rule.

**3. A market with no rules is not a clean sheet.**

`packFor` throws for a jurisdiction with no pack, and no toggle exists in any
UI for a market that has none. The failure this prevents is the one that ends
the company: a brand selects a market we never wrote, scores 100 on silence,
and puts a badge on it.

## The guardrails, from BRIEF.md §9 — non-negotiable

- The disclaimer rides on `ScanResult`, not on each surface remembering it.
- **We never scan, score or publish a named third-party brand as marketing.**
  Users scan their own properties, at their own initiation. The viral mechanic
  is self-scan and voluntary share. The Yuka precedents are in the brief and
  they are the reason; a solo founder does not play that game.
- Badge language is descriptive, never a warranty: "claims reviewed against
  [markets] on [date]". Not "approved", not "certified", not "compliant".
- No rule cites an instrument it has not read. A plausible-looking wrong
  citation is worse than no citation, because it is the part a brand's lawyer
  checks first.

## Stack (fixed)

TypeScript everywhere. The engine has no dependencies beyond `zod` and needs no
configuration — it runs on a laptop with no accounts, which is what makes the
kill test possible before anything is built. The app around it, when it exists:
Next.js (App Router) · Supabase · Shopify Billing · Anthropic API · Vercel.
No other services without asking.

## Build order (derived from §7 and §10 — not given in the brief)

1. **The engine.** Text in, cited findings and an explainable score out. No
   network, no key, no model. *Done — `src/`, `pnpm scan`.*
2. **The score card.** The result rendered as the beautiful object the brief
   describes, from a `ScanResult`. This is simultaneously the kill-test
   instrument and the product's front door, which is why it comes before the
   pipeline that fills it.
3. **The kill test.** Thirty real PDPs, hand-read, presented as score cards.
   §10's gate: 8+/30 wanting the live product, or 3+ offering to pay.
4. **Everything after step 3 is gated on step 3.** URL fetch, LLM extraction,
   rule-constrained rewrites, the result page, accounts, the Shopify app, the
   badge embed, billing, monitoring, the ad checker, retailer packs.
5. **Stop.** OCR packaging, UK and Quebec packs, and anything in §4's
   "explicitly out of V1" list are later decisions, not sprint overflow.

Steps 1–3 need no accounts, no API keys and no Shopify approval. That is the
point of the ordering: the expensive half is not begun until a real founder
has said yes to the cheap half.

## Rules about rules

- A rule with no fixture in `tests/fixtures/triggers.ts` fails CI. A rule that
  has never matched anything is the failure mode this corpus dies of.
- Every fixture is a pair: copy that trips the rule, and the same claim
  rewritten so it does not. The quiet half is the more valuable one — it is the
  rewrite engine's specification, written before the rewrite engine.
- Rule ids are permanent. A rule whose meaning changes gets a new id, because
  a badge earned last month records the pack version it was earned under.
- Pack versions bump whenever a rule is added, removed, or changed in a way
  that changes a score.
- Match against the wording, never against the extractor's category guess.
  `evaluate` runs the corpus over the whole document; claims group and
  attribute findings, they do not gate them.

## Product rules

- Score presentation is undecided (§11, item 2). The engine returns a 0–100
  value **and** a three-state band so the decision stays open; do not build a
  surface that can only render one of them.
- The headline score is the weakest selected market, never a sum. A brand
  selling into three countries must not score worse than the same copy sold
  into one.
- A page carrying a high-severity finding is not badge-eligible at any number.
- Never invent a study, a figure, a sample size or a certification when
  drafting a rewrite. A rewrite that fabricates evidence is the single worst
  thing this product could ship.
- Copy tone: confident, warm, editorial. Never legal-scary. The brand should
  feel like something a Glossier-tier founder would screenshot.

## Definition of done for step 1

`pnpm scan --file page.txt` reads a real product page and returns findings that
a regulatory specialist agrees with, each citing a named instrument, with a
score whose every deducted point is traceable to a rule — offline, in under a
second, with no configuration. **Met.** What remains open is the corpus's
accuracy, which is a review by counsel and not a build task; see README.md.
