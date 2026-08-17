# The merchandiser, run for the first time

*17 August 2026 · ten hardware products · `claude-opus-5` · eleven real generations*

Every shop this project has ever produced came from the deterministic fallback,
which takes products in catalogue order. This is the first assessment of the
merchandiser with a model actually answering.

The short version: **the selection layer is real and mostly good, the design
layer is not happening at all, and the thing had never run once.**

---

## 1. It had never run. Three blockers, each fatal.

Before any merchandising could be judged, three bugs had to be fixed. None of
them were subtle, and none of them were caught by the 468 tests that were
passing — because every test faked the SDK client, and all three failures live
in the gap between the request we build and the request the API accepts.

**The plan schema was uncompilable.** `output_config.format` rejected the whole
request with *"the compiled grammar is too large."* Not schema size — a
3,540-byte variant fails and a 9,834-byte one passes. The cause is `format`:
`format: "uri"` (×4) and `format: "date-time"` (×1) each compile to a large
regex inside the constrained grammar, and five of them together blow the
budget. I found this by bisecting variants against the live API rather than
guessing:

```
FAIL    9900b  full schema (as shipped)
PASS    9834b  full, no `format` keywords
FAIL    3540b  full, no descriptions          <- smaller, still fails
PASS    8846b  4 block variants (with format)
FAIL    9315b  5 block variants (with format)
```

Dropping `format` costs nothing. A URL was never checked for being URL-shaped;
it is checked against `allowedUrls`, the closed set read off this store, which
is strictly stronger and is where the real risk lives. `launchesAt` is likewise
checked against the merchant's brief. Both constraints are now prose in the
schema and enforced in `validate.ts`, which is the convention that file already
documented for `maxLength` and friends.

**The Genome could not send its request.** `client.beta.messages.create` throws
before a byte leaves the process when `max_tokens` is high enough to outlast
the SDK's ten-minute non-streaming timeout — and a whole-catalogue read at
32,000 tokens is exactly that. Now streamed via `.stream(...).finalMessage()`.

**The Genome sent an Opus-only parameter to Sonnet.** `fallbacks: "default"`
→ `400 'claude-sonnet-5' does not support the 'fallbacks' parameter`. A test
asserted that parameter was present, which is precisely why nobody noticed: it
pinned a request shape that could never succeed. The test now asserts the
opposite, with the reason written down. The merchandiser's own `fallbacks` is
correct and stays — it runs Opus 5.

**And the cost of a shop was unmeasurable.** Diagnostics reported `2 in` for a
request that sent a ten-product catalogue, because `input_tokens` excludes
cache reads and cache writes and the brief is cached on purpose. Fixed in both
providers; the merchandiser now reports the split, since reads and writes bill
at different rates.

A fourth thing was *not* broken and I want that on the record: the guard
against silently downgrading to the mock provider held. `createAnthropicProvider`
throws before constructing a client. Its test was only ever clearing
`ANTHROPIC_API_KEY`, so it started passing vacuously the moment
`POPUUP_ANTHROPIC_API_KEY` was populated — it now clears every name
`anthropicApiKey()` reads. The guard was right; the test had stopped guarding it.

---

## 2. Are the four shops genuinely different?

**Yes — on selection and structure. No — on design.**

Same catalogue, four briefs, `--no-genome`, run twice each:

| | products | order | structure |
|---|---|---|---|
| **first workshop** | 9 → 8 | drill, sockets, gloves, boots, belt | routine + grid |
| **gift under $100** | 4 → 3 | sockets, belt, gloves | single grid |
| **stolen kit** | 10 → 9 | drill, sockets, boots, belt | two grids |
| **end of season** | 8 → 8 | gloves → belt → sockets → … → chest | two grids, price-banded |

These are not one shop reshuffled. The gift shop is three products; the pro
shop is nine or ten. The sale shop is strictly price-ascending; the first-workshop
shop is dependency-ordered (drill before sockets before safety gear) and uses a
`routine` block because order genuinely means something there. The sale shop
invented a $100 price band the brief never mentioned and split its grid on it.
That is a structural decision, not a copy change.

**The theme is not different. At all.** Across all eleven generations spanning
five distinct briefs, the colorway is byte-identical:

```
#F7F4EF / #EAE3D6 / #17140F / #D6420B   ← in every single shop
```

…which is exactly `brand.suggestedColorway`, unchanged. `typography` was
`mono-utility` and `mood` was `utility` every time. Only `density` and
`cornerRadius` ever moved, and they moved *between reruns of the same prompt* —
that is noise, not merchandising.

The model is obeying its instructions here: the system prompt says to start
from the read-off colourway and change it "only if the brief asks for a
different feeling," and none of my four briefs asked for a feeling. But the
consequence is worth stating plainly: **for audience-driven prompts, theme
selection is a pass-through constant.** The pitch says the system "selects,
merchandises and designs." Three of those are happening. The fourth is
currently `return brand.suggestedColorway`.

> **Followed up.** The instruction was the cause and is now changed — see the
> fix list at the end. Mood, typography, density and radius move with the
> audience on a re-run; colour still does not, but this catalogue has an empty
> `brand.palette`, so there was never a second colour to move to. That part
> stands unproven either way until it runs against a store with a homepage.

---

## 3. Are the choices defensible?

**The sale shop is the best result here, and it is not close.** The brief asked
for in-stock, cheapest first. Both out-of-stock products were excluded, all
eight survivors were ordered strictly by ascending price with zero errors, and
it did this identically on both runs. The trap in this catalogue is the
$79.99 angle grinder — third-cheapest and *sold out* — and it dodged it both
times. Its hero even says "Sold-out lines removed," which is true.

**The gift shop respects the price cap.** Max selected price $89.99 against a
$100 cap, both runs. It also read "a partner who fixes everything" as a person
who already owns tools and selected accordingly — sockets, belt, gloves — rather
than reaching for the drill.

**The first-workshop shop picks starter tools over the tool chest.** The $549.99
chest is never in the opening block; it appears in a clearly-framed second
section ("When the bench outgrows the box"). The lead is the $149.99 drill. The
ordering — drill → sockets → gloves → boots → belt — is defensible on the
merits.

So on the three constraint questions asked: yes, yes, and yes.

---

## 4. What it got wrong

This is the part worth reading.

**The "stolen kit" shop selected the entire catalogue.** Ten products out of ten
on the first run, nine on the second. That is not merchandising — that is the
catalogue with headings on it. *(Fixed — see §8.)* The system prompt is explicit ("Fewer, better…
every product you add dilutes the ones you believe in") and the model ignored
it completely when the brief didn't supply a hard filter. Worse, it included the
petrol chainsaw — outdoor clearing equipment, not a tradesperson's kit — and
two out-of-stock items, for a shopper whose defining trait is *needing tools
right now*. When a brief contains a constraint the model can check itself
against, it is disciplined. When the brief is open-ended, it does not select at
all. That is the single biggest defect found here, and it is invisible on the
sale and gift prompts.

**The first-workshop shop has the same disease, milder.** Nine of ten, then
eight of ten. Both runs kept the $199.99 hydraulic floor jack for someone
setting up their first workshop; one blurb frankly admits the problem — *"For
the day the workshop takes on car work."* That is a product looking for a
justification, which is what selecting-almost-everything forces you to write.

**The gift shop shipped an unbuyable gift.** Run 1 selected four products, one
of which — the angle grinder — was out of stock. In a four-item gift edit, 25%
of the shop cannot be purchased. It is within the letter of the rules (sold-out
products are shown and marked, and the brief didn't ask for in-stock only), but
"weak fit on its own merits" plainly applies to a sold-out angle grinder as a
present. Run 2 dropped it. So the correct call was available and the model
found it half the time.

**Run-to-run variance is real and unmanaged.** Every prompt produced a
materially different shop on its second run — different product counts,
different block structure, sometimes a different verdict on the same
sold-out item. The sale shop was the only one that was stable. Nothing in the
pipeline surfaces this: a merchant regenerating an unchanged shop gets a
different one, with no indication that anything varied.

**Blurbs vary in wording, barely in angle.** The same product gets essentially
the same sentence in every shop:

> gloves, first-workshop: *"Full-grain palm with a knuckle guard; phone still works through the fingertips."*
> gloves, gift: *"Knuckle guard and touchscreen fingertips, so the phone stays reachable."*
> gloves, pro: *"Reinforced knuckle guard, and you can still work a phone screen."*

Three audiences, one fact, reworded. Only the sale shop's version adds an
audience-specific angle ("the easiest thing to replace before winter"). The copy
is closer to spec-summarising than to merchandising, and it is the weakest part
of the model's output.

**A price claim slipped past its own rule.** The sale shop titled a block
"Under $100" and a CTA "Start under $100" — but the merchant never asked for a
$100 threshold. The system prompt permits a threshold in a title only when the
merchant asked for one; `validate.ts` only checks that such a title is *true*,
not that it was *requested*. The claim happens to be accurate, so nothing
shipped wrong, but prompt and validator disagree about the rule and the
validator is the one that runs.

**Gendered titles pass through unexamined.** Three of the ten products are
titled "Men's …". The gift shop — explicitly "a gift for a partner" — selected
two of them. The model's own copy never says "men's," but the renderer shows
product titles, so the page does. That is a catalogue problem rather than a
merchandiser bug, and the merchandiser is the layer that could have noticed.

---

## 5. What it costs

Opus 5 at $5/M input, $25/M output; cache reads bill at ~0.1×. The brief and
system prompt cache, so nearly all input is a cache read after the first call.

| shop | input (cached) | output | cost |
|---|---|---|---|
| first workshop | 7,695 (7,693) | 1,284 | **$0.036** |
| gift under $100 | 7,698 (7,696) | 1,129 | **$0.032** |
| stolen kit | 7,696 (7,694) | 1,147 | **$0.033** |
| end of season | 7,692 (7,690) | 1,284 | **$0.036** |

**≈ $0.034 per shop**, 13–20 seconds, one attempt every time — the retry loop
never fired across eleven generations, so the schema and validator are agreeing
with the model on the first try. The first shop for a new store pays a cache
write instead of a read (~$0.08). Twenty shops off one catalogue is about
**$0.72**.

---

## 6. Is the Genome worth it?

The Genome pass costs **$0.025 once per store** (Sonnet 5, 3,513 in / 1,800 out,
19s, at the introductory rate — $0.038 standard). It adds ~1,530 input tokens
to every subsequent merchandising call, taking a shop from $0.034 to **$0.038**.
For twenty shops: about $0.08 extra on a $0.72 base. Roughly 10%.

With it on, the first-workshop shop got **better in exactly the way that shop
was weak**:

| | no Genome | Genome |
|---|---|---|
| products | 9, then 8 | **7** |
| floor jack ($199, car work) | kept both runs | **dropped** |
| out-of-stock items | 1 | **0** |
| routine length | 5 steps | **4 steps** |

It cut the thing I criticised in §4 — the failure to actually select — and the
hero copy sharpened with it (*"Four tools do most of the work in a new
workshop. Buy those first, add the rest as the jobs arrive."*). The Genome's
`role` and `with:`/`or:` fields are the plausible mechanism: the floor jack has
no relationship to the starter set, and dropping it is the call those fields
exist to inform.

**But I am not going to oversell one sample.** That is n=1 against n=2, and the
no-genome runs already varied by a product between themselves. The Genome run
landed at the good end of a range that overlaps what the plain runs produced.
The direction is encouraging and the mechanism is credible; the effect size is
not established. It also did nothing for the theme problem — same colorway,
same mood.

At 10% on the marginal shop it does not need a large effect to pay for itself,
and it self-reports when it is weak (it flagged that 5 of 10 products came back
`hero`, which is not discriminating). **Keep it on. Do not yet claim it is what
makes the merchandising good** — measure it against the open-ended briefs
(the "stolen kit" prompt is the one that needs help) across several runs before
putting that in a pitch.

---

## 7. Does the merchandiser earn its place?

**Yes, with one large qualification and one correction to the pitch.**

It earns it on constrained briefs. Given a price cap, a stock filter, or an
ordering rule, it honours the constraint exactly, orders sensibly, groups
coherently, picks a defensible hero, and writes clean unhyped copy — for about
three and a half cents in fifteen seconds. The deterministic fallback cannot do
any of that; it returns catalogue order regardless of who is arriving. On the
sale prompt the model beat the fallback outright and did it reproducibly.

The qualification: **on open-ended briefs it does not select.** Nine or ten
products out of ten is the catalogue with better headings, and that is the case
the product's own demo — "one catalogue, twenty different shops" — leans on
hardest. A ten-product fixture flatters this; on a 200-product catalogue the
same behaviour would produce an unusable page, and I have no evidence either way
about what it does at that size.

The correction: the brief says the system "selects, merchandises and designs."
On this evidence it selects well, merchandises adequately (copy is competent but
barely audience-aware), and does not design at all — theme output was a constant
across every brief tested. Design quality in the shipped shops is coming
entirely from the renderer, which is what the architecture intended, but it does
mean the AI's contribution to *design* is currently nil and should not be
claimed.

**No "One catalogue. Infinite shops." landing section on this evidence.** The
shops are genuinely different where it counts, which is the good news — but the
two open-ended briefs returned nearly the whole catalogue, and the theme never
moved. The claim would be over-selling a real result, and the honest version of
the demo is the sale prompt, not the pro prompt.

### What I would fix next, in order

1. ~~**Make "fewer, better" bite when the brief has no filter.**~~ **Done — §8.**
   Two halves, landed separately and now merged: `checkSelection` in
   `validate.ts` makes the failure *visible*, and the size the brief now states
   (`selectionCeiling`) makes it stop *happening* — the stolen-kit shop went
   from 10 and 9 products to 7 and 7, the first-workshop shop from 9 and 8 to 6
   and 6. It stays a warning and never an error, because as a hard rule it
   would have failed the best shop in this report.
2. ~~**Decide whether theme is a real output.**~~ **Half fixed, half untested.**
   The prompt tied theme to the brand twice over — *"change it only if the brief
   asks for a different feeling"* and *"pick the mood from how the brand
   writes"* — and the brand is constant, so the theme could never move. The
   model was obeying orders. Colour now stays the brand's while mood,
   typography, density and radius follow the shopper. Re-run across the same
   four briefs:

   | | mood | typography | density | radius |
   |---|---|---|---|---|
   | first workshop | utility | modern-sans | regular | soft |
   | gift under $100 | **editorial** | **editorial-serif** | **airy** | soft |
   | stolen kit | utility | mono-utility | compact | none |
   | end of season | utility | mono-utility | compact | none |

   Three typographies where there was one, and the density and radius now track
   the brief instead of drifting between reruns. **Colour still did not move —
   and on this catalogue it could not have.** `brand.palette` is empty, because
   the fixture was bridged from a `products.json` with no homepage read, so
   there was nothing to choose between and echoing the suggested colourway was
   the right answer. The colour half of §2 above is therefore *untested*, not
   disproven. It needs a store with a real palette behind it.
3. **Reconcile the threshold rule** between the system prompt and `validate.ts`
   — currently one says "only if the merchant asked" and the other checks only
   truth.
4. **Test on a catalogue big enough to hurt.** Ten products cannot show whether
   selection scales; the definition of done calls for four real catalogues and
   one with poor photography, and none of that has happened.
5. **Look at run-to-run variance deliberately** before a merchant discovers it
   by pressing regenerate.

---

## 8. Fixed: "fewer, better" on open-ended briefs

The §4 defect is closed. Sixteen further generations, two runs per brief,
`--no-genome` so the change is isolated:

| brief | before | after |
|---|---|---|
| stolen kit *(open)* | 10, 9 | **7, 7** |
| first workshop *(open)* | 9, 8 | **6, 6** |
| gift under $100 *(filtered)* | 4 *(one sold out)*, 3 | **3, 3** |
| end of season *(enumerative)* | 8, 8 | **8, 8** — unchanged |

**The diagnosis was that "fewer, better" was an adjective with nothing to check
against.** On a brief with an explicit filter the model had a testable
condition and honoured it exactly; on an open brief it had only a preference,
and preferences lose to the pull of a catalogue sitting right there. So the fix
is not more emphasis — the prompt-audit rule against pressure language applies,
and shouting at a model that already follows instructions closely mostly causes
over-triggering. The fix is to make the rule checkable:

- **`selectionCeiling()` puts a number in the brief**, computed from catalogue
  size and stated where the decision happens: *"A good shop from a catalogue
  this size tops out around 7 products."* Sub-linear — 70% of ten products is a
  plausible edit, 70% of two hundred is not a shop — and capped at twelve.
- **The system prompt names the failure** rather than repeating the preference:
  an audience is a filter even when it names no price, and a selection that is
  most of the catalogue is the storefront rearranged.
- **`validate.ts` warns above 70% of the catalogue** (`checkSelection`), and
  only when the brief isn't asking for a complete listing. A warning, never an
  error — see below.

These two halves were built independently and merged. The check makes the
failure visible; the ceiling makes it stop happening. Keeping both is the point:
prevention that is never audited drifts, and a warning on a defect nothing
prevents just documents it every time.

Merging them did move one decision. The check originally accepted a standing
false positive on the clearance brief, which was right when it was the only
defence — a warning nobody wanted beat shipping a catalogue as an edit. With the
ceiling in place the open briefs land at six and seven of ten and no longer trip
it, so the clearance shop would have become the only thing that ever warned, and
every warning on this catalogue a false one. Its guard now recognises stock
phrasings ("still in stock", "what's left") for that reason.

**Two things this deliberately does not do**, both because the measurements
said so:

**It is a ceiling with no floor.** The first version stated a range — "4 to 7
products" — and it made the gift shop *worse*: only four products in this
catalogue come in under $100, one of them is sold out, and a stated minimum was
enough to pull the unbuyable angle grinder back in to make the number. Both
runs. That is the exact defect §4 criticised, manufactured by my own fix. The
brief now says there is no lower bound and that a brief narrowing the field to
three products gets a shop of three.

On the merged prompt the gift shop ran four times: **3, 3, 3 and one 4 that
again included the sold-out grinder.** Better than the baseline and much better
than the floored version, but the §4 defect is reduced rather than closed — it
is now a minority outcome instead of a coin flip, and a fifth of gift shops
still ship something unbuyable.

**It never errors.** The best shop this merchandiser produces takes every
in-stock product in the catalogue, because the merchant asked what was still in
stock. A rule that rejected breadth outright would reject the good output along
with the bad. The warning is suppressed on enumerative briefs, and the sale shop
verified unchanged at 8 of 10 across both runs.

Two secondary effects worth recording. **Run-to-run variance collapsed** on the
open briefs — 7/7 and 6/6, with the first-workshop shop selecting identical
membership both times, where before every rerun differed. A checkable target
appears to stabilise the decision, not just shrink it. And **the Genome now
compounds with it**: first-workshop lands on 5 products, max $149.99 — drill,
sockets, laser, gloves, belt, which is a starter kit and nothing else.

What it does not fix: the $549 tool chest still appears in the pro shop (that
is defensible — quality over price), and the theme is still a constant. §7's
correction to the pitch stands unchanged.
