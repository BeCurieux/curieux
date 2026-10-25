# Brand and content handover

**Prepared 23 October 2026.** Sources:

- the founder's brand files as audited (`03_brand/visual-identity.html`, `PRINT_STYLE.md`, fonts; summarised in `content/register.json` → `brand-system`);
- her decisions (`content/REGISTER.md` §3, `content/CORRECTIONS.md`);
- what's implemented in Empire Studio.

**The brand files themselves aren't committed** to the repository (by design: `content/source/README.md`). Assets marked **UNAVAILABLE** aren't in the project; nothing here is invented to fill them.

## 1. Positioning, promise and audience

| Element                        | Exact wording / content                                                                                                                                                                      | Source                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Promise**                    | "Make your own money. Know what you're getting into."                                                                                                                                        | Founder, 22 Oct 2026 (`src/content/brand.ts`); from the website |
| **Supporting line**            | "Find the side income that fits your real week, see what it really costs and takes, check the rules where you live, then test it for 14 days before you spend big."                          | Same                                                            |
| **Tagline (sign-off)**         | "Big plans. Real life." (a sign-off, never the promise)                                                                                                                                      | Same                                                            |
| **Audience**                   | Women building a side income around a real week: limited hours, school pick-ups, little start-up money. The products' examples assume this ("23 realistic ways to earn around school hours") | Register (`income-fit-test`, `100-faceless-hooks`)              |
| **Second audience**            | People launching a Shopify store (Empire Studio's Launch Pack)                                                                                                                               | `README.md`                                                     |
| **Positioning (as practised)** | Honest, evidence-labelled, faceless, anti-hype. "No income promises" is said in the products and on the FIT Finder page                                                                      | FIT Finder page; register                                       |

**Founder background** (from the latest brief): non-practising barrister, called to the Bar of England and Wales; Master's in Public Policy; background in policy and regulation.

**Current rule:** the founder's `README_FOR_CLAUDE_CODE.md` bans describing her as a lawyer, barrister or counsel near products. On 23 Oct 2026 she chose to keep credentials off the Ads course. **Nothing about credentials is in any copy.**

**Decision for review:** whether, where and how to use the credentials. Draft About-only wording is in `docs/audit/BRAND_AND_CONVERSION_AUDIT.md` §3. It needs checking against the Bar Standards Board's rules for unregistered barristers (UNVERIFIED).

## 2. Values and house rules (enforced in code where possible)

From `src/content/methodology.ts` (`HOUSE_RULES`, repeated across five products), the founder's README rules (as recorded in the register), and `src/lib/ai/guard.ts`:

1. No income claims, no "passive income", no fake scarcity or countdowns, no fake "was" prices, no fake reviews. (The claims guard flags these.)
2. Testimonials only when real, with permission, in the person's exact words.
3. A launch price must be real: say who gets it and when it ends.
4. Label figures **FACT**, **EST** or **UNKNOWN**, with the date checked. "If you can't link to it, leave it out."
5. AI-generated people or voices are labelled, never presented as the founder or a customer.
6. Never PLR/MRR (resell rights), never MLM or recruitment, never the former trading name. (The guard always flags these.)
7. Faceless, not anonymous: no stock photos of people. Seller identity is shown: "Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com".
8. Keep the founder's family off the internet. (Register flag: some buyer-facing templates use "mum of one" examples, which must never become HLE's own copy.)
9. Refunds: exactly "Full refund within 14 days of purchase, no questions asked.", followed by "This is on top of your rights under consumer law."
10. Voice: "Write the way you'd text a friend: plain, specific, warm, no hype. Say the result, not the feature."

## 3. Tone of voice: real examples from the project

- "No one honest can. It gives you a clear brand, usable copy and a plan; the launching is yours." (Studio home, on promising sales)
- "Sidekick prompts are instructions, not magic." / "A photo brief isn't a photo." (Studio home)
- "Try it free. Upgrade when it's earned it." (Studio home)
- "Simple, one-time, and honest about the limits." (Pricing)
- "Most side-income ideas don't fail because they're bad. They fail because they don't fit the week you actually have." (5-Question Fit Check)
- "Feeling busy is not evidence. These three numbers are." (90-Day Grow Plan)
- "Anyone selling a trick to 'beat the algorithm' is guessing." (Get Found)
- "You don't need a big audience to test an idea. You need five real conversations and one person willing to pay." (First 5 Customers)

## 4. Visual identity: design tokens (FACT, `src/app/globals.css`)

| Token            | Hex       | Use                                     |
| ---------------- | --------- | --------------------------------------- |
| `aubergine`      | `#43252c` | Headings, primary buttons, brand colour |
| `aubergine-deep` | `#331c22` | Button hover                            |
| `ivory`          | `#f7f2e9` | Page background (warm cream)            |
| `paper`          | `#fffcf7` | Cards                                   |
| `blush`          | `#eacacb` | Soft accents, badges                    |
| `blush-soft`     | `#f5e3e1` | Large soft panels                       |
| `rose`           | `#da5265` | Accent; **large text only** (contrast)  |
| `rose-ink`       | `#b8384c` | Eyebrow labels (small caps)             |
| `charcoal`       | `#242122` | Body text                               |
| `mute`           | `#564b4e` | Secondary text (founder-confirmed grey) |
| `line`           | `#e3d8cf` | Borders                                 |

**Type (self-hosted, `public/fonts/`):**

- **Bodoni Moda 800** for headings (founder-confirmed);
- **Lora** for numbers ("numbers are never set in Bodoni");
- **Inter** for body text and labels (labels in Inter 700, uppercase, wide tracking, rose-ink);
- **Caveat** for handwritten accents.

**Print-style devices** (brand book, as summarised): running head, numbering, footnote, "one rose word", imagery do's and don'ts, motion, and a "two-second check".

**Against the direction in the recent briefs** (cream, blush, burgundy, charcoal, restrained gold):

- cream, blush and charcoal match;
- aubergine reads deep burgundy-purple;
- **there's no gold token.** Rose is the accent.

Any change needs founder approval; nothing has been changed.

## 5. Asset inventory

| Asset                                                 | Status                                                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo / wordmark                                       | **Text only** in the app ("Empire" in Bodoni + "STUDIO" label: `src/components/shell/wordmark.tsx`). **No logo image file in the project.** Whether herlittleempire.com uses a logo file: UNAVAILABLE |
| Brand book (`visual-identity.html`, `PRINT_STYLE.md`) | Audited (register `brand-system`); **not committed**. Corrections listed in CORRECTIONS §5 (footer, grey, weight, no stock people)                                                                    |
| Fonts                                                 | In `public/fonts/` (9 WOFF2 files)                                                                                                                                                                    |
| Photography / image library                           | **UNAVAILABLE.** None in the project; the rule is no stock photos of people                                                                                                                           |
| Canva / PowerPoint templates                          | Brand-in-a-Box (4 editable templates, product content). 30-Day Plan carousel templates T01–T10: **not in the supplied files**                                                                         |
| Favicon / social share images                         | **None** in the app                                                                                                                                                                                   |
| Product PDFs and covers                               | On Gumroad (UNVERIFIED live); audited from the supplied files                                                                                                                                         |

## 6. Copy inventory

| Copy                                               | Where                                               | Status                                                                          |
| -------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| herlittleempire.com homepage, product pages, About | The website                                         | **UNAVAILABLE.** Only the promise and supporting line are known to come from it |
| Empire Studio homepage                             | `src/app/page.tsx`; screenshot `01-studio-home.png` | Live on preview: "Your Shopify launch, written, planned and ready to paste."    |
| Pricing page                                       | `src/app/pricing/page.tsx`; `02-pricing.png`        | Live on preview                                                                 |
| FIT Finder intro                                   | `/studio/fit`; `07-fit-finder-start.png`            | Promise + "Twenty questions about your time, budget, skills and limits…"        |
| Ads calculator page                                | `src/app/ads/tools/calculator/page.tsx`; `03-…png`  | Built, unpushed                                                                 |
| Product listing copy on Gumroad                    | Gumroad                                             | **UNAVAILABLE**                                                                 |
| About text / founder story                         | —                                                   | **Does not exist** in the project                                               |
| Social bios                                        | —                                                   | **UNAVAILABLE.** Only the handle @herlittleempire.co is confirmed               |

## 7. Marketing materials in the project

| Material                                                          | What exists                                                                                                                                                                                        | Status                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Her Little Empire's own Instagram posts, Reels, captions, metrics | —                                                                                                                                                                                                  | **UNAVAILABLE** (not in the project; no connector) |
| Reel / carousel / story **templates** (for customers)             | 30-Day Faceless Content Plan (12 reels, 10 carousels, 8 story days, caption templates); 100 Faceless Hooks (in `content/hooks/hooks.json`, 100 entries, verified word for word); Comment-to-DM Kit | Products, not HLE's own content calendar           |
| Welcome email sequence (5 emails)                                 | `content/emails/welcome-sequence.md`, guard-tested                                                                                                                                                 | Draft for founder review                           |
| Past-buyer announcement email                                     | `docs/MIGRATION.md`                                                                                                                                                                                | Draft for founder review                           |
| Lead magnets                                                      | 5-Question Fit Check (free on Gumroad, founder); FIT Finder free tier (built); Ads Profitability Calculator (built)                                                                                | See the funnel doc                                 |
| Email campaigns sent, list size                                   | —                                                                                                                                                                                                  | **UNAVAILABLE** (no email service connected)       |
| Content strategy for HLE's own channels                           | The method HLE sells: a teach/trust/show/sell rhythm (30-Day Plan); six faceless formats; a "two-hour week" (Faceless Content System)                                                              | Available as method; no HLE plan documented        |

## 8. Preserve, and refine

**Preserve:**

- The promise and supporting line.
- The FACT/EST/UNKNOWN labelling.
- "Not enough evidence" as a real verdict.
- The house rules and the claims guard.
- The plain, dry, kind voice.
- Bodoni/Lora/Inter typography on cream.
- The exact refund wording.
- Faceless, never anonymous.

**Refine (decisions, not changes made):**

1. A founder presence without a face: named, short story, and credentials only if approved.
2. One front door: today the visible Studio home sells Shopify software, while the catalogue sells side-income kits.
3. Whether to add a restrained gold accent.
4. A real-testimonial process: permission, exact words.
5. Supply the website's copy and the social bios so they can be reviewed against the house rules.
6. Two currencies (US$ catalogue, AUD course).
