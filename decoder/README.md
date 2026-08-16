# decoder

A photograph of an ingredient list, and a verdict for one particular person.

Working name of the consumer product: **Ingrid**. The directory is named for
the venture rather than the brand, because §3 of the brief asks for a
collision and trademark sweep before the name is committed and that sweep has
not been run.

```
pnpm install
pnpm verdict half-read allergy-household     # the answer when the photo is bad
pnpm verdict rainbow-snack clean-label       # the answer the demo is built on
pnpm press                                   # the Phase 0 cards, as SVG
pnpm knowledge                               # what the knowledge base knows
pnpm test
```

Nothing above touches the network or needs an API key. The one command that
does is the full loop:

```
ANTHROPIC_API_KEY=... pnpm decode ./label.jpg --profile clean-label --out ./out
```

---

## What this is, and what it is not yet

`BRIEF.md` is the founding brief, recorded as given. `CLAUDE.md` is the short
contract that must never be violated, and it is the file to read second.

The brief gates the whole build on a fake-door test — §9: *"Three seeded
TikToks using a mocked result screen … No pull, no build"* — and then §11
describes a two-to-three week V1 with a paywall and a backend. Both cannot be
first. **The gate holds.** What is built here is the part of §11 that Phase 0
actually requires and that survives a kill:

| Step | | |
| --- | --- | --- |
| 1 | Knowledge base | `src/lib/knowledge` — 59 entries, 423 label spellings |
| 2 | Verdict engine | `src/lib/verdict` — deterministic, sourced, reproducible |
| 3 | Renderer | `src/lib/render` — the verdict screen and the share card |
| 4 | Parse adapter | `src/lib/parse` — photo → structured label, model-agnostic |
| 5 | **Stop** | the app, the quiz, the paywall, the backend, scan history |

Step 5 is enforced by `tests/stop-line.test.ts`. If one of those checks goes
red, somebody has built past the gate.

## The one architectural law

**The model reads the label. It never decides the verdict.**

The vision pass produces a `ParsedLabel` — the ingredient names as printed, in
order, each with a confidence and a legibility state — and it has no field a
score, a flag or a piece of advice could survive in. The verdict is then
computed by ordinary code from `ParsedLabel × Profile × KnowledgeBase`.

```
  photo ──▶ vision ──▶ ParsedLabel ──┐
                        (validated)   ├──▶ verdictFor() ──▶ Verdict ──▶ SVG
             Profile ────────────────┤        (pure)
       KnowledgeBase ────────────────┘
```

The payoff is four things the brief asks for and a raw model call cannot give:

- **The same photograph produces the same score, forever.** A number that moves
  between runs cannot be defended when somebody screenshots two of them.
- **Every flag traces to an entry with a citation.** §6 wants *ingredient → why
  it's flagged for YOUR profile → confidence → plain English → source*. That is
  the `Flag` type, field for field.
- **§10 is provable.** "Never certify safety for an allergen" is a property of
  a function that can be tested exhaustively. As a line in a prompt it is a
  hope.
- **A new flag is a data change, not a prompt change.** Which is the asset in
  §13 accumulating, rather than a prompt getting longer.

## The safety rules are code, not copy

`BRIEF.md` §10 is described as non-negotiable, and a non-negotiable rule that
lives only in a prompt survives until the first busy afternoon. Each one is
enforced in the engine and asserted in `tests/safety.test.ts` over the real
knowledge base:

- **No allergen is ever certified.** `verdict/language.ts` owns every sentence
  the product can say about an allergen, and no state — flagged, not flagged,
  cannot verify — can contain *safe*, *free from*, *clear*, *fine* or *suitable
  for*. The absence of a flag is never evidence: a user with a peanut allergy
  gets a sentence about peanuts on every scan, including the scans that found
  nothing.
- **No disease name, anywhere.** Knowledge-base copy and every generated
  verdict string are linted against a term list. An entry reaching for one
  turns CI red.
- **No calories, no portions, no virtue.** Same lint. §10.4.
- **Every red flag carries a source and something to look for instead.** The
  schema rejects an entry that has neither, so it is impossible rather than
  discouraged.
- **Scores compare within category.** Sugar in confectionery costs a fraction
  of sugar in a condiment.

### The one that mattered most

The first version of the engine returned **100/100, "Nothing flagged for you"**
on a label that was cut off and half illegible, with a caution printed
underneath. That is §6's kill scenario exactly, because the caution is not what
gets screenshotted.

So the score is now **withheld** — not lowered, not caveated — whenever the
ingredient set is unknowable: the list runs off the frame, or an ingredient
could not be read. The card renders `NO SCORE` where the number goes.

```
pnpm verdict half-read allergy-household
```

A merely *smudged* ingredient is different — the identity is known and the
reading is imperfect — so it keeps its score and carries the lower
`readConfidence` on the flag.

## Where the brief collides with itself

Five collisions are recorded in full at the end of `CLAUDE.md`. Two matter for
reading the code:

**The hero screenshot flags the wrong thing.** §6's example verdict reds
*sunflower lecithin* on a seed-oil profile. Lecithin is an emulsifier used well
under 1%, not one of the frying oils that audience avoids, and redding it would
red most chocolate, protein powder and nut butter on the shelf. It is amber
here, and it explains itself. Recorded rather than obeyed — if the owner wants
it red, that is a call to make against the note.

**"Better pick: [comparable product]" needs a database §11 forbids.** There is
no honest way to name a competitor product without a catalogue, and naming one
anyway is inventing a claim about somebody else's label. So the swap is at the
ingredient level — *look for one where the fat is olive or avocado oil* — which
is checkable from the knowledge base alone.

## The knowledge base

59 entries, 423 label spellings, covering all five launch niches. `pnpm
knowledge` prints the coverage per axis, including the three axes that
currently know nothing.

**It is a seed, not §11's 300.** Two conventions in it are load-bearing:

- **Citations carry no URLs yet** (0 of 57). Every `cite` is a statement that
  can be stood behind; a URL is a different claim — that a specific page exists
  and says this today — and inventing one in a file whose whole job is
  trustworthiness would be this product's kill scenario in miniature.
  Attaching verified links is founder review work.
- **`strength: "preference"` is used freely and is not a weakness.** Where
  there is no regulatory position and no settled evidence, the entry says so:
  the user avoids it, we flag it because they said so, and we assert nothing
  about the world. That is the honest register for most of the clean-label
  axis, and §10.2 requires it.

Matching is whole-token and exact after normalisation, never fuzzy and never a
substring, with an exception table for the compounds that contain a name while
meaning something else. `tests/knowledge.test.ts` holds both tables: 46 things
that must be found — `Arachis Oil` is peanut, `Sodium Caseinate` is milk — and
24 that must not — `Coconut Milk` is not dairy, `Cocoa Butter` is not dairy,
`Cauliflower` is not wheat.

## The renderer

`pnpm press` writes twelve SVGs — a 1080×1920 verdict screen and a 1080×1350
share card for six label-and-profile pairs. These are the Phase 0 assets: the
result screen §9's three seeded TikToks are filmed against.

They are *mocked* only in that no phone runs them. The verdicts inside are
real, computed by the engine from real label text, because a fake door that
lies about the product tests a door nobody is buying.

The set deliberately includes the one nobody would choose to film — the badly
photographed label that refuses to produce a score — because that screen is the
product's actual character and it is better to look at it before filming than
after launching.

To rasterise (any headless Chromium will do):

```
chromium --headless --window-size=1080,1920 \
  --screenshot=out.png file://$PWD/press/rainbow-snack--clean-label.screen.svg
```

## Layout

```
BRIEF.md                    the founding brief, as given
CLAUDE.md                   the contract, and the collisions
src/lib/schema.ts           every boundary, as zod
src/lib/knowledge/          entries, and the matcher
src/lib/verdict/score.ts    the engine
src/lib/verdict/language.ts every sentence about an allergen
src/lib/parse/              photo → ParsedLabel, provider-agnostic
src/lib/render/             the two cards, as SVG
src/lib/profile/            the five launch profiles
src/lib/fixtures.ts         labels as they actually print
tests/safety.test.ts        §10, asserted
tests/stop-line.test.ts     the gate
scripts/                    verdict · decode · press · knowledge
```

## What is deliberately absent

From §11's do-not-build list and CLAUDE.md's gate, each asserted by
`tests/stop-line.test.ts`: barcode scanning, a packaged-product database, food
logging, diaries, streaks, a chat interface, nutrition plans, a social feed,
Android, the iOS shell, the onboarding quiz, the paywall, billing, Supabase and
scan history.

Also absent, and worth naming: **nothing is persisted.** The first thing this
product would store is a list of what somebody is allergic to, and it does not
store it yet.

## What happens next

Per §12, in order:

1. Run the Phase 0 fake door with the cards in `press/`. Gate: one video past
   ~50K views with strong saves and shares.
2. Solve the TikTok Ads account problem in parallel (§9 — an AU self-serve
   account cannot target the US, and this is a launch blocker if left late).
3. If the gate clears, open step 5 deliberately: delete the relevant checks in
   `tests/stop-line.test.ts` in the same commit that builds the feature, so the
   rule is removed where it is written down.
4. If it does not clear, kill it. The knowledge base, the engine and the
   renderer are the parts that carry into attempt two.

The founder-review work that is outstanding either way: verified URLs on the 57
citations, and growing the knowledge base from 59 entries towards 300.
