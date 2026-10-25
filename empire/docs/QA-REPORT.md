# Pre-launch QA report

**Date:** 2026-10-22 (updated after the Her Little Empire content audit) · **Build:** branch `claude/exciting-ritchie-eayswn`

**Verdict:** ready for a **private test with real Shopify sellers on the
mock generator or a capped AI budget**. **Not yet ready to take money:** the items under "Not yet verified" need a real run first, and Vee's remaining open items in `content/REGISTER.md` §3 need answers.

## Verified automatically

| Area (brief §16)                          | How                                                                                                                                                         | Result                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Customer data isolation                   | `npm run test:rls` on Postgres 16 (stub Supabase auth); local-backend isolation unit test; e2e cross-account 404 + export 404                               | Pass. Mutation check: weakening the "save own edits" policy makes the suite fail. |
| Authentication                            | e2e: signed-out redirect; sign-in; local cookie tamper/expiry unit tests                                                                                    | Pass (local backend).                                                             |
| Profile saving, version history           | unit (versions, no overwrite) + RLS (version bump, history read-only) + e2e                                                                                 | Pass                                                                              |
| Incomplete onboarding                     | step-by-step validation in the browser; server re-validates; errors jump to the right step; answers aren't wiped                                            | Pass (manual + e2e path)                                                          |
| AI generation accuracy / hallucinations   | every module's offline output validated against its schema and run through the claims guard (physical and digital, sparse profile)                          | Pass — no invented claims                                                         |
| Missing product data                      | listing flags missing dimensions, shipping, care; never prints them                                                                                         | Pass                                                                              |
| Harmful / injected instructions           | prompt keeps customer text inside an escaped JSON block; guard tests; income claims always flagged                                                          | Pass                                                                              |
| Failed generations                        | malformed output rejected and not charged; provider errors shown without internals; timeout aborts and reports                                              | Pass (one real bug fixed: abort raced the timeout message)                        |
| Usage limits                              | free/pack allowance, hourly limit, platform daily ceiling, library purchases don't unlock software                                                          | Pass                                                                              |
| Copy to clipboard                         | e2e reads the clipboard after "Copy prompt"                                                                                                                 | Pass                                                                              |
| Edit → save → restore                     | e2e: edit, save as v2, reload, restore v1 as v3                                                                                                             | Pass                                                                              |
| Export downloads                          | unit: ZIP contents; e2e: ZIP downloads with the right name                                                                                                  | Pass                                                                              |
| Payment verification, duplicates, refunds | unit with a fake Gumroad: forged pings, borrowed licence keys, signed refs, concurrent duplicate pings, refund via recheck, cross-account claim             | Pass                                                                              |
| Secure uploads                            | unit: byte sniffing, size, path ownership                                                                                                                   | Pass                                                                              |
| Data deletion                             | unit: account delete removes data, detaches purchase                                                                                                        | Pass                                                                              |
| Mobile layouts                            | full e2e suite at 390 px                                                                                                                                    | Pass                                                                              |
| Screen readers / keyboard                 | axe (serious + critical) on landing, pricing, sign-in and studio at both widths; labelled fields, skip link, focus rings, live regions for copy/save status | Pass (two real issues fixed: a card background hiding text, a link name mismatch) |
| Build, lint, types, format                | `next build`, ESLint, `tsc`, Prettier                                                                                                                       | Pass                                                                              |

Totals: 69 unit tests, the RLS suite, 16 Playwright tests (8 × desktop and phone).

## Added after the content audit

| Area                 | How                                                                                                                                                                                        | Result                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FIT Finder scoring   | The shipped v1.4 JavaScript run beside the TypeScript port on 5,000 random answer sets, scoring the data embedded in the shipped report                                                    | Identical scores, bands and reasons; identical top threes with no stated preference, ties only reordered by preference                                                                              |
| Corrected report     | The patched Income Fit Report's engine and calculator (content/corrections/report.patch) run beside the app: 5,000 answer sets and 2,000 calculator inputs, including her own unpaid hours | Identical top threes and calculator numbers; patched report opens in Chromium with no script errors                                                                                                 |
| FIT Finder flow      | Playwright, desktop and 390 px: quiz → free top three (one line each) for non-owners; quiz → full report → calculator → tick a day → reload, all saved                                     | Pass. Three real bugs fixed on the way: saved answers failed re-validation (404), the calculator and plan overwrote each other's progress, and a reload within the save delay lost calculator input |
| FIT Finder isolation | RLS suite: another customer's results can't be read, changed or created; deleted with the account                                                                                          | Pass                                                                                                                                                                                                |
| Bundles              | Owning a bundle unlocks its contents (Empire Bundle → FIT Finder); library purchases never unlock the Launch Pack                                                                          | Pass                                                                                                                                                                                                |
| House rules          | Guard always flags PLR/MRR, MLM recruiting and the former trading name; exact refund sentence from one constant everywhere; seller details on every page                                   | Pass                                                                                                                                                                                                |
| Generator methods    | Offline outputs in the HLE methods still validate and pass the claims guard (physical and digital, sparse profile); 100 hooks verified word for word                                       | Pass                                                                                                                                                                                                |
| Brand                | Your colour tokens and font files; contrast measured (rose kept to large text)                                                                                                             | Pass                                                                                                                                                                                                |

## Not yet verified — do these before charging

1. **A real Supabase project.** Apply both migrations, run the RLS suite
   against a Supabase branch, sign in by emailed link, upload a photo, delete
   an account (storage cleanup included). The Supabase repository code is
   typechecked but has not run against a live project in this session.
2. **Real Claude output.** Set `EMPIRE_AI_PROVIDER=anthropic` on a preview
   deployment and generate every module for 3–5 real profiles. Check schema
   pass rate, guard warnings, tone, and actual cost per generation in
   `/admin`. Tune `EMPIRE_AI_EFFORT` and prompts from what you see.
3. **Sidekick prompts in real themes.** Try the pack in Dawn and one other
   free theme on a development store; record which prompts Sidekick can
   carry out and adjust wording (brief Phase C).
4. **A real Gumroad purchase and refund** on a test account, end to end,
   including the ping, the license key path and the daily recheck.
5. **Legal review** of the terms, privacy policy and refund wording for the
   countries you sell to; add an AI-provider line to the privacy policy
   reviewed by a lawyer.
6. **Manual screen-reader pass** (VoiceOver on iPhone, NVDA on Windows) of
   onboarding and the editor — axe doesn't catch everything.
7. **Accessibility of long editors on mobile**: the Brand Blueprint editor
   is long at 390 px; watch real users and consider collapsing sections.

## Known limitations

- The local backend is single-process and rewrites one file per change —
  development and demos only (refused in production).
- In Next's streamed rendering, a not-found inside a studio layout can
  return HTTP 200 with the 404 page; no data is rendered.
- Image generation, Shopify OAuth and social publishing are intentionally
  not built (brief: later phases).
- Generator methods: five use Her Little Empire's own methods; the Brand
  Blueprint and store brief are partial; Sidekick prompts are interim (no HLE
  Shopify method exists).
