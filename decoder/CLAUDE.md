# CLAUDE.md — the ingredient decoder (working name: Ingrid)

Read `BRIEF.md` before doing anything. This file is the short version that must
never be violated. Where the two disagree, this file wins until somebody
changes it deliberately — the disagreements are listed at the end, so they are
visible rather than discovered halfway through a task.

## North star

**"Is this bad for me?" — answered in three seconds, for you specifically.**

One narrow job: camera in, verdict out. If a proposed feature adds a diary, a
streak, a feed, a chat box, a barcode lookup, or a plan — the answer is no.
Ask before deviating.

## The one architectural law

**The model reads the label. It never decides the verdict.**

- The vision pass produces a `ParsedLabel` and nothing else: the ingredient
  names as printed, in order, each with a confidence and a legibility state.
  It emits no score, no flag, no judgement, no advice.
- The verdict is computed by ordinary deterministic code from
  `ParsedLabel × Profile × KnowledgeBase`. The same label and the same profile
  produce the same score every time, and every flag traces to a knowledge-base
  entry with a source.
- Every model response is validated against the schema (zod). Invalid → retry
  with the error. Never build a verdict on unvalidated output.

The reason is in the brief, twice. §6: *"Trust is the entire product; one
confidently-wrong viral screenshot is the kill scenario."* §13 names the
defensible asset as the knowledge graph and the evaluation dataset — the things
that make this *"measurably more accurate than a raw model call."* A model that
scores the label directly is a product with no moat and no auditable answer to
"why did it say that?" It also cannot be *proven* to obey §10, and §10 is the
kind of rule that has to be provable rather than prompted.

Consequence worth stating plainly: a new flag is a data change, not a prompt
change. That is the asset accumulating.

## The safety rules, as code

`BRIEF.md` §10 is non-negotiable. Prompts are not a control surface for a
non-negotiable rule, so each one is enforced by the engine and asserted by
`tests/safety.test.ts`:

1. **Never certify safety for an allergen.** The verdict language for an
   allergen axis is *flagged* or *not flagged on this label*, never *safe*,
   *free from*, or *clear*. A label can be wrong, OCR can miss a word, and
   cross-contamination is not on the label at all. `verdict/language.ts` owns
   this vocabulary and the test asserts no verdict string can carry the
   forbidden words.
2. **No medical or diagnostic claims, anywhere.** No disease names, no organ
   damage, no "linked to". Knowledge-base copy is linted against a term list at
   test time — a new entry that reaches for a disease name turns CI red.
3. **Inform, don't farm anxiety.** Scores compare within category — a biscuit is
   scored as a biscuit. A red flag never renders alone; it carries what to look
   for instead. Copy never moralises food or people.
4. **Not a weight-loss tool.** No calories, no portions, no "should you eat
   this". Linted with §10.2.
5. **Every flag carries its source.** An entry with no citation cannot be
   flagged red — the schema makes it impossible, not merely discouraged.

Rule 1 has a specific shape that is easy to lose. **The absence of a flag is
never evidence.** If the label is partly illegible, or an umbrella term hides
its contents, an allergen axis reports *cannot verify from this label* — it
must never fall through to the quiet reassurance of a clean result.

## Stack (fixed)

TypeScript strict · zod for every boundary · Anthropic API behind a
model-agnostic adapter · vitest. React Native/Expo, Supabase, RevenueCat,
Superwall and Stripe arrive with the app, which is behind the gate below. No
other services without asking.

## Build order (do not reorder)

The brief gates the build on Phase 0 and the order follows from that. §9:
*"Three seeded TikToks using a mocked result screen … No pull, no build."*
§12: *"Proceed to build only if Phase 0 fake-door clears."*

1. **Knowledge base** — the ingredient entries: names and synonyms, E-numbers,
   plain-English explanation, which profile axis cares and why, and a source.
   Founder work, and the beginning of the moat. Built first because everything
   downstream is a function of it.
2. **Verdict engine** — `ParsedLabel × Profile × KnowledgeBase` → score and
   flags, deterministically, with within-category baselines.
3. **Renderer** — the verdict screen and the share card, as images. This is the
   Phase 0 asset: the "mocked result screen" the seeded TikToks are filmed
   against. It is mocked in the sense that no phone runs it yet — the verdicts
   in it are real, computed by step 2 from real labels, because a fake door
   that lies about the product tests the wrong door.
4. **Parse adapter** — photo → `ParsedLabel`. Model-agnostic, validated.
   Completes the loop end to end from a photograph.
5. **STOP.** The iOS app, onboarding quiz, paywall, billing, Supabase and scan
   history are gated on the Phase 0 result (≥1 video ≥50K views with strong
   saves/shares).

### The gate is a test

`tests/stop-line.test.ts` fails if anything behind step 5 gets built, and if
any §10 rule gets loosened. None of those features arrives announcing itself as
gated: the paywall arrives as "RevenueCat is twenty minutes", scan history
arrives as "we already have the verdict object". Each is individually
reasonable and collectively the reason the fake door never gets tested.

If one of those checks starts failing, that is not a bug. It is somebody having
built past the gate, and the honest fix is to delete it or to open the gate on
purpose — in the same commit, by deleting the check, so the rule is removed
where it is written down rather than routed around.

## Product rules

- Scores are within-category. A crisp is scored against crisps. Cross-category
  comparison is the anxiety machine in §10.3 and is not available.
- Never invent a product. There is no product database in V1 (§11), so a
  "better pick" is a swap at the ingredient level — *look for one where the fat
  is olive or avocado oil* — never a named competitor product we cannot verify
  exists, is stocked, or has that label.
- Umbrella terms ("natural flavors", "spices", "proprietary blend") are always
  a distinct amber state, never green and never red. They are the honest
  answer: the label does not say.
- Every flag renders as ingredient → why it's flagged for *your* profile →
  confidence → plain English → source. Never a bare "bad".
- The share card is the growth surface and the most important screen. It must
  be legible at thumbnail size and honest at full size.

## The drawer rule

A verdict-evaluation dataset (§13) accumulates from human-reviewed scans and
someday improves parse accuracy. Until then it does not exist: no learned
weights, no scoring model, no "AI-personalised" claims beyond the profile the
user typed in themselves. Log faithfully and build nothing on top. If a task
seems to require the engine, stop and ask.

## Definition of done for steps 1–4

`pnpm decode <image> --profile <name>` produces a verdict and a share card from
a photograph of a real label, in under three seconds, with every flag citing a
source — and the same photograph produces the same score every time it is run.

---

# Where the brief collides with itself

Recorded at the same time as the contract, so the disagreements are visible.
`BRIEF.md` is not edited to hide them. Each needs a deliberate decision; two
have been made.

## 1. "No pull, no build" versus a 2–3 week V1 — DECIDED: the gate holds

§9 and §12 are unambiguous that nothing gets built before a seeded video clears
~50K views. §11 describes a 2–3 week V1 including a paywall and a backend. Both
cannot be first.

**Decided: the gate holds, and the build order above is what "before the gate"
legitimately contains.** Phase 0 needs a result screen to film, and a result
screen needs a verdict to show. Building the knowledge base, the engine and the
renderer *is* building the fake door — and it is the part of §11 that survives
a kill, because the knowledge base is the asset §13 says compounds. What waits
is everything that only matters if people want it: the app shell, the quiz, the
paywall, the backend.

The rule this protects is the brief's own: *"the discipline is dying in week 8,
not month 8."*

## 2. "Better pick: [comparable product]" needs a database §11 forbids

§6's verdict mock ends with *"Better pick: [comparable product with cleaner
list]"* and §10.3 makes it a hard rule: *"every red flag comes with a better
pick, not just a warning."* §11 forbids the thing that would make that possible:
*"Do NOT build in V1: barcode scanning or packaged-product database."*

There is no honest way to name a comparable product without a catalogue. Naming
one anyway is inventing a claim about a third party's label, which is §10.2 and
§8's never-list at the same time, and it is the kind of error that arrives as a
screenshot.

**Decided: the swap is at the ingredient level, not the product level.** Every
red flag carries `lookFor` — *a version where the sweetener is sugar or
monk fruit* — which is checkable from the knowledge base alone, satisfies the
intent of §10.3 (never a bare warning), and does not require inventing a
product. Product-level picks return when there is a catalogue to draw them
from, which is a post-gate decision.

## 3. The hero example flags an ingredient that should not be flagged

§6's verdict mock reads:

> 🔴 Contains: sunflower lecithin — flagged because your profile avoids seed oils

Sunflower lecithin is an emulsifier — a phospholipid fraction, used at well
under 1%, and not a seed oil in the sense the seed-oil-avoiding audience means
(the high-linoleic cooking and frying oils). A seed-oil profile that reds a
lecithin will red a very large share of chocolate, protein powder and nut
butter, and the first person who notices is a creator with an audience.

This is precisely the confidently-wrong flag §6 names as the kill scenario,
sitting inside the brief's own hero screenshot. **Recorded, not obeyed.** The
knowledge base treats sunflower lecithin as its own entry with an amber
"related but not the thing you're avoiding" state, and the seed-oil axis reds
the oils themselves. If the owner wants lecithin red for that profile, that is
a deliberate call to make against this note, not a default to inherit from a
mock.

The general form of the rule: **an axis flags what its audience actually
avoids, not everything that shares a word with it.**

## 4. "Confidence" is two different things

§6 asks every flag to carry a confidence. Two unrelated uncertainties are in
play and collapsing them would be misleading: how sure we are we *read the word
correctly* (OCR), and how well-established the *reason for the concern* is
(evidence). A crisply-printed ingredient with a contested rationale and a
smudged ingredient with a settled one are not the same claim.

The schema carries both — `readConfidence` on the parsed token, `strength` on
the knowledge-base entry — and the renderer never shows a single merged number.

## 5. §10.5's disclaimer, read as written

*"clear ToS, no medical-advice disclaimer"* reads literally as *no disclaimer*,
which contradicts the same sentence's purpose and §10.2. Read as
"a no-medical-advice disclaimer", which is what the rest of §10 requires. Noted
because it is a one-hyphen difference in a legal line.

## Where the brief and this contract agree, strongly

Worth saying, because it is most of the document.

- §6's *"ingredient → why it's flagged for YOUR profile → confidence → plain
  English → source"* is the `Flag` type, field for field.
- §13's *"model-agnostic"* knowledge graph is why the adapter exists and why
  the engine imports no provider SDK.
- §10.3's within-category scoring is the scorer's baseline table.
- §11's do-not-build list is `tests/stop-line.test.ts` almost line for line.
- §12's kill criteria are the reason step 5 is a stop rather than a sprint.
