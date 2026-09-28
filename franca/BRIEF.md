# Build Brief — Franca
### The design-led claim scanner for beautiful brands

**Status:** Draft v4 · September 2026 · greenfield build — ClaimKind has since been re-scoped into the same product; see §7b
**One-liner:** Say it beautifully — and legally.
**Internal north star:** The badge is the product. The scan is the funnel.

> *On the directory name.* This lived in `assay/` until the product had a name
> — §11 item 1 was open, and a folder called `claim-scanner` would quietly have
> become the name. An assay is the test of purity a hallmark is stamped on the
> strength of, which was the right shape for a codename. The name is **Franca**
> and the directory follows it.

---

## 1. What we are building

A self-serve, design-led scanner that checks the *language* of a brand's marketing claims — product pages, social ads, packaging copy — against real regulatory rules, and turns a passing result into a shareable trust asset: a **Claim Confidence Score** and a **"Claims Verified" badge** the brand displays on its PDP.

It is a fully greenfield build — new codebase, new engine, new brand. It shares no code with ClaimKind. What carried over is knowledge, not code: the founder's regulatory expertise and the *concepts* behind the existing rule corpus (which the founder owns and can reference freely when authoring the new rules). ClaimKind was re-scoped in September 2026 as a self-serve product for this same buyer, so the two are now one product; §7b says what that changes.

**Build stance (decided):** start from scratch, including the rule engine. Consequences accepted: the rule corpus must be authored fresh, so V1 launches with a deliberately narrow jurisdiction set rather than all six packs; in exchange, the codebase carries zero legacy architecture, the two products stay cleanly separable (each independently sellable, no shared-service entanglement), and the new engine can be designed scanner-first — built around claim taxonomy, scoring, and rewrites from day one instead of retrofitted onto a linting tool's shape.

**What it is not:** legal software, an audit tool, a fear product, or an ingredient scanner. It occupies the layer no one owns — the *words*, not the formulation.

## 2. Who it's for

The founder or marketer at an aesthetic DTC brand — beauty, skincare, wellness, supplements, clean-label food & bev — roughly $500k–$20m revenue, Shopify-native, taste-driven, no in-house legal.

Their real pain moments, in order of acuteness:
1. **Ad account disapproved/banned** on Meta or TikTok for claim language (revenue stops same day)
2. **Retailer onboarding** — Clean at Sephora, Credo, Ulta Conscious Beauty claim substantiation
3. **EU ECGT deadline — 27 September 2026** (fines up to 4% of turnover per member state)
4. Background dread: ACCC greenwashing suits, FTC substantiation letters, class-action firms

~~ClaimKind's buyer (compliance-minded, regulated, $1m–$50m supplement brands, sales-led, ~$1k/mo) stays untouched.~~ No longer true. The re-scoped ClaimKind sells self-serve to the founder or head of marketing at a $1m–$50m DTC brand with no in-house legal — this buyer, with a higher revenue ceiling. The top of that range (multi-market supplement brands, agencies) is the natural upper tier of one product, not a second product's buyer.

## 3. Positioning

**Territory:** claim confidence, not compliance. Enablement, not insurance.

The pitch sells three things in this order: **speed** (launch copy that clears review first time), **approval** (ads that don't get flagged, retailer forms that pass), and **social proof** (a badge that lifts conversion — precedent: Provenance proof points drove a 27% add-to-cart lift at Cult Beauty). Risk reduction is the rational backstop mentioned last, never the hook.

**Reference class:** Linear, Arc, Mercury, Vanta. Specifically the Vanta playbook — take a dreaded obligation and make completing it a marketable trust asset brands *show off*.

**Voice:** confident, warm, editorial. Never legal-scary, never wellness-fluffy. The brand should feel like something a Glossier-tier founder would screenshot.

**Visual direction (v1 hypothesis):** distinct from ClaimKind's "gazette meets terminal", which the merged product does not carry forward (§11 item 0). This one is gallery-grade — generous whitespace, one expressive serif, soft-neutral palette with a single confident accent, score rendered as a beautiful object (think Yuka's scan-result clarity meets Mercury's restraint). The scan result must be so good-looking that sharing it is the natural next move.

## 4. The product

### Free tier — the funnel
- Paste a URL (PDP or ad copy) → instant scan → **Claim Confidence Score** (0–100) with each flagged claim shown inline, the rule it trips, jurisdiction chips, and a suggested compliant rewrite
- Result page is shareable by design (OG image = the score card)
- No login to scan; email to save/export

### Paid — the subscription
- **Connect Shopify** → all PDPs scanned continuously; score per product + brand-level score
- **Ad copy checker** — paste or upload Meta/TikTok ad text pre-launch; flags language platforms and regulators reject (incl. "clinically proven"-class phrases requiring substantiation)
- **Packaging check** — upload label/pack copy (text first; OCR later)
- **Rewrite engine** — every flag comes with a compliant alternative that keeps the brand's voice
- **The badge** — embeddable "Claims Verified" PDP widget + score page (brand.scanner.com/theirname), live-linked so it's only displayable while monitoring is active (retention mechanic)
- **Change monitoring** — copy edits re-scanned automatically; drift alerts
- **Retailer packs** — map claims against Clean at Sephora / Credo / Ulta standards ("will this pass?")
- **Jurisdiction toggles** — AU, US, UK, EU (ECGT), CA/Quebec

### Explicitly out of V1
Ingredient/formulation analysis, competitor scanning as a user feature, agency/multi-brand seats, API, human legal review marketplace, image/video ad analysis.

## 5. The badge mechanic (core bet)

The badge is what makes this covetable rather than dreaded, and it's the thesis to validate hardest:
- Badge displays score + "verified [month year]" + link to a public score page listing what was checked
- Live-linked: cancel and it greys out — the Vanta-style retention loop
- Instrument conversion: offer first-cohort brands a simple before/after add-to-cart read so we can eventually publish our own uplift number
- **Failing signal:** if first-cohort brands won't voluntarily display it, the covetable thesis is wrong — fall back to pure workflow value (ad checker + retailer packs) and rethink

## 6. Pricing

Billed via Shopify Billing API (required for App Store; also the lowest-friction wallet).

| Tier | Price | Includes |
|---|---|---|
| Scan | Free | URL scans, score, shareable result |
| Starter | **$49/mo** | Shopify sync ≤50 SKUs, 1 jurisdiction, badge, rewrites |
| Growth | **$99/mo** | ≤250 SKUs, 3 jurisdictions, ad copy checker, retailer packs |
| Studio | **$199/mo** | Unlimited SKUs, all jurisdictions, packaging checks, monitoring alerts, priority rescan |

Sits inside the established DTC app budget (Klaviyo $150–720/mo, Okendo $119–299/mo). No annual plans at launch. Reprice upward only after retention >90% with heavy usage. ~~ClaimKind stays ~$1k/mo sales-led.~~ The re-scoped ClaimKind prices the same shape — Free scan → $49 → $149 → $199 at MVP, then $599 multi-market monitoring and $1,500 brand house/agency. Those two upper tiers are where this table grows, not a separate product's price list.

## 7. Architecture

**The engine (new, scanner-first):**
- TypeScript rule engine designed around the scanner's needs from day one: claim taxonomy (efficacy, clean/free-from, environmental, clinical, sensory) as a first-class concept, deterministic rule evaluation, verdict output with named-rule citations, versioned rule packs, guidance-framed language built into the verdict shape (see §9)
- **Launch jurisdiction set (deliberately narrow): AU + US + EU (ECGT).** These cover the founder's home market, the largest DTC market, and the dated deadline driving the launch wedge. UK/ASA and Quebec follow post-launch as paid-tier expansions. Authoring order within packs: the rules that map to the wedge first — ECGT environmental claims, FTC substantiation/efficacy language, TGA/ACCC therapeutic and greenwashing claims
- Rules authored fresh, referencing the founder's own regulatory knowledge; no code imported from ClaimKind. This engine is now the starting point for the merged product (§7b), not a second engine alongside ClaimKind's
- LLM used for claim extraction (URL/text → claim strings) and rewrite generation; never for verdicts — evaluation stays deterministic and citable

**The app:**
- **App:** Next.js + Supabase + Stripe/Shopify Billing — standard stack
- **Shopify app:** embedded app, product read scope only at launch; App Store review compliance built in from day one (billing via Shopify API, no off-platform billing)
- **Scan pipeline:** URL fetch → claim extraction (LLM) → rule evaluation (deterministic engine) → verdict framing layer (see §9) → score computation → rewrite generation (LLM, rule-constrained)
- **Score:** deterministic and explainable — every point deduction traces to a named rule. No black-box scoring
- **Badge:** hosted JS embed + static fallback; score page server-rendered

## 7b. Relationship to ClaimKind

**Superseded 28 September 2026: the two are one product.**

Draft v3 said "none, by design": no shared code, no shared service, ClaimKind a sales-led ~$1k/mo product for a different buyer on its own clock, and each product independently sellable to a different acquirer. The ClaimKind venture brief of 28 September 2026 removes the ground that stood on. It re-scopes ClaimKind as a self-serve Shopify app for the same buyer (§2), at the same price points (§6), launched on the same EU deadline (§8), with a 0–100 score and a storefront badge worded almost as §9 words it (§5). Two products that close on the same founder with the same pitch are not two acquisitions — they are one product competing with itself for one person's attention.

So they merge. What that means in practice:

- **This engine is the starting point.** The ClaimKind brief budgets 4–6 weeks for an EU green-claims MVP on top of ClaimKind's rule packs. This codebase already scans AU, US and EU (ECGT) copy with cited findings, a deterministic score, the card, the badge, URL fetching and rewrites. What it lacks is the product around it — accounts, the Shopify app, billing, storage — which ClaimKind's MVP needed built anyway.
- **§7's verdict rule holds.** The ClaimKind brief has Sonnet return the verdict ("Judge") and labels claims *Prohibited*. This brief keeps verdicts deterministic and citable, and §9 forbids definitive verdicts. The ClaimKind brief concedes the reason itself — "pure LLM verdicts drift and can't be audited" — and the audit trail is the thing it says customers pay for. The model may *propose* a match on fuzzy language ("sleep like a baby") for a rule to confirm; it does not decide.
- **ClaimKind's corpus is an input, not an import.** Its AU/TGA, AU greenwashing, US/FTC, UK/ASA and EU packs are the fastest route to the UK pack §7 defers, and to depth in the three launch packs. Port rules through this engine's rule shape and the calibration set, one at a time, rather than bringing the lint engine along.
- **ClaimKind's later scope is this product's roadmap.** Per-market columns, ads and email surfaces, the evidence vault, approval workflow and audit log, the agency workspace: all of it sits on top of this engine, in roughly the order that brief gives.

What was given up: the clean two-acquirer story, and the hedge of two products on two clocks. ClaimKind's November kill criterion no longer has a separate product to judge; whether it carries over to the merged one is §11 item 0c.

## 8. Go-to-market

**Launch wedge (dated):** "Is your brand ready for 27 September?" — EU ECGT countdown as the campaign spine for any brand selling into the EU, paired with the evergreen ad-approval hook for everyone else.

Channels, in priority order:
1. **Free scan virality** — the shareable score card, seeded by inviting brands to scan *themselves* and post it. No public report-cards on named brands (see §9)
2. **Shopify App Store** — "free to install" listing; compliance-clean from submission one
3. **SEO/content** — "How to pass Clean at Sephora," "Words that get supplement ads banned on TikTok," "ECGT checklist for beauty brands." Enablement framing throughout
4. **Beauty founder media** — Beauty Independent, BeautyMatter, DTC X; pitch as the taste-led answer to a boring problem
5. **Agency/retailer later** — not launch-critical

## 9. Legal guardrails (non-negotiable)

- All outputs framed as **opinion + guidance**: "may be unsubstantiated," "likely to be flagged under [rule]" — never "this is illegal/non-compliant" as definitive verdict
- Persistent "not legal advice" disclaimer; T&Cs reviewed before launch
- **No public scanning or scoring of named third-party brands** as content marketing. The Yuka precedents (Goya suit; FICT — won on appeal but ~€500k in legal costs) make this a survivable-but-expensive game a solo founder doesn't play. Viral mechanic = self-scan + voluntary share only
- Users scan their own properties or public pages at their own initiation; we never publish results
- Badge language: "claims reviewed against [jurisdictions] on [date]" — descriptive, not warranty

## 10. Validation gate & kill criteria

Pre-build kill-test (2 weeks, can run before the engine exists):
- Hand-run 30 scans on real aesthetic brands' PDPs — manual analysis using the founder's own regulatory knowledge, presented as beautiful mock score cards; DM/email founders (over-index brands recently hit by ad disapprovals or in EU markets)
- **Proceed:** 8+/30 respond wanting the live product, or 3+ offer to pay on the spot
- **Kill/reshape:** polite silence → the pain isn't self-serve-acute; the sharpest surviving surface (likely ad checker) becomes the whole product. ~~Or the concept folds back into ClaimKind's funnel~~ — since ClaimKind is now this product, self-serve too, there is nothing separate to fold into. Silence is evidence against the self-serve premise both briefs share, and it goes to the merged product's decision, not around it

Post-launch checkpoints:
- Free-scan → paid conversion **≥3–5% by month 3**, else narrow to single surface
- Badge display rate among paying brands **≥50% by month 2**, else pivot messaging off the badge
- Month-6 bar: 75+ paying brands (~$6–8k MRR blended) with logo churn <5%/mo

## 11. Open decisions

0. ~~**One name, one identity.**~~ — resolved 2026-09-28: **Franca**, name and look. The merged product ships as Franca with the gallery-grade direction in §3; ClaimKind's name and "gazette meets terminal" retire. Chosen over ClaimKind's searchability because the badge and the share card are the bet (§5), and they need a name a brand is glad to display, not one that describes a compliance check. Cost accepted: App Store discovery leans on the listing's subtitle and keywords rather than the name. This makes Franca's availability checks (item 1) urgent; the first pass is recorded there and turned up one collision to rule out
0b. **Verdict states.** The ClaimKind brief uses Allowed / Allowed with substantiation / Needs qualifier / Prohibited per market. §9 rules out *Prohibited* as worded; the four-state shape is otherwise a candidate answer to item 2
0c. **Which clock.** ClaimKind had a November kill criterion; this brief has §10 and its post-launch checkpoints. Decide which one the merged product answers to, or state both, before either date arrives
1. ~~**Name**~~ — resolved 2026-08-18: **Franca**. *Lingua franca*, the common language. Chosen over the sparks below partly because it asserts nothing: the badge already says "Claims Verified", and *Vouch*, *Attest* and *Verily* would each have claimed truth a second time in the name. (Original direction: short, warm, confident; sparks *Vouch, Candor, Trueform, Attest, Clara, Verily*.) **Availability checks — first pass 2026-09-28, not yet a clearance.** Done from a sandbox that could resolve DNS and search the web but could not open any trademark register, registry or registrar, so everything below is a signal to confirm, not a result.
   - **Classes.** File in **9** (downloadable software, the Shopify app) and **42** (SaaS), possibly **35**. Not 3: that is cosmetics, which Franca does not sell. Class 3 matters only as the customers' class, for confusion with beauty brands called Franca.
   - **Domains taken** (they resolve): franca.com, franca.app, franca.ai, franca.co, franca.io, franca.eu, franca.co.uk, franca.shop, usefranca.com, francahq.com.
   - **Domains with no DNS** (probably free; confirm at a registrar): **franca.com.au**, getfranca.com, tryfranca.com, joinfranca.com, hellofranca.com, francascan.com, francaclaims.com, francaverified.com, franca.studio, franca.so. The short .com is gone, so the primary is likely getfranca.com with franca.com.au for the home market.
   - **Uses found, by risk:**
     - **High — Franca at franca.app**: an AI language-learning app. Same name, AI software, mobile app: the class 9 collision to rule out before anything else. Unknown whether it is registered.
     - **Low–medium — Franca AI (株式会社Franca AI), Japan**: AI business-planning services for SMEs; holds franca.ai. Matters only on expansion into Japan.
     - **Low — Franca Skin, Godoy Cruz, Argentina**: skincare, Instagram presence only. The customers' category, outside the launch markets.
     - **Low — Franca, the Eclipse interface-definition framework**: open-source software, long-standing, different field.
     - **Unrelated**: Franca NYC (ceramics), Franca Brasserie (restaurant, AU), MFRANCA and Franca Beauty Store (beauty retail), US cosmetics marks owned by Spa by Renata Franca (mark text not confirmed).
   - **Still to run:** USPTO (tmsearch.uspto.gov, FRANCA in 9 and 42, and any filing by the franca.app owner); EUIPO/TMview; IP Australia; UKIPO; registrar checks on franca.com.au and getfranca.com. Then a trademark lawyer's clearance before filing. Hold brand spend (badge design, item 4) until the USPTO search is back — if the franca.app owner holds FRANCA in class 9, item 0 reopens.
2. Score scale presentation (0–100 vs letter grade vs three-state)
3. ~~Launch jurisdiction set~~ — resolved in §7: AU + US + EU at launch, UK and Quebec as post-launch expansions
4. Badge visual system — needs its own mini design sprint
5. OCR packaging in V1 vs fast-follow

---

*Source: concept assessment, Aug 2026 — competitive gap (claims-language layer unserved), regulatory timing (ECGT 27 Sept 2026, ACCC/FTC/TGA enforcement), pricing benchmarks (Klaviyo/Okendo/Shopify norms), Vanta badge playbook, Yuka legal precedents.*
