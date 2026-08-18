/**
 * The bar and the foot, in one place.
 *
 * These lived twice — once in `page.tsx`, once in `pricing/page.tsx` — and had
 * already drifted apart before anybody noticed: the landing bar carried a
 * Pricing link and the pricing bar did not carry one back, and the two footers
 * offered different things. Two copies survive that; six routes do not.
 *
 * The nav is deliberately short. A marketing site with six pages does not need
 * six links across the top — it needs the two a merchant is actually deciding
 * between (what does it look like, what will it cost) and the one action. The
 * legal pages live in the foot, where people look for them.
 */

import { INBOX } from "@/lib/origin";

/**
 * Where "Get my shop made" goes.
 *
 * `/contact` now, and it used to be a `mailto:`. The mailto was the honest
 * answer while email capture was shut — a form that posted nowhere would have
 * been the exact dishonesty the rest of the site avoids — and it cost real
 * conversion: a merchant on a phone taps it and lands in a mail client with an
 * empty draft they have to compose themselves.
 *
 * The gate was opened on purpose (2026-08-17, see CLAUDE.md), the form writes
 * to a real table, and the failure path still tells the truth. The mailto is
 * kept in the foot, because some people would rather write an email.
 */
export const ASK = "/contact";

export const MAILTO = `mailto:${INBOX}?subject=${encodeURIComponent("Make me a shop")}&body=${encodeURIComponent(
  "My store:\n\nWho the shop is for:\n\n",
)}`;

export function SiteBar({ cta = "Get my shop made" }: { cta?: string } = {}) {
  return (
    <header className="bar">
      <a href="/" aria-label="popuup, home">
        <img className="bar-mark" src="/brand/popuup.svg" alt="popuup" width={180} height={62} />
      </a>
      <nav className="bar-nav">
        <a href="/examples">Examples</a>
        <a href="/pricing">Pricing</a>
        <a className="btn btn-sm" href={ASK}>
          {cta} <span aria-hidden="true">→</span>
        </a>
      </nav>
    </header>
  );
}

/**
 * One foot, on one ground.
 *
 * It used to sit in a dark band on every page and carried the light wordmark
 * for that reason. The closing band is lilac now, and the light mark on lilac
 * is a pale smudge — legible enough to survive a glance at a screenshot and
 * not legible at all on a phone in daylight. Stated as the dark mark rather
 * than switched on a prop: a foot that changed ground per page is a second
 * thing to keep in sync, and `landing.css` already states the text colours for
 * both grounds off `.band-lilac`.
 */
export function SiteFoot() {
  return (
    <footer className="foot">
      <img className="bar-mark" src="/brand/popuup.svg" alt="popuup" width={180} height={62} />
      <span className="foot-line">Make a shop in a sentence.</span>
      <nav className="foot-nav">
        <a href="/examples">Examples</a>
        <a href="/pricing">Pricing</a>
        <a href="/contact">Contact</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
      <a href={`mailto:${INBOX}`}>{INBOX}</a>
    </footer>
  );
}
