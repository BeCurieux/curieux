/**
 * The result page: a scan, set as a critical edition of the brand's own copy.
 *
 * One standalone HTML file, no scripts, no requests. It is the kill-test
 * instrument first — a founder renders thirty of these, screenshots them and
 * sends them — and the product's front door second, which is why it is a pure
 * function of a `ScanResult` rather than a component wired to anything.
 *
 * The form: the score as a display numeral, the markets as a ruled ledger, the
 * copy reproduced with flagged phrases underlined and numbered, and the notes
 * below as an apparatus, each citing its instrument in the mono register.
 * Nothing here grades a brand. It annotates a piece of writing, which is what
 * the brief asked for and what a founder will actually screenshot.
 */

import { badgeEligible } from "../engine/score.js";
import type { Finding, ScanResult } from "../engine/types.js";
import { weakestOf } from "../engine/evaluate.js";
import { citationLabel } from "../engine/framing.js";
import { annotate, marketsOf, type Mark } from "./annotate.js";
import { esc, safeUrl } from "./escape.js";
import { badgeSvg } from "./badge.js";
import {
  BAND_LABEL,
  bandNote,
  FONTS,
  MARKET_LABEL,
  SEVERITY_LABEL,
  SEVERITY_MARK,
  WORDMARK,
  fontFaces,
  longDate,
  paletteCss,
  type EmbeddedFonts,
} from "./tokens.js";

export type CardOptions = {
  /** The copy that was scanned. The card reproduces it, so it is required. */
  text: string;
  result: ScanResult;
  /** Taken, never read off the clock, so a card renders the same in a year. */
  reviewedOn: Date;
  /**
   * What to print in the masthead. Defaults to `WORDMARK`. Override it with
   * `pnpm card --wordmark` to put a different name in front of a founder —
   * the reason that flag exists, and the reason it stays now the name is
   * settled.
   */
  wordmark?: string;
  /**
   * Rewrites, keyed by `rewriteKey(finding)`. Empty today — drafting them is
   * the model's job in step 4 of the build order. Where one is missing the
   * note shows the remedy instead, and says nothing it cannot support.
   */
  rewrites?: Record<string, string>;
  fonts?: EmbeddedFonts;
};

/** Stable key for a rewrite: this rule, at this place in this document. */
export function rewriteKey(finding: Finding): string {
  return `${finding.ruleId}@${finding.trigger.span.start}`;
}

const GRAIN =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">` +
      `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3"/>` +
      `<feColorMatrix type="saturate" values="0"/></filter>` +
      `<rect width="160" height="160" filter="url(#n)"/></svg>`,
  );

function css(fonts: EmbeddedFonts | undefined): string {
  return `
${fontFaces(fonts)}
${paletteCss()}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--paper);color:var(--ink);
  font-family:${FONTS.text};font-size:17px;line-height:1.62;
  font-variant-numeric:oldstyle-nums;
  -webkit-font-smoothing:antialiased;
}
/* Paper, not screen. The grain is barely there and it is the difference
   between a screenshot that looks printed and one that looks like a modal. */
body::after{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:9;
  opacity:.035;background-image:url("${GRAIN}");
}
.sheet{max-width:58rem;margin:0 auto;padding:clamp(1.5rem,5vw,4.5rem) clamp(1.25rem,5vw,4rem) 6rem}

.label{
  font-family:${FONTS.mono};font-size:10px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--ink-faint);font-variant-numeric:tabular-nums;
}
.rule{border:0;border-top:1px solid var(--rule);margin:0}
.rule--faint{border-top-color:var(--rule-faint)}

/* --------------------------------------------------------------- masthead */
.masthead{display:flex;justify-content:space-between;align-items:baseline;gap:1.5rem;padding-bottom:.9rem}
.masthead__mark{font-family:${FONTS.mono};font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:var(--accent)}

/* ------------------------------------------------------------------ score */
.head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:clamp(1.5rem,5vw,4rem);
      align-items:end;padding:clamp(2rem,6vw,4.5rem) 0 2rem}
@media (max-width:640px){.head{grid-template-columns:1fr;align-items:start}}

.score{display:flex;align-items:baseline;gap:.55rem;
  /* Hang the numeral into the margin so its stem, not its sidebearing,
     lines up with everything below it. */
  margin-left:-.06em}
.score__value{
  font-family:${FONTS.display};font-weight:400;font-size:clamp(7rem,24vw,16rem);
  line-height:.74;letter-spacing:-.05em;font-variant-numeric:lining-nums;
}
.score__of{font-family:${FONTS.display};font-size:clamp(1.1rem,3vw,1.6rem);color:var(--ink-faint)}
.score__band{font-family:${FONTS.display};font-size:clamp(1.6rem,5vw,2.6rem);line-height:1.1;margin:.9rem 0 .35rem}
.score__note{color:var(--ink-soft);max-width:32ch;margin:0}

.ledger{min-width:15rem}
.ledger__row{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:1rem;
  padding:.5rem 0;border-top:1px solid var(--rule-faint)}
.ledger__row:first-of-type{border-top:1px solid var(--rule)}
.ledger__name{font-size:15px}
.ledger__value{font-family:${FONTS.display};font-size:1.55rem;line-height:1;font-variant-numeric:lining-nums}
.ledger__weakest{color:var(--accent)}
.ledger__flag{font-family:${FONTS.mono};font-size:9px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);padding-left:.5rem}

/* ------------------------------------------------------------------ badge */
.badgebox{display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;padding:1.4rem 0 .2rem}
.badgebox__note{color:var(--ink-soft);font-size:15px;max-width:52ch;margin:0;flex:1 1 24rem}

/* ------------------------------------------------------------------- copy */
.section{padding:clamp(2.5rem,7vw,4.5rem) 0 0}
.section__head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;padding-bottom:1.1rem}
.copy{
  max-width:36rem;font-size:18px;line-height:1.78;white-space:pre-wrap;
  margin:1.75rem 0 0;hyphens:none;
}
mark{
  background:var(--accent-wash);color:inherit;
  box-shadow:inset 0 -1px 0 var(--accent);
  padding:.06em .12em;border-radius:2px;
}
.copy sup{
  font-family:${FONTS.mono};font-size:9px;letter-spacing:.02em;color:var(--accent);
  vertical-align:super;line-height:0;padding-left:.18em;font-variant-numeric:lining-nums;
}
.copy--clean{color:var(--ink-soft)}

/* ------------------------------------------------------------------ notes */
.note{display:grid;grid-template-columns:2.5rem minmax(0,1fr);gap:0 1rem;
  padding:1.6rem 0;border-top:1px solid var(--rule-faint)}
.note:first-of-type{border-top:1px solid var(--rule)}
@media (max-width:560px){.note{grid-template-columns:1fr;gap:.5rem}}
.note__index{font-family:${FONTS.display};font-size:1.5rem;line-height:1;color:var(--accent);
  font-variant-numeric:lining-nums}
.note__phrase{font-family:${FONTS.display};font-size:clamp(1.35rem,3.6vw,1.9rem);line-height:1.24;
  margin:0 0 .2rem;max-width:26ch}
.note__phrase::before{content:"\\201C"}
.note__phrase::after{content:"\\201D"}
.note__chips{display:flex;flex-wrap:wrap;gap:.4rem;padding:.45rem 0 .9rem}
.chip{font-family:${FONTS.mono};font-size:9px;letter-spacing:.14em;text-transform:uppercase;
  border:1px solid var(--rule);border-radius:999px;padding:.24rem .55rem;color:var(--ink-soft);
  background:var(--paper-raised)}
.chip--severity{border-color:var(--accent);color:var(--accent);letter-spacing:.04em}
.finding{padding:.75rem 0 0;max-width:44rem}
.finding+.finding{margin-top:.85rem;padding-top:.85rem;border-top:1px dashed var(--rule-faint)}
.finding__headline{margin:0 0 .45rem;font-size:17px}
.finding__body{margin:0 0 .45rem;color:var(--ink-soft);font-size:16px}
.finding__instead{margin:.55rem 0 0;padding-left:.9rem;border-left:2px solid var(--accent);font-size:16px}
.finding__instead b{font-weight:600}
.finding__cite{font-family:${FONTS.mono};font-size:10px;line-height:1.6;color:var(--ink-faint);
  margin:.6rem 0 0;word-break:break-word}
.finding__cite a{color:inherit}

/* ------------------------------------------------------------ arithmetic */
.sums{font-family:${FONTS.mono};font-size:12px;line-height:2;color:var(--ink-soft);margin:1.25rem 0 0}
.sums__row{display:grid;grid-template-columns:3.5rem minmax(0,1fr);gap:1rem;
  border-top:1px solid var(--rule-faint);padding:.15rem 0}
.sums__points{text-align:right;color:var(--ink);font-variant-numeric:tabular-nums}
.sums__total{display:grid;grid-template-columns:3.5rem minmax(0,1fr);gap:1rem;
  border-top:1px solid var(--rule);padding:.4rem 0 0;color:var(--ink)}

/* --------------------------------------------------------------- colophon */
.colophon{padding:clamp(3rem,8vw,5rem) 0 0;color:var(--ink-faint);font-size:14px;max-width:44rem}
.colophon p{margin:0 0 .7rem}
.colophon .label{display:block;padding-bottom:.6rem}

/* One page load, staggered. Nothing hovers, nothing bounces: this is a
   document, and the only motion it gets is arriving. */
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.masthead,.head,.section,.colophon{animation:rise .7s cubic-bezier(.2,.7,.3,1) backwards}
.head{animation-delay:.06s}
.section:nth-of-type(1){animation-delay:.12s}
.section:nth-of-type(2){animation-delay:.18s}
.section:nth-of-type(3){animation-delay:.24s}
.colophon{animation-delay:.3s}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}

@media print{
  /* Ink on paper, whatever the screen does. A printer asked for a black page
     produces a black page, and the copy on it is unreadable. */
  :root{--paper:#fff;--paper-raised:#fff;--ink:#111;--ink-soft:#444;--ink-faint:#777;
        --rule:#bbb;--rule-faint:#ddd;--accent:#9E3B2A;--accent-wash:#EBD2C4}
  html{color-scheme:light}
  body{background:#fff;color:#111}
  mark{background:var(--accent-wash);box-shadow:inset 0 -1px 0 var(--accent)}
  body::after{display:none}
  .sheet{max-width:none;padding:0}
  .note,.section{break-inside:avoid}
}
`.trim();
}

function ledger(result: ScanResult): string {
  const weakest = weakestOf(result.jurisdictions, result.byJurisdiction);
  const rows = result.jurisdictions.map((jurisdiction) => {
    const score = result.byJurisdiction[jurisdiction];
    const isWeakest = jurisdiction === weakest && result.jurisdictions.length > 1;
    return (
      `<div class="ledger__row">` +
      `<div class="ledger__name">${esc(MARKET_LABEL[jurisdiction] ?? jurisdiction)}` +
      (isWeakest ? `<span class="ledger__flag">headline</span>` : "") +
      `</div>` +
      `<div class="ledger__value${isWeakest ? " ledger__weakest" : ""}">${score?.value ?? "—"}</div>` +
      `</div>`
    );
  });
  return `<div class="ledger"><div class="label">By market</div>${rows.join("")}</div>`;
}

function copyBlock(text: string, result: ScanResult): string {
  const { pieces, marks } = annotate(text, result.findings);
  if (marks.length === 0) {
    return `<p class="copy copy--clean">${esc(text)}</p>`;
  }
  const html = pieces
    .map((piece) =>
      piece.kind === "text"
        ? esc(piece.text)
        : `<mark>${esc(piece.mark.text)}</mark><sup>${piece.mark.index}</sup>`,
    )
    .join("");
  return `<p class="copy">${html}</p>`;
}

function findingBlock(finding: Finding, rewrite: string | undefined): string {
  const url = safeUrl(finding.citation.url);
  // The headline already names the instrument. Repeating it whole underneath
  // turns the apparatus into an echo, so the mono line carries what the
  // headline does not: the rule's own id, and the locator inside the
  // instrument. `citationLabel` stays the accessible name of the link.
  const locator = finding.citation.locator ?? finding.citation.instrument;
  const instead = rewrite
    ? `<p class="finding__instead"><b>Instead</b> — ${esc(rewrite)}</p>`
    : `<p class="finding__instead"><b>Instead</b> — ${esc(finding.remedy)}</p>`;
  return (
    `<div class="finding">` +
    `<p class="finding__headline">${esc(finding.headline)}</p>` +
    `<p class="finding__body">${esc(finding.concern)}</p>` +
    instead +
    `<p class="finding__cite">${esc(finding.ruleId)} · ` +
    (url
      ? `<a href="${esc(url)}" title="${esc(citationLabel(finding.citation))}">${esc(locator)}</a>`
      : esc(locator)) +
    `</p>` +
    `</div>`
  );
}

function noteBlock(mark: Mark, rewrites: Record<string, string>): string {
  const worst = mark.findings[0];
  if (!worst) return "";
  const chips = [
    `<span class="chip chip--severity" title="${esc(SEVERITY_LABEL[worst.severity])}">` +
      `${SEVERITY_MARK[worst.severity]}&nbsp;${esc(SEVERITY_LABEL[worst.severity])}</span>`,
    ...marketsOf(mark).map((market) => `<span class="chip">${esc(market)}</span>`),
    ...[...new Set(mark.findings.flatMap((f) => f.categories))].map(
      (category) => `<span class="chip">${esc(category.replace("_", " "))}</span>`,
    ),
  ];
  return (
    `<div class="note">` +
    `<div class="note__index">${mark.index}</div>` +
    `<div>` +
    `<p class="note__phrase">${esc(mark.text.trim())}</p>` +
    `<div class="note__chips">${chips.join("")}</div>` +
    mark.findings.map((finding) => findingBlock(finding, rewrites[rewriteKey(finding)])).join("") +
    `</div>` +
    `</div>`
  );
}

function arithmetic(result: ScanResult): string {
  const weakest = weakestOf(result.jurisdictions, result.byJurisdiction);
  const deductions = result.byJurisdiction[weakest]?.deductions ?? [];
  const rows = deductions
    .map(
      (deduction) =>
        `<div class="sums__row"><div class="sums__points">${
          deduction.points > 0 ? `&minus;${deduction.points}` : "0"
        }</div><div>${esc(deduction.ruleTitle)} — ${esc(deduction.reason)}</div></div>`,
    )
    .join("");
  const spent = deductions.reduce((sum, d) => sum + d.points, 0);
  return (
    `<div class="sums">` +
    `<div class="sums__row"><div class="sums__points">100</div><div>Every scan starts here.</div></div>` +
    rows +
    `<div class="sums__total"><div class="sums__points">${result.score.value}</div>` +
    `<div>${esc(MARKET_LABEL[weakest] ?? weakest)}${
      result.jurisdictions.length > 1 ? ", the weakest of the markets checked" : ""
    }${spent > 0 ? "" : " — nothing deducted"}</div></div>` +
    `</div>`
  );
}

function badgeBlock(result: ScanResult, reviewedOn: Date): string {
  if (badgeEligible(result.score)) {
    return (
      `<div class="badgebox">${badgeSvg({ result, reviewedOn })}` +
      `<p class="badgebox__note">This copy can carry the mark. It records what was checked and when — ` +
      `nothing more, and it links back to this page so a shopper can read the same thing you are reading.</p>` +
      `</div>`
    );
  }
  return (
    `<div class="badgebox"><p class="badgebox__note">The mark is not offered for this copy yet. ` +
    `It needs a clear reading in every market you selected, and a phrase that draws attention ` +
    `reliably keeps a page out of clear at any score. The notes below are the whole list.</p></div>`
  );
}

export function resultPage(options: CardOptions): string {
  const { text, result, reviewedOn, wordmark, rewrites = {}, fonts } = options;
  const { marks } = annotate(text, result.findings);
  const source =
    result.source.reference ?? (result.source.kind === "paste" ? "Pasted copy" : "Uploaded copy");
  const checked = result.jurisdictions
    .map((j) => `${MARKET_LABEL[j] ?? j} (pack ${result.packVersions[j] ?? "—"})`)
    .join(" · ");
  const title = `${result.score.value}/100 — ${BAND_LABEL[result.score.band]}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex">
<style>${css(fonts)}</style>
</head>
<body>
<div class="sheet">

  <header class="masthead">
    <div class="masthead__mark">${esc(wordmark ?? WORDMARK)}</div>
    <div class="label">${esc(longDate(reviewedOn))}</div>
  </header>
  <hr class="rule">

  <div class="head">
    <div>
      <div class="label">Claim confidence</div>
      <div class="score">
        <div class="score__value">${result.score.value}</div>
        <div class="score__of">/100</div>
      </div>
      <h1 class="score__band">${esc(BAND_LABEL[result.score.band])}</h1>
      <p class="score__note">${esc(bandNote(result.score.band, result.findings.length))}</p>
    </div>
    ${ledger(result)}
  </div>

  <hr class="rule--faint rule">
  ${badgeBlock(result, reviewedOn)}

  <section class="section">
    <div class="section__head">
      <div class="label">The copy, marked</div>
      <div class="label">${esc(source)}</div>
    </div>
    <hr class="rule">
    ${copyBlock(text, result)}
  </section>

  <section class="section">
    <div class="section__head">
      <div class="label">Notes</div>
      <div class="label">${marks.length} ${marks.length === 1 ? "phrase" : "phrases"}</div>
    </div>
    ${
      marks.length === 0
        ? `<hr class="rule"><p class="copy copy--clean">Nothing here trips a rule in the markets checked. That is not the same as nothing to say — it is what these rules, in these markets, on this date, found in these words.</p>`
        : marks.map((mark) => noteBlock(mark, rewrites)).join("")
    }
  </section>

  <section class="section">
    <div class="section__head">
      <div class="label">How the score is made</div>
      <div class="label">Every point, named</div>
    </div>
    <hr class="rule">
    ${arithmetic(result)}
  </section>

  <footer class="colophon">
    <hr class="rule">
    <p class="label" style="padding-top:1.25rem">Checked against</p>
    <p>${esc(checked)}</p>
    <p>${esc(result.disclaimer)}</p>
  </footer>

</div>
</body>
</html>`;
}
