# The kill test

BRIEF.md §10, as a thing you can actually do on a Tuesday.

Two weeks, thirty brands, no accounts and no infrastructure. It answers one
question — *is this pain acute enough that a founder wants a self-serve tool
for it* — and it answers it before the model plumbing, the accounts, the
Shopify app or the billing get written. That ordering is the point. A no is
cheap now and expensive after four weeks of pipeline.

There is now a page fetcher, opened ahead of its place in the build order so
that collecting thirty pages is a command rather than an afternoon. It changes
what you type and nothing about what the test asks.

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

Nothing in this repository sends a message, and nothing fetches a page unless
you type `--fetch`. Both are deliberate. The outreach is the test, and reading
somebody's page is a thing you decided to do rather than a side effect of
asking for cards to be re-rendered — which is also why the fetcher obeys
robots.txt, pauses between requests, and puts `SCAN_CONTACT` in every one of
them. The first message you send is about their copy only if none of that was
skipped.

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

### Size is the filter that matters most

The instinct is to aim high, and it is wrong in both directions.

A brand everybody has heard of has counsel, or an agency with counsel. The
founder does not read their own DMs, nobody can buy a tool without procurement,
and the reply — if it comes — is from someone whose job is to say the copy is
fine. That is a wasted target dressed as a good one.

Below roughly $500k the founder agrees enthusiastically and cannot pay for
anything. Enthusiasm from someone with no budget reads exactly like a yes in
the ledger, and §10's gate is a count of yeses. **Those are the two ways this
test lies to you**, and they lie in the same direction.

The target is a brand where one person writes the copy, ships the product and
answers the messages, and where a bad month of ad disapprovals costs real
money. Practically: 1–20 people, Shopify, a founder whose face is on the About
page.

### Finding them, per bucket

The buckets are not equally hard. Two can be filled from a sofa; one has to be
hunted, and it is the most valuable one.

**Recently disapproved (~12) — hunted, and time-sensitive.** This is not
searchable from a brand's own site, because a disapproval is invisible from
outside. It surfaces where founders complain: DTC and beauty founder groups on
LinkedIn, Slack and Discord, r/shopify and r/PPC, and the replies under any
Meta policy-change post. Look for a dated, specific complaint — *"our whole ad
account went down over one word"* — and take the brand from the profile. A
complaint from more than about eight weeks ago is stale: they have either
solved it or stopped caring, and both are a no.

**Selling into the EU (~10) — filterable from the site.** Check the shipping
page or add to cart and look for an EU destination. Non-EU brands that ship
into the EU are the sharper half of this bucket: an EU-native brand has
probably already heard about the ECGT from their distributor, while an
Australian or American brand shipping into Germany often has not, and the
27 September date is genuinely news to them.

**Mid retailer onboarding (~5) — public.** Clean at Sephora, Credo and Ulta
Conscious Beauty all publish their brand lists, and each has a submission
standard with claim-substantiation language in it. Brands recently added, or
publicly saying they have applied, are in the window where somebody is already
asking them to prove things.

**Loud copy, no known pain (~3) — the control group, and do not skip it.**
Pick these from claim language alone: a PDP saying *clinically proven*,
*non-toxic*, *reef safe*, *eco-friendly* or *chemical free* with nothing
behind it. If the control group converts at the same rate as the acute ones,
the pain is much broader than §2 assumes and that changes the whole product.
If only the acute ones convert, the wedge is real but narrow, and that changes
the pricing.

### Triage before you commit a slot

Do not spend a slot on a page you have not read. Collect fifty or sixty
candidate URLs first, run them, and cut to thirty on what comes back:

```
pnpm killtest --fetch      # with all sixty in targets.txt
```

Anything scoring in the **clear** band is a bad target — not because the brand
is uninteresting, but because the card will say *nothing here trips a rule*,
which is a true and completely unpersuasive thing to send a stranger. Anything
**thin** is a JavaScript shell and costs an afternoon of hand-pasting. What is
left, sorted by how badly it reads, is the thirty.

Then delete the other thirty from `targets.txt`. Nothing about a brand you are
not contacting should sit on your disk.

---

## Running it

```
cp killtest/targets.example.txt killtest/targets.txt
```

One line per brand, tab-separated — slug, product-page URL, why:

```
lumen	https://lumen.example/products/immunity-drops	Meta account disapproved in July, said so on LinkedIn
```

Then collect the copy. Either paste it into `killtest/copy/<slug>.txt` by hand,
or:

```
export SCAN_CONTACT=you@yourdomain.example
pnpm killtest --fetch
```

which writes the same files for you. Set `SCAN_CONTACT` first — every page read
carries it, and an anonymous crawler in a founder's logs is the first thing
that conversation ends up being about.

**Either way, read the page yourself.** The fetched file is a draft of that
reading, not a replacement for it, and it is an ordinary text file precisely so
you can fix it. Two things to check every time:

- The fetcher prefers the product description, which is exactly this product
  and nothing about its neighbours. That means it misses the hero line and the
  "our promise" block. It tells you when it did — `elsewhere on the page…` —
  and those lines usually need pasting in, because that is where the
  environmental claims are.
- A page that builds itself in the browser comes back `THIN`. Paste that one by
  hand.

Reading it first is not a formality. The scanner is 21 rules over three
markets, and you know things it does not. If the card misses something obvious
to you, that is the most valuable output of the whole fortnight — write it in
the ledger's notes column and it becomes a rule.

```
pnpm killtest
```

Run it again without `--fetch` once you have edited the copy. Cards land in
`killtest/out/<slug>.html`, `.card.svg` and `.badge.svg`. Open
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
