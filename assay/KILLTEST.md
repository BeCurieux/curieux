# The kill test

BRIEF.md §10, as a thing you can actually do on a Tuesday.

Two weeks, thirty brands, no accounts and no infrastructure. It answers one
question — *is this pain acute enough that a founder wants a self-serve tool
for it* — and it answers it before a single line of URL fetching, model
plumbing or Shopify OAuth gets written. That ordering is the point. A no is
cheap now and expensive after four weeks of pipeline.

**The gate.** Proceed on **8+ of 30** actively wanting the live product, or
**3+** offering to pay on the spot. Anything else is polite silence, and §10 is
explicit about what polite silence means: the pain is not self-serve-acute. The
sharpest surviving surface — most likely the ad checker — becomes the whole
product, or the concept folds back into ClaimKind's funnel. Kill quickly rather
than rationalise.

---

## What the machine does, and what it does not

`pnpm killtest` runs every target, renders every card, and keeps the ledger
whose arithmetic decides the gate. That is the tedious half.

The half it cannot do is the half that matters, and it is all yours:

- choosing thirty brands that are actually in pain
- reading each page yourself before the scanner does
- writing to a real person, in your own words, about their own page
- reading what comes back

Nothing in this repository sends a message. Nothing in it fetches a page. Both
are deliberate: the outreach is the test, and a scan of somebody's page that
they did not ask for is a thing you did, not a thing a script did on its own.

---

## Before you start: three lines that do not move

**1. Nothing about a named brand is ever committed.** Not the copy, not the
findings, not a score. `.gitignore` keeps all of `killtest/` out of git except
the example target list. These brands have agreed to nothing, and a repository
full of graded strangers is the Yuka problem with a git history — BRIEF.md §9
has the precedents and the cost.

**2. Nothing is published.** The card goes to the founder of that brand and
nobody else. No public report cards, no "we scanned the top 50 clean beauty
brands" content, no screenshots on a launch page with the name blurred. The
viral mechanic is self-scan and voluntary share, and it stays that way.

**3. The card says it is not legal advice, and you should too.** The disclaimer
is on every card because it is a field on the scan result rather than something
a template remembers. Say the same thing in the message. You are showing
someone their own words with the rules beside them, not issuing a finding.

---

## Choosing the thirty

Over-index hard on the two acute moments in §2:

| Weight | Who | How to find them |
|---|---|---|
| ~12 | **Recently disapproved on Meta or TikTok** | Founder posts in DTC/beauty communities complaining about it; the complaint is usually public and dated |
| ~10 | **Selling into the EU** | Ships to EU from an AU/UK/US base, or EU-native. ECGT applies from 27 September and the deadline is the whole campaign |
| ~5 | **Mid retailer onboarding** | Recently listed or applying — Clean at Sephora, Credo, Ulta Conscious Beauty |
| ~3 | **Loud copy, no obvious pain yet** | The control group. If these convert too, the pain is broader than §2 thinks |

Fit the buyer in §2: aesthetic DTC, roughly $500k–$20m, Shopify, taste-driven,
no in-house legal. A brand with a compliance manager is ClaimKind's buyer and
will tell you the ceiling is too low. A brand doing $80k a year cannot pay $49
a month for anything.

Write the reason down for each. `pnpm killtest` refuses a target without one,
which is not pedantry: a target with no reason gets a generic message and a
silence that teaches nothing, and you only get thirty.

---

## Running it

```
cp killtest/targets.example.txt killtest/targets.txt
```

One line per brand, tab-separated — slug, product-page URL, why:

```
lumen	https://lumen.example/products/immunity-drops	Meta account disapproved in July, said so on LinkedIn
```

Then, for each, **read the page yourself** and paste its copy into
`killtest/copy/<slug>.txt`. Product title, hero, bullets, description, any
sustainability paragraph, the reviews if they carry claims. Skip navigation,
shipping tables and the cookie banner.

Reading it first is not a formality. The scanner is 21 rules over three
markets, and you know things it does not. If the card misses something obvious
to you, that is the most valuable output of the whole fortnight — write it in
the ledger's notes column and it becomes a rule.

```
pnpm killtest
```

Cards land in `killtest/out/<slug>.html`, `.card.svg` and `.badge.svg`. Open
the HTML, read it as the founder will, and screenshot the share card for the
DM. `pnpm card --file ... --png` will rasterise one if a Chromium is around.

**Sanity-check every card before it goes anywhere.** A false positive costs you
that brand and, if they screenshot it, several others. If a mark is wrong, stop
and fix the rule — `pnpm calibrate` is the harness for exactly that, and the
eight pages in it exist because the corpus once flagged "speak to your doctor
if you have asthma" as a therapeutic claim.

---

## What to say

Short, specific, about their page and not about the law. The subject line does
the work; the card does the rest. Never open with a fine.

### The EU deadline, for a brand selling there

> **Subject: your [product] page and the 27 September rule**
>
> Hi [name] — I build a tool that reads marketing copy against advertising
> rules, and I ran your [product] page through it.
>
> One thing stood out: [specific phrase]. From 27 September the EU's new green
> claims rules treat that shape of claim as unfair in all circumstances unless
> you can show recognised excellent environmental performance — so it is worth
> a look before then if you ship into Europe.
>
> Card attached — your copy with the phrases marked and the rule beside each.
> It is an opinion about language, not legal advice.
>
> No ask. I am building the live version and wanted to know whether this is
> useful enough to want. Is it?

### The ad disapproval, for a brand that has been hit

> Hi [name] — saw you had [platform] knock back an ad in [month]. That is
> almost always the language rather than the product, and it is the thing I
> have been building a scanner for.
>
> I ran your [product] page: [specific phrase] is one of the phrases the
> platforms screen hardest, and [second phrase] is the FTC's own example.
>
> Card attached — your words, the phrases marked, the rule under each. Not
> legal advice, just what the rulebooks say.
>
> Would you want this live, so it runs on your copy before you launch it?

### Retailer onboarding

> Hi [name] — congratulations on [retailer]. Their claim-substantiation form is
> the part that eats a week, and it asks about exactly the phrases I have
> marked on the card attached: [phrase], [phrase].
>
> Your copy, the phrases underlined, the rule beside each. Opinion about
> language, not legal advice.
>
> Is a live version of this something you would want?

### The rules for all three

- **Name a real phrase from their real page.** The card only lands because it
  is specific. A generic pitch with a beautiful attachment is still a generic
  pitch.
- **Never say they are breaking the law.** You do not know that and neither
  does the scanner. "Likely to be flagged", "may be unsubstantiated" — the same
  register the card uses.
- **Do not lead with a fine.** §3: speed, approval, social proof. Risk is the
  backstop, mentioned last if at all.
- **Ask the question the gate is made of.** "Would you want this live?" is the
  8-of-30 number. Anything unprompted about price is the 3-of-30 number and is
  worth more than any of it.
- **Do not offer a discount.** You are testing whether they want it, not
  whether they want it cheap.

---

## What to record

The ledger is `killtest/ledger.md`, written by the script. Fill in the outreach
columns by hand as replies arrive; re-running preserves them.

| column | what goes in it |
|---|---|
| contacted | date and channel — `2026-08-19 IG DM` |
| replied | `y` if they answered at all |
| wants it live | `y` only if they actively said they want the product |
| asked price | `y` if *they* raised price unprompted |
| offered to pay | `y` only for an actual offer |
| notes | the reply's substance, and anything the card missed |

Be strict with `wants it live`. "Nice, thanks" is not a yes. "How soon can I
have this?" is. The whole point of a gate is that it can fail, and a generously
scored ledger fails later and more expensively.

Run `pnpm killtest` any time to see the count. It prints the gate and writes
the verdict into the ledger.

---

## Reading the result

**Gate met.** Step 4 opens: URL fetching, model extraction, rewrites, accounts,
the Shopify app. Before any of it, take the notes column and turn it into
rules — you will have thirty pages' worth of what the corpus missed, which is
the most valuable rule-authoring input the product will ever get.

**Gate missed, but the ad checker kept coming up.** That is the reshape §10
names. The ad checker becomes the whole product: it is the acute moment, the
copy is short enough to paste, and it needs neither Shopify nor the badge.

**Polite silence.** Fold it back. §10 was written to make this cheap, and the
value of a cheap no is entirely in taking it.

**Something else happened.** Write down what, before rationalising it into one
of the three above. Thirty conversations with the exact buyer is worth more
than the gate it was run to settle.
