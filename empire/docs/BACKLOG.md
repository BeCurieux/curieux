# Prioritised backlog

## Now — before charging (from `QA-REPORT.md`)

1. Provision Supabase (Pro), custom SMTP, run migrations and the RLS suite
   on a Supabase branch.
2. Preview deployment with Claude; generate every module for 3–5 real
   profiles; tune prompts and effort; check cost in `/admin`.
3. Try the Sidekick pack in two real themes; fix prompt wording.
4. Gumroad: create the Launch Pack, licence keys, ping, resource
   subscriptions, access token; real purchase and refund test.
5. Legal review of terms, privacy and refund wording.

## Next — conversions, in the addendum's order

Done in this release: **FIT Finder** (1), brand identity and HLE methods for five generators, partial methods for the Brand Blueprint (2) and store brief (3), hooks imported (6). Next:

1. **Vee's decisions** from `content/REGISTER.md` §3 (free vs gated FIT Finder, unused quiz answers, promise formula, pricing rules, the "lawyer" referrals, missing products).
2. **Go/No-Go Scorecard with the full criteria** — port the workbook's scorecard formula and its 20 audit checks as tests (`content/audit/fit-kit-methods.md` §a, §c).
3. **Brand Blueprint gaps** — Vee writes how to choose an accent colour and a voice rubric; then mark the method `source`.
4. **Shopify launch workflow** — no Business Starter System exists; write a Shopify method (theme brief and Sidekick prompts) in HLE's voice.
5. **Pricing calculator** from Price It Right (floor = hours × minimum hourly return + costs + fees; market low/mid/high rules), with tests from its worked example ($35 × 8 h → $280 floor); add Little Offer Kit's digital-product tiers and the Gumroad fee formula (7 → 5.80, 12 → 10.30, 19 → 16.60, 27 → 23.80).
6. **Money tracker** from Side Income Money System (A–E set-aside formula; threshold watch at 75%; user-chosen set-aside %, never suggested).
7. **Hook library page** — searchable by goal, placeholders highlighted, "tried / result" per user; gated to 100 Faceless Hooks owners.
8. **Content Studio calendar** from the 30-Day Plan (editable, saved).

## Phase C — commercial validation

Recruit 5–10 Shopify sellers. Watch: do they understand the value, use the
assets (copy/download/export rates in `/admin`), get the Sidekick prompts
working, finish setup, and would they pay again? What do they still do by
hand? Decide the next build from that.

## Later (only with evidence)

- Image generation with explicit action, limits, preview, disclosure and
  cost tracking (brief §7, later).
- Bulk product generation.
- Studio subscription; then Etsy Studio (`ETSY-STUDIO.md`); then Shopify
  OAuth drafts (`SHOPIFY-INTEGRATION.md`).
- Sentry error reporting (the sibling apps use it) once there is traffic.
