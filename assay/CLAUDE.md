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
- Badge language is descriptive, never a warranty. The brief's own phrasing is
  "claims reviewed against [markets] on [date]"; on the mark that sentence now
  sits under the headline rather than being it, because the owner kept §4's
  "Claims Verified" as the name. See "Rules about the card" below — that is the
  one place §9 has been read down, it was read down deliberately, and nothing
  else on the mark may say "approved", "certified" or "compliant".
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
   describes, from a `ScanResult`. Simultaneously the kill-test instrument and
   the product's front door, which is why it came before the pipeline that
   fills it. *Done — `src/card/`, `pnpm card`.*
3. **The kill test.** Thirty real PDPs, hand-read, presented as score cards.
   §10's gate: 8+/30 wanting the live product, or 3+ offering to pay.
   *Tooling done — `pnpm killtest`, `pnpm calibrate`, KILLTEST.md. The
   outreach itself is the founder's, and is the actual test.*
4. **Everything after step 3 is gated on step 3.** URL fetch, LLM extraction,
   rule-constrained rewrites filling the card's `rewrites`, accounts, the
   hosted score page, the Shopify app, the badge embed, billing, monitoring,
   the ad checker, retailer packs.
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
- **Run `pnpm calibrate` after touching any rule, and treat a louder reading as
  a failure.** Precision is the product; recall can be bought later with more
  rules. A corpus only ever drifts louder, because every rule is added for
  something that was missed and none is ever added for something over-flagged.
- A false positive costs more than a false negative here, and the arithmetic is
  simple: a missed claim is a claim the founder already had, and a wrong mark
  is the moment they decide the scanner cannot tell a problem from a sentence.

## Rules about the card

- **No traffic lights.** Not red for severity, not green for a pass. That is
  the visual grammar of an audit tool and this product is not one. Severity is
  a ruled mark and a weight.
- **The accent is spent on the words the scan is talking about**, and on the
  one pointer naming the market the headline score came from. Nothing else
  gets it. A clean page is not green; it is quiet.
- **The card reproduces the brand's copy exactly** — every character, once, in
  order, with the flagged phrases marked. `tests/annotate.test.ts` asserts the
  round trip. Copy that silently loses a sentence between two underlines is
  worse than no card.
- **Everything that reaches a template is escaped.** The copy arrives from a
  page we do not control and the output is a file sent to strangers and later
  served from our own domain. There is no "insert this as HTML" path in
  `src/card/` and there must never be one.
- **Renderers are pure and take the date.** No `new Date()` inside one: a card
  has to render identically in a test, in CI, and in a year.
- **The badge says "Claims Verified", per §4 — decided by the owner.** It was
  built as "Claims reviewed" on the reading that §9's descriptive-not-a-
  warranty rule beats §4's name; the owner was shown that argument and kept
  §4. Do not re-litigate it in code. What holds §9 up instead: the line under
  the headline says *reviewed against [markets], [month]*, the rest of
  `BADGE_FORBIDDEN` stands, the score page opens with the disclaimer,
  `mayDisplayBadge` still refuses anything but a clear reading, and a lapsed
  mark still says lapsed. `tests/badge.test.ts` pins both halves.
- **Nothing else comes off `BADGE_FORBIDDEN`.** The list is asserted whole, so
  removing another word fails CI until somebody takes it as the legal decision
  it is. "Verified" invites a reader to think an outside body checked and none
  did — that exposure goes to counsel with the §9 T&Cs review, not into a
  commit.
- **A card never says more than the scan found.** "Clear" and "nothing was
  found" are different states and the copy must not conflate them; `bandNote`
  exists because it once did.

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

## Definition of done for step 2

`pnpm card --file page.txt` writes a result page, a share card and a badge that
a beauty founder would screenshot rather than close — from a `ScanResult`,
offline, deterministically, with the brand's own copy reproduced exactly and
every note citing a named instrument. **Met.** What remains is the rewrite
text, which is step 4's model, and a design sprint on the badge (§11, item 4).

## Definition of done for step 1

`pnpm scan --file page.txt` reads a real product page and returns findings that
a regulatory specialist agrees with, each citing a named instrument, with a
score whose every deducted point is traceable to a rule — offline, in under a
second, with no configuration. **Met.** What remains open is the corpus's
accuracy, which is a review by counsel and not a build task; see README.md.
