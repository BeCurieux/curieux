# CLAUDE.md — Franca

Read BRIEF.md before doing anything. This file is the short version that must
never be violated.

The product is **Franca** (chosen 2026-08-18, §11 item 1), and so is the
directory. It was `assay/` while the name was open; the rename landed on its
own after #31, so the review of the product and the review of a rename never
had to happen in the same diff.

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

TypeScript everywhere. `zod` and `@anthropic-ai/sdk`, and the second is reached
by exactly one file. **Scanning still needs no key and no configuration** — the
drafter is injected, and without one the engine, the card and the kill test all
run on a laptop with no accounts, which is what makes step 3 possible before
step 4 exists. The app around it, when it exists: Next.js (App Router) ·
Supabase · Shopify Billing · Anthropic API · Vercel. No other services without
asking.

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
4. **Everything after step 3 is gated on step 3.** LLM extraction, accounts,
   the hosted score page, the Shopify app, the badge embed, billing,
   monitoring, the ad checker, retailer packs. Two rungs have been opened
   early on the owner's call — see below.
5. **Stop.** OCR packaging, UK and Quebec packs, and anything in §4's
   "explicitly out of V1" list are later decisions, not sprint overflow.

Steps 1–3 need no accounts, no API keys and no Shopify approval. That is the
point of the ordering: the expensive half is not begun until a real founder
has said yes to the cheap half.

### The thing opened early

Recorded here because the alternative is a rule that quietly stopped being
true. The gate was overridden, not routed around, and step 4's line above was
left standing rather than edited to pretend this was always allowed.

**URL fetching, on the owner's call (2026-08-18).** Step 4 says URL fetch waits
for the kill-test result. It did not. The argument for opening it is that it is
the cheap end of step 4 and it *serves* step 3 rather than jumping past it —
no accounts, no keys, no model, no OAuth, and it removes the only real friction
in running the test, which was pasting thirty pages by hand. The argument
against is the one the gate exists for, and it still applies to everything else
on the step-4 list.

What opened: `src/fetch/` — robots.txt, an extraction ladder, and text
extraction, all pure above one file, all offline-testable. `--url` on `pnpm
scan` and `pnpm card`, and `--fetch` on `pnpm killtest`.

What did **not** open with it: the LLM extractor, accounts, the hosted score
page, the Shopify app, the badge embed, billing, monitoring, the ad checker and
retailer packs. A model is still not in the scan path and law 1 is untouched.

**Rewrite generation, on the owner's call (2026-08-18).** Also step 4, also
opened before the gate. It is the first thing in this project that sends a
model anything, and the whole design is about that being safe: the drafter
proposes, `src/rewrite/validate.ts` re-scans with the same engine, and a draft
the rules still flag is discarded however well it reads. Law 1 is not bent —
no finding, score or verdict has a model anywhere near it, and a rewrite is
advice attached to a finding rather than part of one.

What opened: `src/rewrite/` and `--rewrite` on `pnpm card` and `pnpm killtest`.
Rewrites are opt-in, the scan never depends on them, and with no key the exact
fixes still run and the rest of the notes keep their remedy. Still shut: every
other item on the step-4 list.

**The boundary that came with it, and it is not negotiable: reading somebody's
page is conduct, not a feature.** robots.txt is obeyed and a 5xx on it fails
closed, because we read a stranger's page and then write to that stranger about
it. Requests are serialised with a pause and honour `Crawl-delay`. The agent
string identifies the tool and carries `SCAN_CONTACT` when set. `--own` skips
the robots check and is only ever legitimate for a site the user owns. None of
this is politeness theatre: the kill test's first message is about our conduct
the moment any of it is skipped.

## Rules about rules

- Every rule carries an `example` pair: copy that trips it, and copy that does
  not. `tests/corpus.test.ts` asserts both halves behave, so a rule that has
  never matched anything — the failure mode this corpus dies of — fails CI.
- The pair lives on the rule rather than in a fixture file because it is the
  rule's boundary drawn from both sides, and the rewriter is shown it next to
  `rewriteGuidance`. The quiet half is sometimes the same claim written well
  and sometimes adjacent copy that correctly passes; it is an illustration of
  where the rule stops, not a template to imitate.
- A rule whose fix is exact carries `mechanical`. Two do. Do not generalise
  that field to make a third case expressible — the temptation is to make it
  expressive enough to express a bad rewrite, and a wrong draft displaces a
  correct remedy.
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

## Rules about fetching

- **The whole page is never the default scan input.** A PDP carries a
  related-products carousel and a review widget, both full of claims about
  other products, and a card marking a phrase the founder cannot find on their
  page is the fastest way to lose them. Structured sources first; `--whole` is
  an opt-in.
- **But say what was left out.** A structured source misses the hero line and
  the "our promise" block, which is where environmental claims live. The
  coverage check scans the rest of the page and names the phrases, because
  measuring the gap in characters was tried and was useless — the sentence that
  mattered was 118 characters long.
- **Fetching is pure above one file.** `src/fetch/fetch.ts` is the only thing
  that touches the network; everything else takes an injected transport, and
  the suite needs no network. A test suite depending on thirty storefronts
  being up is a suite that goes red for reasons unrelated to the commit.
- **A thin result is reported, never scanned.** A page that builds itself in
  the browser returns a nav bar, and scoring a nav bar produces a number that
  is worse than no number.

## Rules about rewrites

- **The model drafts; the rules dispose.** Every draft is re-scanned by the
  same engine that raised the finding, and accepted only if the rule is gone
  and nothing new has appeared. That is law 1, and it is why the drafter
  returns candidates rather than an answer.
- **Never invent evidence.** No study, figure, sample size, duration, scheme
  or ranking that was not already on the page. `src/rewrite/fabrication.ts` is
  that rule checked, and it is deliberately over-broad: a rejected draft costs
  a retry, a fabricated one costs the brand a claim it cannot defend — on our
  advice, on a card carrying our mark.
- **A blank is a good answer.** Where the honest fix needs a fact only the
  brand has, the draft says `[name your scheme]` rather than guessing one.
  Without that valve, "never invent" collapses into "always delete the claim",
  and the model reaches for the invention.
- **Draft per mark, not per finding.** One phrase trips three markets and the
  brand needs one sentence that answers all of them. A draft that clears the
  ECGT and still trips the Green Guides has moved the problem, not fixed it.
- **No rewrite is better than a wrong one.** Every note already carries its
  rule's remedy, which is correct. A bad draft displaces it. When nothing
  clears the gate, say so and keep the remedy.
- Rewrites are opt-in (`--rewrite`) and the scan never depends on them.

## Rules about the card

- **No traffic lights.** Not red for severity, not green for a pass. That is
  the visual grammar of an audit tool and this product is not one. Severity is
  a ruled mark and a weight. This rule survived the card getting more colour
  and it is the reason that change was safe — see below.
- **Colour is identity, never verdict.** `MARKET_ACCENT` gives each market a
  hue, added 2026-08-18 on the owner's call for a more colourful card. It is
  allowed because a market keeps its colour whatever the finding under it says,
  and a clean page shows the same three hues as a page with seventeen findings.
  The triad is aqua, blue and purple over a violet-tinted ground: one arc of
  the wheel with no red, no amber and no green in it, so nobody has to work out
  whether a chip means "pass".
- **The accent owns pink, and every market stays cool.** The accent went pink
  on the owner's call and the market arc rotated off pink in the same commit —
  that rotation is the condition of the change, not decoration. The colour the
  reader follows must never be mistakable for a label, so if a future market
  wants a warm hue, the accent moves first or the market does not get it. `tests/card.test.ts` asserts the hues appear for every selected market
  in both a clean and a bad scan, which is the check that would fail the moment
  a colour started tracking severity or band. Do not add a fourth colour system
  and do not let a hue depend on a `Severity` or a `ScoreBand`.
- **The page and the share card are dark; the badge has its own two grounds.**
  Chosen by the owner 2026-08-18 over the warm-paper original. `PALETTE` is the
  near-black system. The badge takes `theme: "paper" | "night"` and neither is
  `PALETTE` — a mark sits *on top of* a merchant's page rather than matching
  it, so `BADGE_NIGHT_PALETTE` is lighter than the page's ground. `paper` is
  the default because most PDPs are pale and a wrong default is worse than an
  opt-out. Do not collapse the palettes, and do not reintroduce a
  `prefers-color-scheme` branch on the page: an artefact that looks different
  in everybody's screenshot is not an artefact. Print is the one exception.
- **A badge theme is a palette and nothing else.** Both grounds sit in the
  `states` list in `tests/badge.test.ts`, so both take every §9 assertion, and
  a separate test strips the colour from each and requires what is left to be
  identical. A theme that can change a word is a second badge with no test
  around its language.
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
- **The badge has no threshold of its own.** `badgeEligible` is `band ===
  "clear"`, and `BAND_THRESHOLDS.clear` is 80 (lowered from 85 by the owner on
  2026-08-18, because copy a specialist would sign off scored 82 and could not
  display the mark). Do not give the badge a separate bar: a card reading
  *worth a look* beside a PDP mark reading *Claims Verified* is the mark
  asserting what the card qualifies, and `mayDisplayBadge` refusing anything
  but a clear reading is one of the four things holding §9 up. Moving the
  number is a product decision; decoupling the two is a legal one.
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
