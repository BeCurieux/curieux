# Product Brief: Personal Ingredient Rules Engine — Consumer Verdict App

Recorded 2026-08-16, as given. This file is the brief, unedited.

**It supersedes the earlier brief** ("AI Ingredient Decoder", recorded at commit
`d3c2ee8`), which framed the product as a personalised health verdict with a
0–100 score. The repositioning is substantial rather than cosmetic — the verdict
is now compatibility with rules the user wrote, there is no universal score, the
name Ingrid is dropped, allergy moves from the first launch segment to the
fifth, and Compare mode arrives as a defining feature. The old brief stays in
git history rather than in the working tree, so there is one current brief and
no ambiguity about which is being built.

Where later work disagrees with this file, the disagreement is recorded at the
end of `CLAUDE.md` rather than resolved by quietly rewriting this one.

---

## 1. The Opportunity

Build a consumer mobile app that instantly tells someone whether any ingredient list matches their personal rules.

Point the camera at a snack packet, supplement tub, sauce jar, imported product, market-stall label, or restaurant menu.

Within seconds, get:

Your match verdict, anything that conflicts with your rules, what needs a closer look, and why.

The product does not decide universally whether a food is "good" or "bad."

Instead, the user teaches the app what matters to them once:

* ingredients they avoid
* dietary rules they follow
* ingredients they want flagged
* lifestyle or ethical preferences
* custom rules written in plain English

The app then applies those rules consistently to anything they scan.

The core proposition is:

Your rules. Any label. Three seconds.

Or:

Scan anything. See if it fits you.

This is not a barcode database, calorie tracker, food diary, nutrition planner, or generic AI chat tool.

It is a personal ingredient decision engine.

The business model follows the high-velocity consumer utility-app playbook: one narrow job, camera in, immediate answer out, paid subscription, creator-led distribution, and paid acquisition only behind creative that has already demonstrated organic pull.

### Venture target

Target outcome:

~$120k/month / ~$1.4M ARR

This is explicitly a top-percentile outcome, not a forecast.

The operating strategy is therefore:

validate cheaply → build narrowly → kill early if there is no pull → scale aggressively if there is.

## 2. Why This Product

Ingredient scanning itself is no longer sufficient differentiation.

Barcode scanners already exist. AI photo scanners increasingly exist. Personal dietary profiles already exist.

The opportunity is to combine the strongest parts of each category into a product users can actually trust:

Natural-language personal rules + photo recognition + deterministic ingredient evaluation + clear evidence + exceptional UX.

The user's problem isn't really:

"What is maltodextrin?"

It is:

"Does this product conflict with anything I care about?"

That question occurs constantly:

* in supermarkets
* ordering food
* shopping online
* looking at supplements
* buying imported foods
* choosing products for children
* comparing two products
* travelling overseas

The moment is brief.

The product has to answer inside the decision moment.

## 3. Working Concept

Working category:

Personal Ingredient Decoder

The app learns what matters to the user and checks every label against those rules.

### Positioning

Your rules. Any label. Three seconds.

Supporting:

Teach it what you avoid. Scan anything. Know instantly.

Creator-facing:

The app that checks every ingredient against your rules.

### Naming

Do not proceed with Ingrid.

The product needs a short, warm, consumer-friendly name that can plausibly become a verb:

"Scan it with ___."

Naming should communicate neither fear nor clinical medicine.

Avoid names that sound like:

* a nutrition database
* a medical product
* a diet app
* an AI assistant
* generic "clean eating"

Run App Store, domain, company-name and trademark screening before committing.

## 4. The Core Insight

Most ingredient apps begin with the product.

This product begins with the person.

Two people should be able to scan exactly the same item and receive meaningfully different results.

Example:

**USER A**

Rules:

* vegan
* avoids artificial sweeteners
* doesn't care about seed oils

Result:

92% MATCH
No blockers.
One ingredient to know about.

**USER B**

Rules:

* avoids seed oils
* avoids added sugar
* no emulsifiers

Same product:

54% MATCH
2 blockers
Sunflower oil — You asked us to flag seed oils.
Cane sugar — You asked us to avoid added sugars.

This is the product's key demonstration.

The same food. Different person. Different verdict.

That should appear throughout the product, onboarding and marketing.

## 5. The User

Do not launch to "everyone who eats."

Use tightly defined communities with existing content ecosystems.

### Launch ICP priority

**1. Ingredient-conscious consumers**

People already reading labels and actively avoiding particular additives or ingredient categories.

Examples:

* artificial colours
* particular sweeteners
* emulsifiers
* preservatives
* seed oils
* added sugar
* UPF-related ingredients

This is the ideal launch segment because it combines:

* strong existing behaviour
* low education burden
* creator density
* viral potential
* relatively manageable product risk

**2. Dietary and ethical rules**

Examples:

* vegan
* vegetarian
* pescatarian
* halal-related ingredient checks
* kosher-related ingredient checks
* no pork-derived ingredients
* specific personally chosen ingredient restrictions

The app identifies potential conflicts rather than certifying religious compliance.

**3. Diet-protocol users**

Examples:

* keto
* low-FODMAP
* gluten-free preference
* dairy-free preference
* carnivore
* paleo

Where a protocol cannot be determined from ingredients alone, the app explains the limitation.

**4. Pregnancy**

Pregnancy becomes a "check this" profile, not an authoritative safe/unsafe engine.

Language:

Worth checking

rather than:

Unsafe during pregnancy

Anything requiring clinical judgment routes users toward an appropriate authoritative source or health professional.

**5. Allergy households**

High-value eventual segment.

Not the primary V1 acquisition wedge.

The consequence of an OCR failure, incomplete label or cross-contamination assumption is too high to make allergy reassurance the earliest promise.

The product may identify:

PEANUT LISTED ON LABEL

but must never conclude:

SAFE FOR PEANUT ALLERGY

Allergy functionality should expand only after the scan engine has accumulated significant real-world evaluation data.

## 6. Onboarding: Create My Rules

Onboarding should take approximately 45–60 seconds.

Instead of only presenting dozens of toggles, let users describe what they care about naturally.

Prompt:

What do you want us to watch for?

Example:

"I'm vegan. I avoid artificial sweeteners and carrageenan. I don't care about seed oils. Flag anything with caffeine."

The system converts that into structured rules.

The user then confirms them.

### Example

YOUR RULES

Avoid:
✓ Animal-derived ingredients
✓ Artificial sweeteners
✓ Carrageenan

Flag:
✓ Caffeine

Don't flag:
✓ Seed oils

Looks right →

Users can also choose popular presets.

Examples:

Simple ingredients
Vegan
No artificial sweeteners
Low added sugar
Avoid seed oils
Custom

The profile is editable at any time.

## 7. Product Architecture

The core architectural principle is:

**AI reads the label. The rules engine makes the verdict.**

Do not allow a general-purpose LLM to improvise whether a product is good or bad.

### Pipeline

```
PHOTO
↓
IMAGE / OCR EXTRACTION
↓
STRUCTURED INGREDIENT LIST
↓
INGREDIENT NORMALISATION
↓
INGREDIENT KNOWLEDGE GRAPH
×
USER RULES
↓
DETERMINISTIC VERDICT ENGINE
↓
PLAIN-ENGLISH EXPLANATION
```

The model may assist with:

* OCR
* interpreting difficult label formatting
* resolving ingredient aliases
* explanation generation

The model should not independently determine the verdict.

## 8. The Core Loop

### Step 1 — Scan

The camera is the homepage.

No dashboard first. No chat box. No menu maze.

Open app → camera.

Prompt:

Scan an ingredient list

Supports:

* packaging
* menu text
* supplement label
* imported product
* printed recipe
* screenshot later

### Step 2 — Verify

Where OCR confidence is high, continue automatically.

Where confidence is poor:

We couldn't read part of this label clearly.

Highlight the uncertain text.

User can:

Retake photo

or

Confirm ingredients

Never silently guess.

### Step 3 — Verdict

Do not lead with a generic health score.

Lead with compatibility.

Example:

82% MATCH
1 blocker · 2 things to know

🔴 Sunflower oil
You asked us to avoid seed oils.
High confidence

🟡 Natural flavours
The label doesn't tell us exactly what's included, so we can't completely check this against your rules.
Limited information

🟡 Maltodextrin
You asked us to flag rapidly absorbed added carbohydrates.
High confidence

🟢 17 other ingredients
No conflicts found with your current rules.

### Important distinction

A score is useful for consumer comprehension and virality.

But blockers override scores.

If a serious user-defined restriction is identified, the UI leads with the restriction.

For example:

⚠️ PEANUT LISTED
Peanuts appear in this ingredient list.
We can't determine cross-contact or certify this product as safe for an allergy.

The normal compatibility score becomes secondary.

## 9. Compare Mode

This should be one of the defining product features.

After scanning a product:

Compare another

Scan Product B.

The app compares both products solely against the user's rules.

Example:

WHICH FITS YOU BETTER?

PRODUCT A
91% match
✓ No blockers
1 thing to know

PRODUCT B
63% match
2 blockers
2 things to know

A fits your rules better

Why:
✓ no ingredients on your avoidance list
✓ lower number of flagged ingredients
✓ fewer uncertain ingredients

Compare mode creates an extremely natural retail use case.

It also produces powerful social content:

"Everyone says Brand B is healthier. Let's compare."
"Which supermarket protein bar actually matches my rules?"
"The expensive one lost."

This may become more viral than the single-product scan.

## 10. Do Not Build "Better Alternative" Yet

V1 should not automatically recommend a specific substitute unless product data is trustworthy and verified.

Otherwise the product creates a second hallucination surface:

Product X is bad → buy Product Y.

Instead use:

Compare another

Later:

Find me one without this

can become a search/discovery product once the database is sufficiently strong.

## 11. Share Engine

This is not an ancillary feature.

It is a core acquisition mechanism.

Every verdict should have:

SHARE THIS SCAN

Generate a beautiful vertical 9:16 asset automatically.

Example:

I SCANNED THIS 👀
[product image]
63% MATCH FOR ME
🔴 2 ingredients I avoid
🟡 1 thing to know

My rules:
No artificial sweeteners
No seed oils
Low added sugar

[brand]

Alternate Compare card:

WHICH ONE WON?
Brand A 91% vs Brand B 63%
A fits my rules better

Creator-friendly assets should support:

* TikTok
* Instagram Stories
* Reels
* static posts
* saving to camera roll

Eventually generate short animated verdict reveals.

## 12. Killer Demo

The strongest V1 creator demo is not:

"AI scans ingredients."

That is becoming commoditised.

The demo is personalisation.

**Creative 1**

Creator: "I told this app exactly what I refuse to eat. Now let's scan the health-food aisle." Scan. Result. Reaction.

**Creative 2**

Two people. "My husband and I scanned the exact same protein bar." His phone: 94% MATCH. Her phone: 51% MATCH. "Same food. Totally different result."

**Creative 3**

"Which of these is actually better for me?" Scan A. Scan B. Winner reveal.

**Creative 4**

"Scanning everything marketed as healthy at Target."

**Creative 5**

"Three ingredients I've asked my phone to watch for so I don't have to."

The product should create a repeatable content format, not simply an app advertisement.

## 13. Verdict Philosophy

The app is a translator and rule checker, not a food morality system.

Never:

BAD FOOD · TOXIC · DANGEROUS · GUILT-FREE · SIN · NEVER EAT THIS

Instead:

Doesn't match one of your rules.
Something to know.
You asked us to flag this.
The label doesn't provide enough information.
Worth checking.
No conflicts found on this label.

This differentiation matters commercially as well as ethically.

The product should feel:

calm, intelligent, useful, non-judgmental

not:

fear-driven wellness TikTok

## 14. Ingredient Intelligence Layer

The defensible asset is not simply a table of 300 ingredients.

Build a structured ingredient intelligence graph.

For each ingredient:

**Identity**

* canonical name
* alternative spellings
* common names
* chemical names
* E-number where relevant
* localisation
* synonyms
* brand-specific terminology

**Classification**

Examples: sweetener, emulsifier, preservative, colour, oil, animal-derived, sugar, caffeine source, flavour system

**Relationships**

Example:

sunflower oil → vegetable oil → sunflower-derived → seed oil
gelatin → animal-derived → potential species uncertainty
E621 → MSG → monosodium glutamate

**User relevance**

Which profile rules may apply?

**Evidence**

* explanation
* authoritative source
* jurisdiction
* evidence strength
* last reviewed

**Uncertainty**

Examples:

* may be animal or plant derived
* umbrella term
* species not disclosed
* manufacturing source required
* insufficient label information

This graph becomes a compounding intellectual asset.

## 15. The Actual Data Moat

The moat should become:

1. **Ingredient ontology** — a structured map of what ingredients actually are.
2. **Alias graph** — every spelling, derivative, E-number and regional variation.
3. **Rules engine** — the mapping between ingredients and individual preferences.
4. **Evidence graph** — why something is flagged and what supports that classification.
5. **Real-world scan corpus** — photos of difficult ingredient labels across package shapes, fonts, countries, languages, lighting conditions, curved surfaces, reflective packaging.
6. **Failure corpus** — the labels the model originally misread. These are particularly valuable.
7. **Human evaluation dataset** — correct ingredient parses and verdict outcomes.
8. **Preference graph** — anonymised patterns around the kinds of rules consumers actually create.

Over time:

more scans → more edge cases → better parsing → better verdicts → greater trust

That is substantially stronger than "we have prompts competitors don't."

## 16. Trust as Product

Every verdict should be inspectable.

Tap any flag:

SUNFLOWER LECITHIN

Why you're seeing this
You asked us to flag ingredients derived from sunflower.

What it is
An emulsifier commonly used to help ingredients mix.

How sure are we?
High confidence.

Why it matters to your profile
Your custom rule includes sunflower-derived ingredients.

Source
[authoritative reference]

Allow users to tell the app:

This verdict looks wrong

Categories:

* ingredient missed
* ingredient misread
* incorrect classification
* incorrect rule match
* explanation inaccurate
* other

That feedback feeds the evaluation dataset.

## 17. Safety Architecture

Safety cannot be left to disclaimers.

It must shape the actual product.

**Rule 1 — Never certify allergen safety**

Allowed: Milk listed on label

Not allowed: Safe for dairy allergy

Absence of an ingredient from OCR is not proof of safety.

**Rule 2 — Separate uncertainty from absence**

Never say: No problem ingredients

Say: No conflicts found in the text we could identify.

If scan confidence is poor, prominently show that.

**Rule 3 — No diagnoses or health-outcome claims**

No: "Causes cancer." "Inflammatory." "Will damage your gut."

unless a tightly scoped, legally reviewed evidence framework genuinely supports the precise wording.

The cleaner default is: You asked us to flag this ingredient.

**Rule 4 — No universal morality score**

Compatibility is relative to the user's own profile.

**Rule 5 — Don't manufacture anxiety**

The product should explain uncertainty rather than fill uncertainty with warning symbols.

**Rule 6 — Health-related personal data deserves heightened protection**

Minimise collection. Make deletion simple. Avoid collecting information unnecessary to product functionality. Do not build advertising economics around sensitive profile attributes.

## 18. V1 Build

Target: approximately 2–4 weeks, provided scope remains narrow.

Build:

* **iOS app** — React Native / Expo. Camera-first.
* **Scan engine** — Photo → OCR / vision → structured ingredient extraction.
* **Normalisation layer** — Convert ingredients to canonical entries.
* **Rules engine** — User profile × ingredient graph.
* **Verdict UI** — match verdict, blockers, flags, uncertainty, explanations, confidence.
* **Onboarding** — Preset + natural-language rules.
* **Compare mode** — Scan two products and explain which better matches the profile.
* **Share engine** — Branded vertical social card.
* **History** — Recent scans.
* **Feedback** — "Something wrong?" review mechanism.
* **Paywall** — RevenueCat + Superwall.
* **Backend** — Supabase.
* **Ingredient graph V1** — Start with the highest-value ~300–500 ingredients, aliases and categories. Quality matters more than breadth.

## 19. Do Not Build in V1

No:

* Android
* calorie tracking
* macro tracking
* meal logging
* weight loss
* food diary
* barcode database
* social feed
* chatbot
* recipes
* personalised nutrition plans
* supermarket inventory integration
* restaurant database
* automatic substitute marketplace
* AI-generated "health claims"
* giant wellness dashboard

The magic must remain:

SCAN → VERDICT

## 20. Monetisation

Start by testing:

Weekly $5.99/week
Annual $59.99/year

The weekly price captures impulse-driven consumer acquisition. Annual creates materially better retention economics.

Do not assume weekly is ultimately the best pricing structure.

Test:

* $4.99 weekly
* $5.99 weekly
* $6.99 weekly
* annual-first paywall
* weekly-first paywall
* trial vs no trial
* 3 free scans vs immediate paywall

### Free experience

Initial hypothesis: 3 free scans

The user's first successful personalised verdict should occur before payment.

The product must create:

"Oh. That's useful."

before asking for money.

## 21. Subscription Value

The product cannot feel like something someone needs once.

Retention should emerge from:

**Saved rules** — They don't rebuild their dietary logic.
**Scan history** — Everything they've checked.
**Comparisons** — Repeated grocery decisions.
**Rule evolution** — "Add this to my avoid list."

**Household profiles later** — Me, Partner, Child. Then one product can be evaluated against multiple profiles. This could become an exceptionally strong retention feature.

Example:

Works for you ✓
Doesn't match Sam's profile ✕
Check for Mia ⚠️

## 22. Distribution Strategy

### Phase 0 — Validate the wedge before building

Create realistic product mock-ups.

Do not test: "Would you use an ingredient scanner?"

Test the distinctive behaviour.

Produce approximately 10–20 pieces of content across several creator accounts.

Hypothesis A — Personal rules create curiosity.
Hypothesis B — Two users getting different verdicts is compelling.
Hypothesis C — Compare mode creates repeatable content.
Hypothesis D — Users want to scan products themselves after watching.

Success is not just views.

Measure:

* shares
* saves
* comments asking what the app is
* profile clicks
* waitlist conversion
* people tagging friends
* repeatable performance across creatives

One 50K-view video caused by creator luck is weak validation.

Three different concepts creating genuine install intent is much stronger.

## 23. Creator Strategy

Start with approximately 20–40 nano and micro creators.

Target communities individually.

Do not market "one app to everyone."

Effectively market five different products using the same underlying engine.

Example creator messaging:

**Ingredient-conscious** — "I don't have to read 37 ingredients anymore."
**Vegan** — "This catches the weird animal-derived ingredients."
**Low sugar** — "I'm scanning the supposedly healthy aisle."
**Pregnancy** — "Things I want to double-check without Googling them individually."
**Parents** (later) — "Checking what I'm buying for the family."

Each community receives different creative despite using the same product.

## 24. Paid Acquisition

Paid ads come after organic evidence.

Workflow:

Create organically → identify winners → secure usage rights → whitelist / Spark → scale → produce variations around the winning hook

Never compensate for weak creative by increasing spend.

The product's economics depend on a substantial organic component.

## 25. Key Metrics

Do not optimise primarily for downloads.

Track:

**Acquisition** — view → App Store click; App Store page → install; organic vs paid installs; CPI; creator-specific CAC.

**Activation** — onboarding completion; first successful scan; time to first verdict; second scan within session; rule created.

**Product pull** — scans/user/week; Compare usage; share-card usage; scan history returns; new rule additions.

**Monetisation** — paywall view → trial; trial → paid; download → paid; monthly revenue per install; annual-plan selection.

**Retention** — D1; D7; D30; subscriber retention; scans per retained subscriber.

**Trust** — this category requires its own metric:

VERDICT DISPUTE RATE — percentage of scans users say are wrong.

Also monitor: OCR correction rate; uncertain-label rate; ingredient parsing errors; classification disputes.

A growth product with untrustworthy answers is not succeeding.

## 26. Validation Gates

Before building:

Proceed only if mock creative demonstrates genuine product intent.

Ideal signals:

* multiple videos with strong organic reach
* unusually high save/share behaviour
* comments asking for the app
* measurable waitlist conversion
* Compare format outperforming generic scanning content

Do not make a single arbitrary view threshold the only gate.

## 27. Post-Launch Kill Criteria

Assess aggressively around weeks 6–8.

Kill or materially reposition if:

* users scan once and rarely return
* personalised profiles do not meaningfully improve retention
* organic creator formats aren't repeatable
* paid CAC cannot plausibly pay back
* verdict corrections remain unacceptably high
* users don't trust the results
* subscription conversion remains weak after meaningful paywall testing
* the category becomes dominated by an incumbent before differentiated traction emerges

## 28. Scale Signals

Scale aggressively if:

* scan frequency is high
* Compare is frequently used
* users organically share verdicts
* creator videos reliably drive installs
* users create increasingly sophisticated custom rules
* paid creative produces acceptable payback
* verdict-dispute rates remain very low
* annual subscriptions begin becoming meaningful
* users describe the app to others without needing explanation

The ideal word-of-mouth sentence is:

"You tell it what you don't eat and then just scan stuff."

That is simple enough to spread.

## 29. Expansion

Expansion only after the core loop works.

**Phase 2 — Household profiles.** One scan. Multiple people's rules. Potentially a major retention driver.

**Phase 3 — Smart discovery.** Find one without this. A trustworthy product-search layer.

**Phase 4 — Supplements.** Additional structured intelligence: active ingredients, dosage, proprietary blends, evidence classification, duplicate ingredient detection. This likely becomes a separate mode because the evaluation system is materially different.

**Phase 5 — Menu mode.** Photograph menu. Check likely conflicts. Explicitly communicate when ingredients cannot be determined from menu text alone.

**Phase 6 — Internationalisation.** Ingredient aliases, labelling conventions and evidence sources by jurisdiction. This substantially strengthens the dataset moat.

**Phase 7 — Adjacent categories.** The underlying architecture can extend beyond food: skincare / INCI, cosmetics, household cleaning, pet food.

Same primitive:

Teach us your rules → photograph a label → receive a personalised evaluation.

This means the long-term company may be bigger than a food scanner. It can become the personal rules layer for consumer products.

## 30. Acquisition / Strategic Value

A successful product could be strategically valuable to: food-scanning platforms, nutrition apps, wellness subscription companies, grocery retailers, consumer-health platforms, shopping-discovery businesses, health-app consolidators, ingredient-data providers, commerce platforms.

The valuable acquisition asset would not be the camera UI.

It would be:

consumer profiles + ingredient graph + rules engine + labelled scan corpus + verdict evaluation dataset + distribution engine.

## 31. Competitive Defence

Assume competitors can copy: camera scanning, Claude/OpenAI integration, basic onboarding, weekly subscriptions, share cards, generic ingredient summaries.

Therefore never call those the moat.

Build around things that improve with usage: rules, data, evaluations, trust, distribution.

If a large incumbent adds camera scanning, the company should still have a reason to exist.

## 32. Product Personality

The app should not look medical. It should not look like MyFitnessPal. It should not look like a generic AI app. And it definitely should not look like fear-based wellness content.

Desired feeling:

smart friend in the supermarket

Visual personality:

* bold
* clean
* slightly playful
* high contrast
* excellent typography
* minimal screens
* confident visual verdicts
* warm rather than clinical

The hero interface should make the result understandable from arm's length.

## 33. The Core Product Principles

Every decision should be tested against six rules.

1. The camera is the homepage.
2. The user's rules determine the verdict.
3. AI reads. The rules engine decides.
4. Uncertainty must be visible.
5. Every scan should be shareable.
6. Never use fear where explanation will do.

## 34. The Growth Loop

The ideal loop is:

TikTok creator scans surprising product → viewer wants to test their own products → downloads app → creates personal rules → scans pantry / supermarket → gets surprising verdict → shares branded result → new viewer discovers app → repeat

Compare mode strengthens this further:

A vs B → winner → share → debate → scans

That is the loop the business ultimately needs.

## 35. Attempt-One Objective

The first goal is not $1.4M ARR.

The first goal is proving four things:

1. People care enough to scan.
2. Personalisation materially improves the value.
3. They return and scan repeatedly.
4. The behaviour produces content that attracts more users.

If those are true, monetisation can be optimised.

If they aren't, stop.

### Target

Aim for: $20k MRR with meaningful organic acquisition by approximately week 12.

That is the point at which there is enough evidence to consider substantially increasing investment.

## 36. Venture Objective

Long-term target: $120k/month — approximately $1.4M ARR.

But the operating philosophy remains:

The number is the prize. The experiment is the plan.

Attempt one does not need to become the final company.

If it fails quickly but produces working camera infrastructure, creator relationships, subscription/paywall infrastructure, acquisition learnings, rules-engine architecture and consumer-app expertise, those assets move into attempt two.

## 37. The Product in One Sentence

A camera-first app that learns exactly what ingredients you care about, checks any label against your personal rules in seconds, and tells you clearly what matches, what doesn't and why.

And the simplest consumer version:

Tell it what you don't eat. Then just scan stuff.
