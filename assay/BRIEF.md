# Build Brief — Franca
### The design-led claim scanner for beautiful brands

**Status:** Draft v3 · August 2026 · greenfield build — fully independent of ClaimKind
**One-liner:** Say it beautifully — and legally.
**Internal north star:** The badge is the product. The scan is the funnel.

> *On the directory name.* This lives in `assay/` because the product has no
> name yet (§11, open decision 1) and a folder called `claim-scanner` would
> quietly become the name. An assay is the test of purity that a hallmark is
> stamped on the strength of, which is the shape of this product — but it is a
> codename, not a candidate. Nothing customer-facing uses it.

---

## 1. What we are building

A self-serve, design-led scanner that checks the *language* of a brand's marketing claims — product pages, social ads, packaging copy — against real regulatory rules, and turns a passing result into a shareable trust asset: a **Claim Confidence Score** and a **"Claims Verified" badge** the brand displays on its PDP.

It is a fully greenfield build — new codebase, new engine, new brand. It shares no code with ClaimKind, which continues untouched as a separate product. What carries over is knowledge, not code: the founder's regulatory expertise and the *concepts* behind the existing rule corpus (which the founder owns and can reference freely when authoring the new rules).

**Build stance (decided):** start from scratch, including the rule engine. Consequences accepted: the rule corpus must be authored fresh, so V1 launches with a deliberately narrow jurisdiction set rather than all six packs; in exchange, the codebase carries zero legacy architecture, the two products stay cleanly separable (each independently sellable, no shared-service entanglement), and the new engine can be designed scanner-first — built around claim taxonomy, scoring, and rewrites from day one instead of retrofitted onto a linting tool's shape.

**What it is not:** legal software, an audit tool, a fear product, an ingredient scanner, or a lighter-priced version of ClaimKind. It occupies the layer no one owns — the *words*, not the formulation.

## 2. Who it's for

The founder or marketer at an aesthetic DTC brand — beauty, skincare, wellness, supplements, clean-label food & bev — roughly $500k–$20m revenue, Shopify-native, taste-driven, no in-house legal.

Their real pain moments, in order of acuteness:
1. **Ad account disapproved/banned** on Meta or TikTok for claim language (revenue stops same day)
2. **Retailer onboarding** — Clean at Sephora, Credo, Ulta Conscious Beauty claim substantiation
3. **EU ECGT deadline — 27 September 2026** (fines up to 4% of turnover per member state)
4. Background dread: ACCC greenwashing suits, FTC substantiation letters, class-action firms

ClaimKind's buyer (compliance-minded, regulated, $1m–$50m supplement brands, sales-led, ~$1k/mo) stays untouched. This buyer never wanted that product; that buyer will never accept this one's ceiling. Natural upgrade path exists but is not marketed at launch.

## 3. Positioning

**Territory:** claim confidence, not compliance. Enablement, not insurance.

The pitch sells three things in this order: **speed** (launch copy that clears review first time), **approval** (ads that don't get flagged, retailer forms that pass), and **social proof** (a badge that lifts conversion — precedent: Provenance proof points drove a 27% add-to-cart lift at Cult Beauty). Risk reduction is the rational backstop mentioned last, never the hook.

**Reference class:** Linear, Arc, Mercury, Vanta. Specifically the Vanta playbook — take a dreaded obligation and make completing it a marketable trust asset brands *show off*.

**Voice:** confident, warm, editorial. Never legal-scary, never wellness-fluffy. The brand should feel like something a Glossier-tier founder would screenshot.

**Visual direction (v1 hypothesis):** distinct from ClaimKind's "gazette meets terminal." This one is gallery-grade — generous whitespace, one expressive serif, soft-neutral palette with a single confident accent, score rendered as a beautiful object (think Yuka's scan-result clarity meets Mercury's restraint). The scan result must be so good-looking that sharing it is the natural next move.

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

Sits inside the established DTC app budget (Klaviyo $150–720/mo, Okendo $119–299/mo). No annual plans at launch. Reprice upward only after retention >90% with heavy usage. ClaimKind stays ~$1k/mo sales-led; upgrade conversations happen only when a customer's own scale forces it.

## 7. Architecture

**The engine (new, scanner-first):**
- TypeScript rule engine designed around the scanner's needs from day one: claim taxonomy (efficacy, clean/free-from, environmental, clinical, sensory) as a first-class concept, deterministic rule evaluation, verdict output with named-rule citations, versioned rule packs, guidance-framed language built into the verdict shape (see §9)
- **Launch jurisdiction set (deliberately narrow): AU + US + EU (ECGT).** These cover the founder's home market, the largest DTC market, and the dated deadline driving the launch wedge. UK/ASA and Quebec follow post-launch as paid-tier expansions. Authoring order within packs: the rules that map to the wedge first — ECGT environmental claims, FTC substantiation/efficacy language, TGA/ACCC therapeutic and greenwashing claims
- Rules authored fresh, referencing the founder's own regulatory knowledge; no code imported from ClaimKind
- LLM used for claim extraction (URL/text → claim strings) and rewrite generation; never for verdicts — evaluation stays deterministic and citable

**The app:**
- **App:** Next.js + Supabase + Stripe/Shopify Billing — standard stack
- **Shopify app:** embedded app, product read scope only at launch; App Store review compliance built in from day one (billing via Shopify API, no off-platform billing)
- **Scan pipeline:** URL fetch → claim extraction (LLM) → rule evaluation (deterministic engine) → verdict framing layer (see §9) → score computation → rewrite generation (LLM, rule-constrained)
- **Score:** deterministic and explainable — every point deduction traces to a named rule. No black-box scoring
- **Badge:** hosted JS embed + static fallback; score page server-rendered

## 7b. Relationship to ClaimKind

None, by design. No shared code, no shared service, no cross-mentions in any customer-facing surface. ClaimKind continues as its own product on its own clock (its November kill criterion stands independently). The only bridge is the founder: regulatory knowledge flows into the new rule corpus as it's authored, and if a scanner customer someday outgrows self-serve, an introduction to ClaimKind is a conversation, not a product integration.

What this buys: each product is independently sellable to a different acquirer with clean IP; neither codebase constrains the other; and the scanner's engine is shaped by the scanner's needs alone. What it costs: rule coverage is rebuilt rather than inherited, which is the primary driver of the narrowed launch jurisdiction set in §7 and the sequencing in §10.

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
- **Kill/reshape:** polite silence → the pain isn't self-serve-acute; the sharpest surviving surface (likely ad checker) becomes the whole product or the concept folds back into ClaimKind's funnel

Post-launch checkpoints:
- Free-scan → paid conversion **≥3–5% by month 3**, else narrow to single surface
- Badge display rate among paying brands **≥50% by month 2**, else pivot messaging off the badge
- Month-6 bar: 75+ paying brands (~$6–8k MRR blended) with logo churn <5%/mo

## 11. Open decisions

0. **Founder attention split.** ClaimKind's funnel and kill-clock run independently — but a solo founder authoring a fresh rule corpus while running a PLG launch has no spare capacity. Decide how much (if any) active ClaimKind outreach continues during the scanner build, or whether its November kill criterion simply adjudicates it
1. ~~**Name**~~ — resolved 2026-08-18: **Franca**. *Lingua franca*, the common language. Chosen over the sparks below partly because it asserts nothing: the badge already says "Claims Verified", and *Vouch*, *Attest* and *Verily* would each have claimed truth a second time in the name. (Original direction: short, warm, confident; sparks *Vouch, Candor, Trueform, Attest, Clara, Verily*.) **Availability checks — domain and trademark classes 3, 9 and 42 — are still outstanding.**
2. Score scale presentation (0–100 vs letter grade vs three-state)
3. ~~Launch jurisdiction set~~ — resolved in §7: AU + US + EU at launch, UK and Quebec as post-launch expansions
4. Badge visual system — needs its own mini design sprint
5. OCR packaging in V1 vs fast-follow

---

*Source: concept assessment, Aug 2026 — competitive gap (claims-language layer unserved), regulatory timing (ECGT 27 Sept 2026, ACCC/FTC/TGA enforcement), pricing benchmarks (Klaviyo/Okendo/Shopify norms), Vanta badge playbook, Yuka legal precedents.*
