# Franca — the claim engine, and the artefact it produces

Marketing copy in; findings that cite a named instrument, a score whose every
deducted point traces to a rule, and a card beautiful enough that sending it to
a stranger is not embarrassing.

Steps 1 and 2 of the build order in `CLAUDE.md`, plus two rungs of step 4
opened early on the owner's call — URL fetching and rewrite drafting. There is
no database. Scanning still needs no configuration, no API key and
no network access, which is the property that matters most right now: the kill
test in §10 of the brief runs before any of that exists, and it runs on this.

```
pnpm install
pnpm scan --text "Clinically proven to clear acne in 7 days. Eco-friendly, too."
pnpm card --file page.txt --out ./cards/aurelia
```

```
────────────────────────────────────────────────────────────────────────
Claim Confidence  55/100   REWORK
Markets           AU 82   US 55   EU 82   (headline is US, the weakest)
Badge             not eligible
Read              2 claims, 5 findings
────────────────────────────────────────────────────────────────────────

[US] 'Proven' used as the evidence rather than pointing at it  (high)
  "Clinically proven"
  Evidence is expected to be in hand before this wording is used, under
  FTC Health Products Compliance Guidance (2022), competent and reliable
  scientific evidence.
  Concern: 'Clinically proven' is read as a specific assertion about a
  specific study, and the ad platforms treat it as one of a small set of
  trigger phrases…
  Fix:     Name what was actually run and on whom — the panel size, the
  duration, the measure — or step the word back from 'proven' to what the
  testing showed.
  Rule:    us-ftc-proven-efficacy · FTC Health Products Compliance Guidance
  (2022), competent and reliable scientific evidence
```

## Commands

| | |
|---|---|
| `pnpm scan --text "…"` | Scan pasted copy against every market |
| `pnpm scan --file page.txt --markets AU,EU` | Scan a file against selected markets |
| `pnpm scan --url https://…` | Fetch a page and scan it |
| `pnpm scan --url https://… --whole` | Scan the whole page, carousels and all |
| `pnpm scan --file page.txt --json` | The whole `ScanResult`, as JSON |
| `pnpm card --file page.txt --out ./cards/x` | The result page, the share card and the badge |
| `pnpm card … --wordmark SORREL` | Override the masthead with another name |
| `pnpm card … --rewrite` | Draft the replacements too — exact fixes offline, rest via the model |
| `pnpm card … --png` | Rasterise the share card, if a Chromium is around |
| `pnpm calibrate` | Is the corpus loud in the right places? Eight invented pages |
| `pnpm killtest` | Run the §10 targets, render the cards, keep the ledger |
| `pnpm killtest --fetch` | …collecting the copy for any target that has none |
| `pnpm rules` | What the corpus covers, and what it does not |
| `pnpm test` · `pnpm typecheck` | 292 tests, no network, no key |

## How a scan works

```
text
  │
  ├─ extractClaims ......... segmentation, for grouping and highlighting
  │                          (a model goes here later; see below)
  ├─ match ................. every rule in every selected pack, over the
  │                          whole document
  ├─ headline .............. one of four guidance framings, composed
  ├─ scoreFindings ......... 100 minus arithmetic you can read
  └─ ScanResult ............ findings, per-market scores, pack versions,
                             and the disclaimer
```

Two things about that diagram are load-bearing.

**The rules read the page, not the extractor's summary of it.** Claims group
and attribute findings; they never gate them. A sentence the extractor misses
is still scanned, so when a model replaces `extractClaims` it can only cost a
finding its neat inline highlight — never its existence. That is what keeps
"the LLM never decides a verdict" true in practice rather than in intention.

**The headline is composed, not authored.** A rule author supplies a concern
and a remedy. The sentence at the top of the finding comes from the rule's
`modality`, and `Modality` has four members, none of which can say a page is
unlawful. See `src/engine/framing.ts`, and `tests/framing.test.ts`, which
enforces it across the corpus.

## The corpus

21 rules, three packs, authored fresh. `pnpm rules` prints the current state.

| Market | Rules | Weighted towards |
|---|---|---|
| **EU** — Directive (EU) 2024/825 (ECGT), from 27 September 2026 | 7 | Environmental claims: generic green language, offsetting-based neutrality, self-made sustainability seals, whole-product claims built from one component, dated pledges, vague degradability |
| **US** — FTC substantiation, Green Guides, FDA drug-claim boundary | 7 | The disease-claim line, "clinically proven", establishment claims, testimonial results, general environmental benefit, free-of and non-toxic, unqualified recyclable |
| **AU** — TGA Advertising Code, ACCC greenwashing enforcement | 7 | Serious conditions, cosmetic copy crossing into therapeutic, indications outside the permitted list, generic green claims, unbacked neutrality, superlatives, "no nasties" |

Authoring order followed §7 of the brief: the wedge first. `sensory` is the one
category in the taxonomy with no rules, and that is the right number — a
sensory claim is the kind this product should help brands write *more* of.

**UK/ASA and Quebec are not written, and a scan against them throws.** That is
the third law in `CLAUDE.md`. There is no toggle for a market with no rules.

### What a rule looks like

Every rule is data: a declarative matcher, a citation, a severity, a modality,
and four pieces of prose. Nothing about it is a function, which is what lets it
be versioned, diffed, tested, and one day authored by somebody who does not
write TypeScript.

```ts
{
  id: "eu-ecgt-offset-neutrality",
  title: "Neutrality claim resting on offsetting",
  jurisdiction: "EU",
  categories: ["environmental"],
  severity: "high",
  modality: "likely_to_be_flagged",
  citation: { instrument: "Directive (EU) 2024/825 (ECGT)", locator: "…", url: "…" },
  instrumentSays: "…",     // about the law. May use the law's own verbs.
  concern: "…",            // about the brand's copy. May not.
  remedy: "…",
  rewriteGuidance: "…",    // the constraint the rewrite model will be given
  match: { kind: "phrase", any: ["carbon neutral", "climate neutral", …] },
}
```

### Every rule has a fixture, and CI fails without one

`tests/fixtures/triggers.ts` pairs each rule with copy that trips it and the
same claim rewritten so it does not. A rule that has never matched anything is
how a corpus like this rots — it reads beautifully, cites a real instrument,
and does nothing.

The quiet halves are the more useful ones. They are, collectively, the rewrite
engine's specification, written before the rewrite engine and proven to clear
the rules they are about:

| Trips | Quiet |
|---|---|
| Boosts immunity through winter. | Maintains immune system health through winter. |
| The formula is biodegradable. | Biodegradable in industrial composting within 90 days, to EN 13432. |
| Fully recyclable, inside and out. | The outer carton is recyclable. |
| Clears acne without the sting. | Leaves congested skin looking calmer and less shiny. |
| Australia's number one retinol. | Our own bestselling retinol, three years running. |

## The card

`pnpm card` writes four files from one scan: the result page, the share card at
OG size, and the badge in both of its states. No key, no account, no network —
which is the point, because this is the kill test's entire toolchain.

The form is the argument. Rather than a list of problems beside a page, the
card reproduces **the brand's own copy with the flagged phrases underlined and
numbered**, and puts the notes below as an apparatus, each citing its
instrument. A critical edition of a product page. It is the right shape for a
product about language, it reads as editorial rather than as an audit, and it
is the reason a founder screenshots it instead of closing it.

Four decisions inside it are worth arguing with.

**A dark ground, and a badge that ignores it.** The result page and the share
card sit on near-black with a warm coral accent — chosen 2026-08-18 over the
warm-paper original, which read as a dialog box at thumbnail size once the
texture carrying it disappeared. The page no longer follows the reader's colour
scheme either: it is the artefact, and an artefact that looks different in
everybody's screenshot is not one.

The **badge** does not follow. It renders inside a merchant's own product page
— somebody else's design — so it ships in two grounds and the merchant picks:
`paper` by default, `night` for a dark PDP. Neither is the page palette;
`BADGE_NIGHT_PALETTE` is deliberately *lighter* than `PALETTE`, because a mark
sits on top of a dark page rather than matching it, and the page's near-black
would read as a hole.

A theme is a palette and nothing else. `tests/badge.test.ts` strips every fill
and stroke from both marks and requires the remainder to be identical — same
words, same layout, same `aria-label` — and both grounds appear in the state
list that asserts `BADGE_FORBIDDEN`, so a variant cannot quietly acquire
language nothing checks. Print is light too; a printer asked for a black page
produces one.

**No traffic lights, and colour that means identity instead.** Not red for
severity, not green for a pass — red-amber-green is the visual grammar of an
audit tool and the brief's whole position is that this is not one. Severity is
a ruled mark and a weight; the accent is spent on the words the scan is talking
about and on the pointer saying which market the headline came from.

Colour does multiply in one place: `MARKET_ACCENT` gives AU, EU and US a hue
each — aqua, blue, purple — carried on the by-market ledger and on every market
chip, over a violet-tinted near-black ground. It is safe precisely because it
is orthogonal to the verdict: a market keeps its colour whatever the finding
beside it says, and a clean page shows the same three hues as a bad one. The
arc contains no red, amber or green, so a chip cannot be misread as a pass.

**The accent is pink, and it is the only hot colour on the page.** Pink was a
market first; when it became the accent the whole market arc rotated cooler,
and that was the condition of the change rather than a consequence of it. The
one colour a reader is meant to follow must never be mistakable for a label. A
clean page is still not green. It is still quiet.

**"Claims Verified", with the description underneath.** The mark was built as
"Claims reviewed" first: §4 of the brief names it "Claims Verified" and §9
requires the badge to be descriptive rather than a warranty, those pull against
each other, and §9 is the section marked non-negotiable. The owner was shown
that argument and kept §4's wording, so the headline is the brief's.

What carries §9 now that the headline does not: the line under it reads
*reviewed against AU · US · EU*, so the mark still states an act on a date
rather than a status; the rest of `BADGE_FORBIDDEN` stands, so nothing on it
says approved, certified, compliant, guaranteed or safe; the score page it
links to opens with the disclaimer; `mayDisplayBadge` refuses the mark to
anything but a clear reading in every market checked; and a lapsed mark says
lapsed. `tests/badge.test.ts` asserts the forbidden list *whole*, so another
word coming off fails CI until it is taken as the legal decision it is.

The residual exposure is worth naming rather than burying: "verified" invites a
reader to think an outside body checked, and none did. That belongs in the §9
T&Cs review with counsel, alongside the citations.

**The mark greys rather than vanishing.** A lapsed badge still names its date
and still links to its page. A mark that quietly goes on asserting a score
nobody stands behind any more is the dishonest version of the retention loop
the brief describes.

### The badge

```
┌────────────────────────────────────────────┐
│▌  96 /100  │  CLAIMS VERIFIED              │
│            │  REVIEWED AGAINST AU · US · EU│
│            │  AUGUST 2026                  │
└────────────────────────────────────────────┘
```

Live and lapsed differ by one accent stroke going grey and one line of text
appearing. `mayDisplayBadge` gates it: `clear` band only, which means a page
carrying a phrase that draws attention reliably cannot display a mark at any
score.

### The name

**Franca**, chosen 2026-08-18 and resolving §11 item 1. *Lingua franca* — the
common language — for a product about the language of claims.

It asserts nothing, which is the point. The badge already says "Claims
Verified"; a name that also claimed truth — *Vouch*, *Attest*, *Verily* — would
say it twice and widen the §9 exposure that was read down once already. The
marks this product is modelled on do the same thing: Vanta, Oeko-Tex and B Corp
all leave the claim to the badge line and keep it out of the name.

`WORDMARK` in `src/card/tokens.ts` is the single place it is written, and the
masthead takes it by default. `--wordmark` still overrides, because a name is
cheaper to change before thirty founders have seen it than after.


## The score

100, minus arithmetic that ships with the result. `ScoreBand` is `clear`,
`review` or `rework`; `Score.value` is 0–100. Both exist because §11 item 2 —
number, letter or three-state — is still open, and the engine should not settle
it by only computing one.

Three decisions worth knowing about:

**Repeats decay.** First trip of a rule costs its full weight, later ones cost
a third, and a single rule can cost at most twice its weight however often it
fires. A page that says "eco-friendly" in the hero, the bullets, the FAQ and
the shipping note has one problem in four places, and a scanner that charges
full freight four times returns a number the brand correctly stops believing.

**The headline score is the weakest selected market, not a total.** Pooling
findings across markets means a brand selling into three countries scores worse
than the same copy sold into one — which makes scores incomparable between
brands and penalises exactly the customers with the most to lose. `pnpm scan`
prints every market's score and names which one the headline came from.

**A high-severity finding blocks the badge at any number.** `badgeEligible`
requires the `clear` band, and the band rule keeps a page carrying a
high-severity finding out of `clear` regardless of arithmetic.

## Fetching a page

```
pnpm scan --url https://brand.example/products/serum
pnpm killtest --fetch
```

Opened ahead of its place in the build order, deliberately — see CLAUDE.md.

**The ladder.** Shopify's product endpoint first, then JSON-LD, then the page's
`<main>`, then the whole document. Structured sources win because a PDP carries
a related-products carousel and a review widget full of claims about *other*
products, and a card marking a phrase the founder cannot find on their page is
the fastest way to lose them. Every rung lands in the trace whether it worked
or not — "why did this come back empty" is the question thirty targets will
ask.

**And it says what it left out.** A product description has no hero line and no
"our promise" block, which is exactly where environmental claims live. So the
whole page comes back too, the corpus runs over both, and the difference is
named:

```
  shopify product json   product found (232 chars)
  page                   fetched (1058 chars)
  elsewhere on the page, outside the product description: "eco-friendly",
  "heals". Add those lines to the copy, or rescan with --whole.
```

The first version of that check compared character counts against a threshold.
It was useless in the only case that mattered: the page that prompted it held
one extra sentence, 118 characters long, and the sentence was "we are a carbon
neutral, eco-friendly brand". What matters is not how much was missed but
whether the missed part trips anything.

**Reading somebody's page is conduct, not a feature.** The kill test reads a
stranger's page and then writes to that stranger about it, so:

- robots.txt is obeyed, and a 5xx on it fails closed rather than open
- requests are serialised with a pause, and `Crawl-delay` is honoured
- the agent string names the tool, and carries `SCAN_CONTACT` when it is set
- `--own` skips the robots check, and is only ever legitimate for your own site

No dependency was added for any of it. The parsing is careful string work with
tests on the cases that break it — a `</script>` inside a script, entities that
would split a phrase in half, and block elements that need a newline so
"Firms skinBrightens" never reaches the scanner.

**What it cannot do.** A page that builds itself in the browser returns a nav
bar; that comes back marked thin and refuses to be scanned rather than scoring
the navigation. Paste those by hand.

**What it has been run against.** A real page over the real network — 344KB of
GitHub markup down to 3.7KB of words, `<main>` correctly preferred, and their
robots.txt correctly refusing `/search` and `*/commits/`. Then a 15KB
Dawn-shaped product page carrying every trap worth having: 120 script tags, a
minified bundle with `</script>` inside a string, the inline
`application/json` variant blob that repeats the description, a `<noscript>`
fallback, a consent banner, a mega-menu full of other products' claims, a
review widget, a related-products carousel, and `eco&#8209;friendly` written
with a non-breaking hyphen. All of it is in `tests/fetch.test.ts` now. The one
thing that got through on the first run was the consent banner, whose text
said "you agree to our cruelty free cookie policy" — flagged, correctly by the
rules and uselessly for the brand.


## Rewrites

```
pnpm card --file page.txt --rewrite
```

Every note already carries its rule's remedy — *what* would settle it. A
rewrite is the sentence itself, in the brand's voice.

**The model drafts; the rules dispose.** Every draft is re-scanned by the same
deterministic engine that raised the finding, and accepted only if that rule is
gone *and* nothing new has appeared. A draft that reads beautifully and still
trips the rule is discarded. That is law 1 holding with a model in the room:
nothing a model writes becomes a finding, a score, or a verdict — a rewrite is
advice attached to a finding, checked by the same rules that produced it.

**Per mark, not per finding.** "Eco-friendly" answers to the ECGT, the Green
Guides and the ACCC at once. One draft has to satisfy all three, and one that
clears Europe while still tripping the Green Guides has moved the problem
across the Atlantic rather than fixed it.

### Never invent evidence

The single worst thing this product could ship. Ask a model to make "clinically
proven to reduce fine lines" defensible and the helpful thing to write is *"in
a 12-week study, 87% of women reported smoother skin"* — a better sentence,
clears the rule, and a claim the brand cannot support and never made. They then
publish it, on our advice, on a page carrying our mark.

So `fabrication.ts` extracts every figure, duration, certification scheme,
study word and ranking from a draft and rejects it if any of them was not
already on the page. Deliberately over-broad: a false positive costs a retry, a
false negative costs a brand a claim it cannot defend.

**A blank is a good answer.** Some fixes need a fact only the brand has — which
scheme certified them, what the study measured, which component the claim is
about. The draft writes `[name your scheme]` rather than guessing, and
placeholders are stripped before evidence is counted. Without that valve,
"never invent" collapses into "always delete the claim", and a model with only
two moves reaches for the invention.

### Two fixes need no model

A permitted-indication verb and an availability qualifier are exact, so they
run offline, cost nothing, and still go through the same gate:

```
  rewrote "Boosts immunity" → "Supports immunity" [mechanical]
  rewrote "recyclable" → "recyclable where facilities exist" [mechanical]
```

Everything else returns nothing rather than guessing. "No nasties" becomes the
brand's own exclusion list and nothing here knows what is in it.

### When nothing clears the gate

It says so, and keeps the remedy — which was already correct. A wrong draft
displacing a correct remedy is worse than no draft:

```
  kept the remedy for "Fully recyclable" — the exact fix did not clear the gate
             "Fully recyclable where facilities exist": still trips
             eu-ecgt-whole-product-from-one-part
```

That one is the design working. The Green Guides want an availability
qualifier and the ECGT wants the component named; the mechanical fix answers
the first and not the second, so the mark keeps its remedy until a draft
answers both.


## Calibration

`pnpm calibrate` runs the corpus over eight invented pages spanning the buyer's
categories — careful skincare, the median PDP, a supplement page, clean-beauty
free-from copy, an EU sustainability page, clean-label food, a Meta ad, and a
safety-warning panel — and checks the marks per page against the band a
specialist would set.

The bands fail in **both** directions, which is the unusual half. A rule corpus
only ever drifts louder: every rule is added because something was missed,
never because something was over-flagged. And the kill test does not fail
because the scanner missed something — it fails because a founder opens a card,
sees their whole page underlined, and decides the thing cannot tell a problem
from a sentence.

It has already earned itself twice:

- **`au-tga-serious-condition` flagged a caution panel.** "Speak to your doctor
  before use if you have asthma" is the most responsible sentence on a
  supplement page, and it was being marked high-severity as a therapeutic
  claim. The rule now suppresses inside a warning frame, and still fires on
  "for hands living with arthritis".
- **"Our cans are recyclable" was flagged for not naming a component.** It
  names one perfectly; nobody had written "can" into the rule's list.

`tests/calibration.test.ts` holds the same bands, so CI is where the next one
gets caught.

## The kill test

`pnpm killtest` reads `killtest/targets.txt`, renders a card per target, and
keeps `killtest/ledger.md` — whose arithmetic is BRIEF.md §10's gate: 8+ of 30
wanting the live product, or 3+ offering to pay. Re-running preserves the
outreach columns you fill in by hand, which `tests/ledger.test.ts` exists to
guarantee: a re-run that silently ate a fortnight of replies would leave a file
that still looked right.

**Nothing under `killtest/` is committed** except the example target list. Not
the copy, not the findings, not a score. These brands have agreed to nothing.

The runbook — how to pick the thirty, what to say, what counts as a yes, and
how to read the result — is [KILLTEST.md](KILLTEST.md). What the tooling
deliberately does **not** do is fetch a page or send a message: the outreach is
the test, and a scan of somebody's page they did not ask for is a thing a
person did, not a thing a script did on its own.


## Honest limitations

Read this section before showing anything from this engine to a brand.

- **The citations have not been through counsel.** They were authored from the
  founder's own regulatory knowledge and they are accurate to the best of that
  knowledge, but a citation is the first thing a brand's lawyer checks. Before
  launch, every `citation` in `src/packs/` needs a pass — and the ECGT locators
  in particular are descriptive rather than numbered, because Annex I point
  numbering shifts between the amending directive, the consolidated UCPD and
  each member state's transposition. A precisely wrong citation is worse on a
  score page than a plainly descriptive one.
- **ECGT transposition is per member state.** The pack scores against the
  directive. Which member state a brand actually sells into is not yet modelled.
- **The extractor is deterministic and simple.** It splits on sentence
  boundaries, bullets and pipes, and categorises with a lexicon. It is good
  enough that findings are attributed and highlighted well; it is not the model
  the brief specifies, and prose from a scraped page will segment worse than
  the fixtures do.
- **21 rules is a slice, not coverage.** It is the wedge, authored in the order
  §7 asked for. `pnpm rules` is the honest picture, and it should be run before
  a market is promised to anybody.
- **The drafter has never run against the real API.** The request shape is
  asserted against a fake client — model, adaptive thinking, cached system
  prompt, the rule's guidance and example in the prompt — but no credentials
  were available where this was built, so whether a real model writes copy a
  founder would use is unmeasured. The gate around it is fully tested; the
  taste is not.
- **The share card wraps text by estimate.** SVG has no layout engine and the
  face is not measurable from here, so `wrapText` approximates and errs narrow.
  A phrase that breaks one word early looks considered; the alternative
  overruns the frame.

## What this is not

Not legal advice, and the engine says so on every result — `DISCLAIMER` is a
field on `ScanResult` rather than something each surface remembers to add.

Not a tool for scanning other people's brands. `CLAUDE.md` carries the rule and
`BRIEF.md` §9 carries the reasoning: users scan their own properties at their
own initiation, and we never publish a result.

Not related to ClaimKind. No shared code, no shared service, no imports. The
only thing that crossed over is the founder's knowledge, which is not code.

## Layout

```
src/engine/types.ts       the vocabulary — and where the guardrails are types
src/engine/match.ts       the declarative matcher, over a whole document
src/engine/framing.ts     the four things this product will say, and the ban list
src/engine/score.ts       100 minus arithmetic you can read
src/engine/evaluate.ts    the scan
src/engine/registry.ts    which markets are answered for, and the refusal
src/extract/deterministic.ts   segmentation, with no model in it
src/packs/                21 rules, three markets

src/card/tokens.ts        the palette, the two faces, and why there is no red
src/card/annotate.ts      findings merged into numbered marks over the copy
src/card/page.ts          the result page, as one standalone HTML file
src/card/og.ts            the 1200×630 share card
src/card/badge.ts         the mark, live and lapsed
src/card/escape.ts        the security boundary, since the copy is not ours
src/card/fonts.ts         the only file here that touches the disk

src/fetch/robots.ts       obeyed, because we write to the people we read
src/fetch/html.ts         markup to words, with no parser dependency
src/fetch/extract.ts      the ladder — structured sources before the page
src/fetch/coverage.ts     what a structured fetch left behind, by scanning it
src/fetch/fetch.ts        the only file here that touches the network

src/rewrite/fabrication.ts  the one thing a draft may never do
src/rewrite/validate.ts     the gate: the rules decide, not the model
src/rewrite/deterministic.ts  the two fixes that are exact
src/rewrite/model.ts        the only file that sends a model anything
src/rewrite/rewrite.ts      draft per mark, gate everything, report the misses

src/killtest/ledger.ts    the gate's arithmetic, and a round trip that is tested

scripts/scan.ts           findings in a terminal
scripts/card.ts           one page, three artefacts
scripts/killtest.ts       thirty pages, thirty cards, one ledger
scripts/calibrate.ts      the corpus read at volume
scripts/rules.ts          coverage, printed
tests/                    292 tests, none of which need a network
```
