/**
 * The name, which is not decided.
 *
 * BRIEF.md §3, in as many words:
 *
 * > Do not proceed with Ingrid.
 * > … Run App Store, domain, company-name and trademark screening before
 * > committing.
 *
 * Phase 0 still needs *a* mark on the cards — an unbranded mock tests a
 * different thing from a branded one, and §11 makes the share card a core
 * acquisition mechanism rather than a decoration. So this file holds a working
 * placeholder and says loudly that it is one.
 *
 * `WORDMARK` is a placeholder chosen to demonstrate the positioning, not a
 * decision. It has had no screening of any kind. Nothing may ship, no domain
 * may be bought and no App Store listing may be created against it until the
 * screening in §3 has been run and the result written down here.
 *
 * The brief's criteria, for whoever runs that screening: short, warm,
 * consumer-friendly, plausibly a verb ("scan it with ___"), and not sounding
 * like a nutrition database, a medical product, a diet app, an AI assistant, or
 * generic clean eating.
 *
 * `tests/safety.test.ts` asserts the dropped name appears nowhere in `src/`.
 */

/** Placeholder. Unscreened. See above before using it anywhere real. */
export const WORDMARK = "FITS";

/** The line beside the wordmark on a card. §3's positioning, shortened. */
export const TAGLINE = "your rules, any label";

/** Candidates the screening should cover, alongside anything new. */
export const NAME_CANDIDATES = ["Fits", "Suits", "Checks", "Sift", "Vet"];

/** Explicitly ruled out by §3. Asserted in the test suite. */
export const RULED_OUT = ["Ingrid"];
