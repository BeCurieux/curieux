# Product Brief: AI Ingredient Decoder — Consumer Verdict App

Recorded 2026-08-16, as given. This file is the brief, unedited. Where later
work disagrees with it, the disagreement is recorded at the end of `CLAUDE.md`
rather than resolved by quietly rewriting this file.

*Working name: Ingrid · US-first · attempt one of a planned two-to-three*

## 1. The Opportunity

Build a consumer mobile app that gives an instant, personalised verdict on any ingredient list from a photo.

Point the camera at a snack packet, supplement tub, sauce jar, or restaurant menu. Get back:

A 0–100 score for YOUR profile, the flagged ingredients in plain English, and a better alternative.

It is not a barcode database, a food-logging app, or a nutrition tracker.

The core proposition is:

"Is this bad for me?" — answered in three seconds, for you specifically.

The business model is the proven consumer verdict-app playbook (Cal AI, Umax, RizzGPT): one narrow job, camera in, verdict out, $4.99–6.99/week subscription, distributed through seeded TikTok/IG creators and then paid ads behind proven creative.

Target: ~$120k/month (~$1.4M ARR), solo and bootstrapped, understanding that this is a top-percentile outcome pursued through a fast, kill-early process — not a plannable milestone.

## 2. Why Now

* The demand is proven at massive scale by an incumbent with a structural blind spot. Yuka has 80M+ users (22M in the US, its fastest-growing market) — but it is barcode-bound. It cannot read a restaurant menu, an imported product, a market-stall label, a supplement sold on TikTok, or anything unpackaged. AI vision reads raw text anywhere. The gap is the product.
* Consumer AI apps are the highest-velocity category in mobile. AI-app in-app-purchase revenue passed $4B in H1 2026 (+36% half-on-half); generative AI is projected to exceed $10B in consumer spend in 2026. Health & Fitness is the top revenue-per-install category in RevenueCat's 115,000-app benchmark.
* Clean-label culture is a durable content engine, not a meme. "What I eat in a day," seed-oil discourse, additive callouts, allergy-parent content, and label-reading videos are permanent TikTok genres. The app turns an existing content format into a product demo.
* The scan moment is daily. Groceries, pantry, snacks, menus, supplements. Frequency is the strongest churn defence available to a verdict app.

## 3. Working Concept and Name

Working name: Ingrid (from ingredients — warm, personal, two syllables; the app has a voice, not a database).

Alternates to sweep: LabelLens, Peeled, Decoder. Run the standard collision/trademark sweep before committing — "Ingrid" will need checking against existing app-store and class 9/42 marks.

Positioning line:

Point. Scan. Know.

Or, for creators:

The app that reads the label so you don't have to.

## 4. The User

### Primary ICP (US-first)

Not "everyone who eats." Launch niches, in creator-seeding priority order:

1. Allergy and intolerance households — parents checking everything; highest stakes, highest gratitude, strongest word-of-mouth. (See §10 for the hard safety rule this segment requires.)
2. Clean-label / additive-avoiders — seed-oil avoiders, "no numbers I can't pronounce," ultra-processed-food avoiders.
3. Pregnancy — a defined list of avoid-ingredients, a defined time window, extremely motivated.
4. Diet-protocol followers — keto, carnivore, low-FODMAP, vegan (hidden animal ingredients).
5. Supplement buyers — decoding proprietary blends and dosages on TikTok-sold products.

Each niche = a distinct onboarding profile AND a distinct creator community for seeding. The product is one app; the marketing is five apps.

### Geography

US market only for launch (two-thirds of all AI-app consumer spend; required for the creator playbook). Australia is a fast-follow, not the launch market.

## 5. The Problem

The person in the supermarket aisle holding a product can currently:

* read a 40-ingredient list in 4-point font and understand none of it
* google individual ingredients one at a time
* use Yuka — if the product has a barcode in its database, and accept a generic score that knows nothing about them
* give up and buy it

Nobody stands in an aisle doing ingredient research. The moment lasts five seconds. The answer has to arrive inside the moment, and it has to be about them — a generic 61/100 means nothing to a pregnant woman, a peanut-allergy parent, and a carnivore, who need three different answers about the same product.

## 6. The Product

### Core loop

1. **Scan** — camera opens on launch. Photograph any ingredient list or menu.
2. **Verdict** — within ~3 seconds:

   34/100 for you
   🔴 Contains: sunflower lecithin — flagged because your profile avoids seed oils
   🟠 "Natural flavours" — umbrella term; can't verify contents from the label
   🟡 Maltodextrin — high-GI filler, fine occasionally
   ✅ Everything else checks out
   Better pick: [comparable product with cleaner list]

3. **Share** — one tap renders the verdict as a branded share card (score, product photo, flags). Using the app produces content. This is a growth feature, not a nicety — it is the single most important screen in the app.

### Profile (set once at onboarding)

A 60-second quiz: allergies/intolerances, avoidances (seed oils, artificial sweeteners, added sugar, specific additives), life stage (pregnancy, feeding young kids), diet protocol. The quiz doubles as the paywall warm-up — investment before the ask.

### The verdict architecture

Every flag follows the same structure — ingredient → why it's flagged for YOUR profile → confidence → plain-English explanation → source. Never a bare "bad." Never a diagnosis. Where the model can't verify (umbrella terms, illegible text), it says so. Trust is the entire product; one confidently-wrong viral screenshot is the kill scenario.

## 7. The Killer Demo (and the creator format)

The 15-second TikTok that sells the app:

Creator holds up a product marketed as healthy. "This says 'all natural.' Let's see what Ingrid thinks." — scan — beat — "27/100. Oh no." — zooms into the flagged ingredients, reads them out.

The format already exists on TikTok without the app (creators reading labels aloud). The app makes the existing format faster, more dramatic, and reproducible by anyone — which is exactly the property that made Cal AI and Umax spread.

Secondary formats: "scanning everything in my pantry," "scanning the 'healthy' aisle at Target," pregnancy grocery hauls, allergy-mum restaurant checks.

## 8. Monetisation

* Hard paywall after 3 free scans (hard paywalls convert at a 10.7% median Day-35 trial-to-paid vs 2.1% freemium; $3.09 revenue-per-install at D60 vs $0.38).
* $5.99/week headline (≈$26/month), with an annual offer (~$59.99) pushed at the moment of highest belief — right after a verdict that visibly mattered. Longer trials (2–4 weeks) convert dramatically better (42.5% vs 25.5% for short trials); test trial length from day one.
* Web checkout (Stripe) for US users alongside IAP — permitted post-Epic, preserves ~25+ points of margin, and gives ownership of the customer relationship. Note: the 0% external-link window is litigated and Apple has proposed 5–15% fees; treat the margin advantage as temporary upside, not a plan assumption. Web checkout also means handling US sales tax (Stripe Tax).
* Margins: OCR + text inference is the cheapest verdict on the shortlist — no image generation. Target >75% gross margin net of store fees and inference.

### The $120k/month math (stated honestly)

$120k/mo at ~$26/mo ≈ 4,600 active subscribers net of churn. At the category's brutal base rates (~72% year-one annual-plan cancellation; only 4.6% of new apps ever reach $10k/mo), holding 4,600 subs means a permanent acquisition treadmill: at a 3% download-to-paid rate, replacing churn plus growing requires tens of thousands of downloads per month, which organic creator content must substantially carry — paid alone at ~$3–4.70 CPI doesn't pencil. The bet is that the share-card loop plus creator seeding produces organic volume; if it doesn't, the target isn't reachable and the kill criteria (§12) apply.

## 9. Distribution Playbook

### Phase 0 — Fake-door validation (weeks 1–2, before building)

Three seeded TikToks using a mocked result screen. Gate: at least one video past ~50K views with strong save/share ratios. No pull, no build.

### Phase 1 — Creator seeding (launch)

20–40 nano/micro creators (1K–100K followers) across the five ICP niches. 2026 rates: nano $25–200/video, micro $150–1,500; Spark Ads/whitelisting rights +20–50%. Identify the 2–3 winning creatives.

### Phase 2 — Paid behind proven creative

Whitelist winners as Spark Ads; scale spend only behind creative with demonstrated organic pull. Spark/UGC ads run 40–60% better CPA than brand creative.

### The Australian gotcha (solve in week 1, in parallel)

An AU-registered self-serve TikTok Ads Manager account cannot target the US — US/UK targeting requires a managed account in Australia. Options: (a) a TikTok Marketing Partner/agency account (fastest); (b) a US LLC holding the ad account (more control, more admin). Do not use location workarounds; accounts get banned. This is a launch blocker if left late.

## 10. Safety, Claims and Ethics Guardrails (non-negotiable)

This is where the founder's regulated-marketing background is the moat — most teams building this app would get these wrong.

1. **Never certify safety for allergen sufferers.** The app flags ingredients to check; it never says "safe for your peanut allergy." Labels can be wrong, OCR can miss, cross-contamination isn't on the label. Verdict language for allergy profiles is always "flagged / not flagged on this label — always verify the packaging." A missed allergen with a "safe" verdict is a harmed child and the end of the company. This rule shapes copy, UX, and marketing from day one.
2. **No medical or diagnostic claims, anywhere.** Scores are lifestyle guidance, not health outcomes. No disease names in verdicts ("linked to cancer" is both an App Store rejection and an FTC problem). Every flag cites its reasoning at the level of "your profile avoids X" or "commonly avoided because Y," with sources.
3. **Inform, don't farm anxiety.** There is a version of this app that grows faster by making users afraid of every label. It is the wrong product, it is brand-fatal when the backlash piece gets written, and it drifts toward disordered-eating territory. Design rules: scores compare within category (a biscuit is scored as a biscuit, not against broccoli); every red flag comes with a better pick, not just a warning; copy never moralises food or people ("cleaner option," never "guilt-free" / "sinful"). The app is a translator, not a judge.
4. **Not a weight-loss or restriction tool.** No calorie framing, no "should you eat this" language. That's a different (crowded, and riskier) product.
5. **Standard:** clear ToS, no-medical-advice disclaimer, and product-liability-appropriate insurance before US launch.

## 11. V1 Build Scope

Build (target: ~2–3 weeks):

* iOS app (React Native/Expo), camera-first UI
* Vision pipeline: photo → OCR/parse (Claude vision) → structured ingredient list → verdict engine (ingredient knowledge base × user profile) → scored result
* Onboarding profile quiz (5 niches)
* Hard paywall: RevenueCat + Superwall (paywall A/B from day one), Stripe web checkout for US
* Share-card generator (branded verdict image/video snippet)
* Ingredient knowledge base v1: the ~300 most-flagged additives/ingredients with plain-English explainers, sourced and reviewed — this is founder work and the beginning of the data moat
* Supabase backend; scan history

Do NOT build in V1:

* Android (fast-follow only if iOS pulls)
* Barcode scanning or packaged-product database
* Food logging, diaries, streaks-as-guilt mechanics
* Chat interface
* Personalised nutrition plans (medical-adjacent; never without review)
* Social feed

## 12. Validation Gates and Kill Criteria

Proceed to build only if Phase 0 fake-door clears (≥1 video ≥50K views, strong saves/shares).

Post-launch, evaluate at week 6–8:

* **Kill or overhaul if:** Day-35 trial-to-paid <8% on a hard paywall; blended CAC payback >90 days; no organic creative repeatably clearing 50K views; or verdict-accuracy complaints dominating reviews.
* **Scale hard if:** any creative sustains sub-$3 US CPI with >8% trial-to-paid; organic share-card loop visibly generating installs.
* **Structural kill signal:** Yuka ships photo-vision with personalisation before the app reaches escape velocity — at that point pivot to the niches vision-Yuka won't serve (supplements deep-dive, menus, allergy-first) or kill.

This is attempt one of a planned two-to-three-attempt process. The playbook's honest base rate is that most attempts die; the discipline is dying in week 8, not month 8.

## 13. Moat (what compounds if it works)

* **Personal profiles** — switching cost grows with every avoidance and every scan.
* **Ingredient knowledge graph** — additive → plain-English explanation → profile-relevance → source. Founder-authored, model-agnostic, and exactly the asset a strategic buyer can't prompt into existence.
* **The unpackaged corpus** — menus, market stalls, imported and TikTok-sold products that no barcode database covers.
* **Verdict evaluation dataset** — human-reviewed scans (correct parses, OCR failures, edge cases) that makes the product measurably more accurate than a raw model call.
* **Creator network** — the retained seeding roster is reusable across future apps (the portfolio asset).

## 14. Expansion (later, not now)

Supplements deep-dive tier (proprietary blends, dosages vs. evidence) → restaurant menu mode → skincare/household INCI lists (adjacent scan, same engine, and familiar territory) → pet food. Strategic acquirer shapes: the MyFitnessPal-style consolidator (exactly what happened to Cal AI), a Yuka competitor, retail/health platforms wanting a scan layer.

## 15. Core Goal

**Attempt 1 objective:** clear the validation gates and reach $20k MRR with organic pull by week ~12 — the threshold at which the playbook says pour everything in.

**Venture objective:** $120k/month. Reached by scaling this attempt if it hits, or by recycling the creator network, codebase skeleton, and lessons into attempt two if it doesn't.

The uncomfortable truth, kept in view deliberately: this is a ~top-1% outcome being pursued with a repeatable process, a genuine distribution edge (DTC content instinct + regulated-claims knowledge), and pre-committed kill criteria. The process is the plan; the number is the prize.
