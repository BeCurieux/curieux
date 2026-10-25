# Customer journey audit: Income Fit Test and Fit Check

**25 October 2026.** Scope: the path from the existing audience to a paid Income Fit Test (US$19), through the free 5-Question Fit Check. **No production system was changed.**

## 1. What could and couldn't be audited

| Part                                                                                                | Audited?            | How                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| herlittleempire.com (live website)                                                                  | **No: blocked**     | Unreachable from this session (proxy 403, re-checked 25 Oct 2026); its source isn't in the repository                             |
| Gumroad listings and checkout (live)                                                                | **No: blocked**     | `herlittleempireco.gumroad.com/l/income-fit-test` and `/l/fit-check` unreachable (proxy 403, 25 Oct 2026)                         |
| Empire Studio pages (`/fit-check`, `/income-fit-test`, `/fit`, calculator, sign-in, account, admin) | **Yes**             | Code review and automated browser tests on desktop and a 390 px phone, with accessibility checks (local build)                    |
| Studio's purchase handling (Gumroad ping, verification, refunds, access)                            | **Yes, in code**    | Unit tests against a fake Gumroad; never run against real Gumroad (not connected)                                                 |
| Live data                                                                                           | **Yes (read-only)** | Supabase: all events are from the founder's own testing on 23 Oct 2026; **0 purchases** recorded, because Gumroad isn't connected |

**To close the live gaps,** the founder runs the mobile checks in §4 on her own phone and records the results.

## 2. Findings, and what was fixed (development only, branch `hle-ads`)

| #   | Area                       | Finding                                                                                                                                    | Severity | Fix                                                                                                                                                                                                                     | Status                                   |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| F1  | Mobile purchase flow       | Buy buttons opened Gumroad in a **new tab**, which is awkward in Instagram's in-app browser, where most visits start                       | High     | Gumroad now opens in the same tab (`src/components/ads/offer-link.tsx`)                                                                                                                                                 | Fixed                                    |
| F2  | Fit Check promise          | Our page said Gumroad "asks for your email to send it", undercutting **"no sign-up"**                                                      | High     | Copy now says "No sign-up: no account and no password" and that Gumroad asks where to send the file. New: a **direct PDF download with no email at all**, once the founder supplies the file (`FIT_CHECK_DOWNLOAD_URL`) | Fixed; direct download waits on the file |
| F3  | Email follow-up            | Needed as optional and consent-based, never a condition of the Fit Check                                                                   | —        | `/fit-check` labels it "Entirely optional, and not needed for the Fit Check": unticked box, exact versioned wording, one-click unsubscribe. **Switched off** until a sender exists                                      | Built; off                               |
| F4  | Sample report              | Only four cropped screenshots                                                                                                              | Medium   | "See a whole sample report": a full real report (test account "Sam"), linked from `/income-fit-test`                                                                                                                    | Fixed                                    |
| F5  | Pricing                    | US$19 everywhere in Studio, always with the exact refund sentence (tests check it)                                                         | —        | —                                                                                                                                                                                                                       | OK                                       |
| F6  | Pricing (live)             | The live Gumroad price and listing wording are unverified                                                                                  | High     | Founder check (§4)                                                                                                                                                                                                      | Open                                     |
| F7  | Digital delivery           | Gumroad delivers the files. The kit's files still carry old versions and counts (1.3, 17/19 questions, a short refund line)                | High     | `docs/phase-1/INCOME_FIT_TEST_CORRECTIONS.md`                                                                                                                                                                           | Open (founder)                           |
| F8  | Refund handling            | Built: refunds lock the full report back to the free top three, saved answers stay, the record is kept. **Never tested with real Gumroad** | High     | Genuine test purchase and refund (`docs/phase-1/CUSTOMER_JOURNEY_TEST_PLAN.md` T6–T11)                                                                                                                                  | Open                                     |
| F9  | Attribution                | Gumroad purchases arrive with no campaign data, so they can't be tied to a post or ad. Purchase tracking needs Gumroad connected           | High     | Clicks to Gumroad tracked by page and campaign; the seven-day view marks sales "Not tracked" until Gumroad is connected (FUNNEL_REPORT.md)                                                                              | Partly fixed                             |
| F10 | Buyer → interactive report | Gumroad buyers aren't told the report also works interactively in Studio                                                                   | Medium   | One line for the listing and receipt (`docs/phase-1/LAUNCH_COPY.md` §4)                                                                                                                                                 | Open (founder)                           |
| F11 | Launch Pack                | Dead-end buy button                                                                                                                        | —        | Fixed in Phase 1 ("Not on sale yet")                                                                                                                                                                                    | Fixed                                    |
| F12 | Public URLs                | None of the Studio pages are public yet                                                                                                    | Blocker  | #68 and `hle-ads` (#69) merged 25 Oct 2026; still needs Vercel Pro and DNS (`docs/phase-1/PHASE_1_STATUS.md`)                                                                                                           | Open (approval)                          |

## 3. The journey, step by step

| Step                              | Where                                     | Status                                           | Drop-off risk and mitigation                              |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| 1. Sees a post                    | Instagram @herlittleempire.co             | UNVERIFIED (no access)                           | Five sales assets ready (SOCIAL_ASSETS.md)                |
| 2. Taps the bio or story link     | Tagged link → `/fit-check`                | Built (live after deploy)                        | In-app browser: same-tab links (F1)                       |
| 3. Gets the Fit Check, no sign-up | `/fit-check` → direct PDF or Gumroad free | Built; direct PDF waits on the file              | Copy states "no sign-up" (F2)                             |
| 4. Optional email follow-up       | `/fit-check` opt-in                       | Built; off                                       | Never required (F3)                                       |
| 5. Considers the paid report      | `/income-fit-test`                        | Built                                            | Real screenshots, full sample report, limits stated, FAQs |
| 6. Starts checkout                | Gumroad (same tab)                        | Click tracked; Gumroad's own steps UNVERIFIED    | Founder's mobile checkout check (§4)                      |
| 7. Pays                           | Gumroad                                   | UNVERIFIED live                                  | —                                                         |
| 8. Receives the files             | Gumroad receipt and library               | UNVERIFIED live; corrections pending (F7)        | —                                                         |
| 9. Unlocks the interactive report | Studio sign-in with the same email        | Built, unit-tested; live needs Gumroad connected | Listing line (F10)                                        |
| 10. Refund, if asked              | Gumroad → Studio recheck                  | Built; untested live                             | Test (F8)                                                 |

## 4. Founder's mobile checks (about 15 minutes, no purchase needed until step 6)

On your phone, inside the Instagram app:

1. Tap your bio link. Note where it goes. Once Studio is live, it should be the tagged `/fit-check` link.
2. Open the Fit Check on Gumroad. Does it ask for an email? Is any account or password needed? (Record exactly what you see.)
3. Open `/l/income-fit-test`.
   - Price US$19?
   - Description says 20 questions and v1.4?
   - Refund line exactly "Full refund within 14 days of purchase, no questions asked."?
   - Does the buy button work inside Instagram's browser? Does Apple Pay or Google Pay appear (UNVERIFIED feature)?
4. Look at what files the listing delivers, and their names.
5. Screenshot each screen (no card details) and save them to `docs/sales/evidence/` (founder approval to commit).
6. When Gumroad is connected: the genuine purchase and refund test (CUSTOMER_JOURNEY_TEST_PLAN T1–T12).
