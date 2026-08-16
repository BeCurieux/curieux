# CLAUDE.md — the personal ingredient rules engine

Read `BRIEF.md` before doing anything. This file is the short version that must
never be violated. Where the two disagree, this file wins until somebody changes
it deliberately — the disagreements are listed at the end, so they are visible
rather than discovered halfway through a task.

**The name is not decided.** §3 rules out Ingrid and requires App Store, domain,
company and trademark screening before anything is committed to. `src/lib/brand.ts`
holds an unscreened placeholder and says so; `tests/safety.test.ts` fails if the
ruled-out name appears in `src/` or on a rendered card.

## North star

**Your rules. Any label. Three seconds.**

The user teaches the app what matters to them once. The app applies those rules
consistently to anything they photograph. If a proposed feature adds a diary, a
streak, a feed, a chat box, a barcode lookup, a plan, or an opinion of its own:
the answer is no. Ask before deviating.

The word-of-mouth sentence the whole product is shaped to earn (§28):

> "You tell it what you don't eat and then just scan stuff."

## The six principles

§33, and every decision gets tested against them:

1. The camera is the homepage.
2. The user's rules determine the verdict.
3. **AI reads. The rules engine decides.**
4. Uncertainty must be visible.
5. Every scan should be shareable.
6. Never use fear where explanation will do.

## The one architectural law

**The model reads the label. The rules engine decides the verdict.**

- The vision pass produces a `ParsedLabel` and nothing else: the ingredient
  names as printed, in order, each with a confidence and a legibility state. It
  has no field a verdict could go in — the constraint is structural, not a
  request in a prompt.
- The verdict is computed by ordinary code from
  `ParsedLabel × RuleSet × KnowledgeGraph`. §7: *"Do not allow a
  general-purpose LLM to improvise whether a product is good or bad."*
- The model may also help turn a sentence into rules (§6), and there it picks
  from a closed vocabulary and never writes the explanation. Anything it names
  that does not exist is reported to the user as unmapped, never coerced to the
  nearest match.
- Every model response is validated against the schema (zod). Invalid → retry
  with the error. Never build a verdict on unvalidated output.

Why it is worth the constraint, in the brief's own terms: §25 makes **verdict
dispute rate** a first-class metric, which is meaningless if the verdict drifts
between runs; §16 requires every verdict to be inspectable down to the rule and
the source; and §17's six safety rules become properties of a function rather
than hopes about a prompt.

Consequence worth stating plainly: **a new flag is a data change, not a prompt
change.** That is §15's moat accumulating rather than a prompt getting longer.

## The ontology is the asset

§14 and §15. An entry says what an ingredient *is* — identity, classification,
relationships, evidence, uncertainty — and never what to think about it. The
opinion lives in the user's rules and nowhere else.

Relationships are parent links in `knowledge/classes.ts`, so one rule reaches a
whole family: *"I'm vegan"* is a single rule targeting `animal-derived`, not
forty ingredient rules, and a new sweetener classified once inherits every rule
anybody has ever written about sweeteners.

Two boundaries in that tree are load-bearing:

- **`oil-seed` and `oil-fruit` are siblings, never ancestor and descendant.**
  The entire seed-oil audience is defined by that distinction; a shared ancestor
  quietly uniting them would be the single most damaging wrong match available.
- **Allergen classes sit outside the provenance tree.** A vegan rule and a
  milk-allergy rule both reach whey and must produce completely different
  output, so they are different classes rather than one class with two meanings.

## The safety rules, as code

§17 says safety *"cannot be left to disclaimers. It must shape the actual
product."* Each rule is enforced in the engine and asserted in
`tests/safety.test.ts` over the real graph and the real presets:

1. **Never certify allergen safety.** `verdict/language.ts` owns every sentence
   about a declared allergen, and no state can contain *safe*, *free from*,
   *clear*, *fine*, *suitable for* or *none found*. The state is named
   `not-listed-in-what-we-read` rather than `not-listed`, and the long name is
   deliberate: a future refactor that tidies it would silently turn a report
   about our reading into a claim about the product.
2. **Uncertainty is not absence.** Never *"no problem ingredients"*; always
   *"no conflicts found in the text we could identify."* An uncertainty is
   scoped to the classes it actually casts doubt on — mono- and diglycerides
   may be animal or plant, so a vegan rule cannot be settled from the label,
   but they are emulsifiers either way and a rule about emulsifiers is not in
   doubt at all.
3. **No diagnoses or health-outcome claims.** Graph copy and every generated
   verdict string are linted against a term list. The default is always *you
   asked us to flag this ingredient*.
4. **No universal morality score.** A blocker or a flag that cannot name the
   rule behind it is the app having an opinion. The schema rejects a rule whose
   sentence does not attribute the decision to the user.
5. **Don't manufacture anxiety.** Uncertainty is explained, not decorated with a
   warning symbol. A plain label scores 100 and says nothing else.
6. **Health data gets heightened protection.** Nothing is persisted. A dispute
   carries the versions and the ingredient text — never the photograph, never
   the rules, never an identity.

Two consequences that are easy to lose and are tested:

- **The absence of a class is not the absence of a question.** An entry whose
  uncertainty touches a rule's target is reached by that rule even when it is
  not classified under it. Without this, a vegan user gets a clean verdict on
  the one ingredient they most needed to be told about.
- **A share card that omits a qualifier makes a claim.** "96% match · watching
  for peanuts" with no allergen block reads as *no peanuts* to a reader who did
  not take the photograph. The allergen block is never what gets trimmed for
  space.

## Stack (fixed)

TypeScript strict · zod at every boundary · Anthropic API behind two adapters
(vision, rule authoring) · vitest. React Native/Expo, Supabase, RevenueCat,
Superwall and Stripe arrive with the app, which is behind the gate below. No
other services without asking.

## Build order (do not reorder)

§22 and §26 gate the build on mock creative, so the order follows from that:

1. **Ontology and graph** — classes, parents, entries with evidence and
   uncertainty. Everything downstream is a function of it.
2. **Rules** — presets, and natural-language authoring against a closed
   vocabulary with a confirmation step.
3. **Engine** — `ParsedLabel × RuleSet × Graph` → verdict, deterministically.
4. **Renderer and Compare** — the result screen, the share card, the compare
   card, and the two-people card. These are the Phase 0 mock-ups.
5. **Parse adapter** — photo → `ParsedLabel`. Completes the loop.
6. **STOP.** The iOS app, onboarding UI, paywall, billing, Supabase, scan
   history and the substitute recommender are gated on §26.

### The gate is a test

`tests/stop-line.test.ts` fails if anything behind step 6 gets built, and if
§19's do-not-build list gets started. None of those features arrives announcing
itself as gated: the paywall arrives as "RevenueCat is twenty minutes", scan
history as "we already have the verdict object, it's one table". Each is
individually reasonable and collectively the reason the mock-ups never get
filmed.

If one of those checks starts failing, that is not a bug. It is somebody having
built past the gate, and the honest fix is to delete it or to open the gate on
purpose — in the same commit, by deleting the check, so the rule is removed
where it is written down rather than routed around.

## Product rules

- **No substitute recommendations.** §10 is explicit: recommending a product
  creates a second hallucination surface. Compare mode is the sanctioned answer,
  and it only ever ranks two labels the user photographed themselves.
- **Blockers override the score in the layout, and never zero it in the
  arithmetic.** §8 wants the restriction leading the screen; the percentage
  still has to be able to rank two flawed products, or Compare mode cannot work.
- **Umbrella terms surface whether or not a rule mentions them.** They limit
  every rule at once, so making them opt-in would mean the completeness of a
  check depends on the user having predicted the problem.
- **No score at all when the ingredient set is unknowable.** Truncated or
  illegible means there is an ingredient we know nothing about. §8 Step 2:
  *never silently guess.*
- Every finding renders as ingredient → the rule it broke, in the user's own
  framing → confidence → what the label did not say. Never a bare "bad".
- Mobile-first and shareable: every verdict has to be legible at thumbnail size
  in somebody else's feed and honest at full size.

## The drawer rule

§15's moat is built from captured data — the scan corpus, the failure corpus,
the evaluation dataset, the preference graph. Nothing in this codebase learns
from any of it. No learned weights, no experimentation framework, no
"intelligence" claims in copy. If a task seems to require the engine, stop and
ask.

## Definition of done for steps 1–5

`pnpm decode <image> --rules <name>` produces a verdict and a share card from a
photograph of a real label, in under three seconds, with every finding naming
the rule it came from — and the same photograph produces the same percentage
every time it is run.

---

# Where the brief collides with itself

Recorded at the same time as the contract, so the disagreements are visible.
`BRIEF.md` is not edited to hide them.

## 1. "Validate before building" versus a 2–4 week V1 — DECIDED: the gate holds

§22 and §26 are unambiguous that realistic mock-ups come first and the build
proceeds only on evidence of product intent. §18 describes a 2–4 week V1
including a paywall and a backend. Both cannot be first.

**Decided: the gate holds, and the build order above is what "before the gate"
legitimately contains.** §22 asks for mock-ups that test four specific
hypotheses, and those need real verdicts to be worth filming — so the graph, the
rules, the engine and the renderer *are* the Phase 0 asset, and they are also
the part §36 says carries into attempt two. What waits is everything that only
matters if people want it.

## 2. §17 Rule 4 versus a single percentage

§17 Rule 4 forbids a universal morality score. §8 asks for a percentage that is
"useful for consumer comprehension and virality". A number on a card is the most
universal-looking thing a product can print, and a screenshot of "38%" travels
without its rule set attached.

**Decided: the percentage always renders with the rule set beside it**, in the
same block, on every card — and the footnote on every card says it is not a
health score and says nothing about anyone else's rules. `tests/render.test.ts`
asserts the rule set is on every card. This does not fully solve the screenshot
problem; nothing does. It is the strongest available mitigation short of
dropping the number, which §8 and §11 both depend on.

## 3. The brief's worked example gives 82%; this engine gives 83%

§8's example — twenty ingredients, one blocker, two things to know, seventeen
clear — prints 82%. This engine says 83%, and the gap is pinned by a test rather
than papered over.

The brief's two "things to know" are not the same kind of thing: maltodextrin is
marked *High confidence*, natural flavours *Limited information*. This engine
credits an unresolvable ingredient (0.70) slightly higher than a rule that
definitely matched (0.55), because §17 Rule 5 says uncertainty is not a conflict.
Weighting them identically would reproduce 82 exactly and would mean telling
somebody that "we couldn't check this" is as bad as "this breaks your rule".

## 4. §5's pregnancy profile cannot contain a blocker

§5 says pregnancy is a *"check this"* profile and that the language is *worth
checking* rather than *unsafe during pregnancy*. A blocker is the app reaching a
conclusion, and §5 puts that conclusion with a clinician.

**Decided: the pregnancy preset contains no `avoid` rules at all** — every rule
in it is a `flag`. This is a real reduction in what the preset appears to do,
and it is the honest reading of §5.

## 5. §5 demotes allergy; §17 Rule 1 still governs it

§5 moves allergy households from the first launch segment to the fifth and says
allergy functionality *"should expand only after the scan engine has accumulated
significant real-world evaluation data"*. §17 Rule 1 remains unconditional.

**Decided: the allergen path is built to §17 Rule 1's standard now, and
marketed to nobody.** A preset exists, its rules carry an `allergen` marker that
moves every output into the never-certify vocabulary, and allergen notices are
kept out of the percentage entirely. Building it late would mean building it
under pressure, on the segment where being wrong is worst.

## Where the brief and this contract agree, strongly

- §7's pipeline is the architectural law, restated.
- §14's per-ingredient fields are the `KnowledgeEntry` type, field for field.
- §16's inspect panel is the `Finding` type: why you're seeing this, what it is,
  how sure we are, and the source.
- §19's do-not-build list is `tests/stop-line.test.ts` almost line for line.
- §27's kill criteria are the reason step 6 is a stop rather than a sprint.
