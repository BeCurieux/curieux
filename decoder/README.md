# decoder

Tell it what you don't eat. Then just scan stuff.

A photograph of an ingredient list, checked against rules one particular person
wrote. Two people scanning the same packet get different answers, and that is
the product rather than a side effect.

**The consumer name is not decided.** §3 of the brief rules out the previous
working name and requires App Store, domain, company and trademark screening
before anything is committed. `src/lib/brand.ts` carries an unscreened
placeholder and says so loudly; a test fails if the ruled-out name reappears.

```
pnpm install
pnpm rules "I'm vegan. I avoid artificial sweeteners. I don't care about seed oils."
pnpm verdict protein-bar brief-user-a     # §4's USER A
pnpm verdict protein-bar brief-user-b     # …and USER B, same packet
pnpm compare protein-bar rival-bar vegan  # §9's Compare mode
pnpm verdict half-read peanut-listed      # the refusal
pnpm press                                # the Phase 0 mock-ups, as SVG
pnpm knowledge                            # what the graph knows, and doesn't
pnpm test
```

None of that touches the network or needs an API key. The one command that does
is the full loop:

```
ANTHROPIC_API_KEY=... pnpm decode ./label.jpg --rules vegan --out ./out
```

---

## What this is, and what it is not yet

`BRIEF.md` is the brief, recorded as given. `CLAUDE.md` is the short contract
that must never be violated, and it is the file to read second.

The brief gates the build on mock creative (§22, §26) and then describes a 2–4
week V1 with a paywall and a backend. Both cannot be first. **The gate holds.**
What is built is the part §22's mock-ups actually need and that §36 says carries
into attempt two:

| Step | | |
| --- | --- | --- |
| 1 | Ontology and graph | `src/lib/knowledge` — 74 entries, 49 classes, 477 spellings |
| 2 | Rules | `src/lib/rules` — presets, and plain-English rule authoring |
| 3 | Engine | `src/lib/verdict/evaluate.ts` — deterministic, every finding sourced |
| 4 | Renderer and Compare | `src/lib/render` — four card types, the Phase 0 assets |
| 5 | Parse adapter | `src/lib/parse` — photo → structured label |
| 6 | **Stop** | the app, the paywall, the backend, history, substitutes |

`tests/stop-line.test.ts` fails if anything past step 6 gets built, or if
anything on §19's do-not-build list gets started.

## The architecture

**AI reads. The rules engine decides.** (§7, and §33's third principle.)

```
  photo ──▶ vision ──▶ ParsedLabel ──┐
                       (validated)    │
             RuleSet ────────────────┼──▶ evaluate() ──▶ Verdict ──▶ SVG
      KnowledgeGraph ────────────────┘      (pure)
```

`ParsedLabel` has no field a verdict could go in, so there is nowhere to put a
score even if a prompt drifted. Everything after it is ordinary code.

The payoff is four things §25 and §16 require and a raw model call cannot give:
the same photograph and rules produce the same percentage forever; every finding
names the rule behind it and the source behind that; §17's safety rules are
properties of a function rather than hopes about a prompt; and a new flag is a
data change rather than a longer prompt.

## The ontology is the asset

§15 says the moat is the ontology and the alias graph, not a table of 300 rows.
So relationships are parent links, and one rule reaches a whole family:

```
sunflower oil → oil-seed → oil-vegetable → oil
gelatin       → animal-derived        (+ species not disclosed)
carmine       → insect-derived → animal-derived
```

`"I'm vegan"` is **one** rule targeting `animal-derived`. A new sweetener
classified once inherits every rule anybody has ever written about sweeteners.

Two boundaries in that tree are load-bearing and tested:

- **`oil-seed` and `oil-fruit` are siblings, never ancestor and descendant.**
  The whole seed-oil audience is defined by that line; a shared ancestor would
  make coconut oil a seed oil.
- **Allergen classes sit outside the provenance tree.** A vegan rule and a
  milk-allergy rule both reach whey and must produce completely different
  output.

`pnpm knowledge` prints coverage per class, and — more usefully — every preset
rule that currently reaches nothing, because that is a rule the user sees in
their list which silently never fires.

## The safety rules are code, not copy

§17: *"Safety cannot be left to disclaimers. It must shape the actual product."*
All six are enforced in the engine and asserted in `tests/safety.test.ts`
against the real graph and the real presets. Three worth calling out:

**Never certify an allergen.** No allergen sentence can contain *safe*, *free
from*, *clear*, *fine*, *suitable for* or *none found*. The state is called
`not-listed-in-what-we-read`, and the long name is deliberate — a refactor that
shortened it to `not-listed` would turn a report about our reading into a claim
about the product.

**Uncertainty is not absence, and it is scoped to the question.** An earlier
pass applied every uncertainty to every rule, which produced *"you asked us to
avoid emulsifiers — this may be animal or plant derived"*: a real doubt attached
to a question the label had already answered. Uncertainty now names the classes
it casts doubt on. The converse matters more: **the absence of a class is not
the absence of a question**, so an entry whose uncertainty touches a rule is
reached by that rule even when it is not classified under it. Without that, a
vegan user gets a clean verdict on mono- and diglycerides — the one ingredient
they most needed to be told about.

**No score at all when the ingredient set is unknowable.** Not a lowered score
with a caution underneath — the caution is not what gets screenshotted.

```
pnpm verdict half-read peanut-listed
```

## Compare mode, not substitutes

§10 forbids recommending a specific product: *"Product X is bad → buy Product Y"*
is a second hallucination surface. So the app never names a product it has not
read. `pnpm compare` ranks two labels the user photographed, against rules the
user wrote, and every reason it gives is a count of things already on screen.

The tie-break is blockers, then flags, then uncertainty, then the percentage —
in that order, because §8 says a blocker overrides the score. A product with a
higher percentage and a blocker has not won.

## The cards

`pnpm press` writes 18 SVGs at 1080×1920, covering §22's four hypotheses:

- **A — personal rules create curiosity**: result screens across six labels and
  rule sets, including the control that is not alarming and the refusal that
  produces no score.
- **B — two people, one packet**: §4's USER A and USER B on the same bar, with
  their actual blockers named.
- **C — Compare mode**: the same two bars against three different rule sets. The
  winner changes.
- **D — share cards** for everything in A.

They are mock-ups only in that no phone runs them. Every verdict inside is
computed by the real engine from real label text, because a fake door that lies
about the product tests a door nobody is buying.

Warm cream rather than a dark alert screen, on purpose: §32 rules out looking
medical and §13 rules out fear-driven wellness, and a dark card with a red
number is the visual language of both.

To rasterise (any headless Chromium):

```
chromium --headless --window-size=1080,1920 \
  --screenshot=out.png file://$PWD/press/compare--vegan.svg
```

## Layout

```
BRIEF.md                       the brief, as given
CLAUDE.md                      the contract, and the collisions
src/lib/schema.ts              every boundary, as zod
src/lib/knowledge/classes.ts   the ontology, as a tree
src/lib/knowledge/entries.ts   what ingredients are — never what to think
src/lib/rules/presets.ts       §6's presets
src/lib/rules/author.ts        plain English → rules, closed vocabulary
src/lib/verdict/evaluate.ts    the engine
src/lib/verdict/language.ts    every sentence the verdict can say
src/lib/verdict/compare.ts     §9
src/lib/feedback.ts            §16's disputes, §25's rate
src/lib/render/card.ts         four cards
src/lib/parse/                 photo → ParsedLabel, provider-agnostic
tests/safety.test.ts           §17's six rules, asserted
tests/stop-line.test.ts        the gate and §19
scripts/                       verdict · compare · rules · decode · press · knowledge
```

## What is deliberately absent

From §19 and the gate, each asserted by `tests/stop-line.test.ts`: Android,
calorie and macro tracking, meal logging, weight loss, a food diary, a barcode
database, a social feed, a chatbot, recipes, nutrition plans, supermarket and
restaurant integrations, a substitute marketplace, a wellness dashboard, the iOS
shell, onboarding UI, the paywall, billing, Supabase and history.

Also absent, and worth naming: **nothing is persisted.** §17 Rule 6 asks for
minimised collection, and the first thing this product would store is a list of
what somebody avoids.

## Honest gaps

- **74 entries against §18's target of 300–500.** `pnpm knowledge` prints the
  number and the per-class coverage.
- **No citation carries a URL yet** (0 of 56). Every `cite` is a statement that
  can be stood behind; a URL is a different claim — that a page exists and says
  this today — and §16 puts the source in front of the user on every tap, so the
  links have to be real. That is founder review work.
- **The offline rule author is literal.** `draftRulesLocally` recognises the
  phrasings people actually type and reports everything else as unmapped. The
  model path handles the rest; the local path exists so a failed inference call
  cannot kill onboarding at the worst possible moment.

## What happens next

Per §22 and §26:

1. Film the mock-ups in `press/` against all four hypotheses. The gate is not a
   view count — §22 is explicit that *"one 50K-view video caused by creator luck
   is weak validation"* and wants three different concepts producing genuine
   install intent.
2. If it clears, open step 6 deliberately: delete the relevant checks in
   `tests/stop-line.test.ts` in the same commit that builds the feature.
3. If it does not, kill it. The graph, the rules engine and the renderer are
   what §36 says carries into attempt two.

Outstanding either way: run §3's name screening, attach verified URLs to the 56
citations, and grow the graph towards 300.
