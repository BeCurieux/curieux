# assay — the claim engine

Marketing copy in; findings that cite a named instrument, and a score whose
every deducted point traces to a rule, out.

This is step 1 of the build order in `CLAUDE.md`: the engine that everything
else in `BRIEF.md` sits on top of. It has no UI yet, no URL fetching, no model
call and no database. It also has no configuration, no API key and no network
access, which is the property that matters most right now — the kill test in
§10 of the brief runs before any of that exists, and it runs on this.

```
pnpm install
pnpm scan --text "Clinically proven to clear acne in 7 days. Eco-friendly, too."
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
| `pnpm scan --file page.txt --json` | The whole `ScanResult`, for a score card to render |
| `pnpm rules` | What the corpus covers, and what it does not |
| `pnpm test` · `pnpm typecheck` | 108 tests, no network, no key |

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
- **Nothing here fetches a URL.** Paste or a file, for now.

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
scripts/scan.ts           the CLI the kill test runs on
scripts/rules.ts          coverage, printed
tests/                    108 tests, none of which need a network
```
