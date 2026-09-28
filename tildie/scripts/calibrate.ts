/**
 * `pnpm calibrate` — is the corpus loud in the right places?
 *
 * The kill test does not fail because the scanner missed something. It fails
 * because a founder opens a card, sees their whole page underlined, and
 * decides the thing cannot tell the difference between a problem and a
 * sentence. Precision is the product; recall is a nice-to-have that can be
 * bought later with more rules.
 *
 * So this runs the corpus over eight invented pages spanning the buyer's
 * categories and prints the marks per page against the band a specialist would
 * have made. Run it after touching any rule. `tests/calibration.test.ts` holds
 * the same bands, so drift in either direction turns CI red — including drift
 * towards louder, which is the direction a rule corpus naturally moves.
 */

import { scan } from "../src/engine/evaluate.js";
import { annotate } from "../src/card/annotate.js";
import { supportedJurisdictions } from "../src/engine/registry.js";
import { CALIBRATION } from "../tests/fixtures/calibration.js";

const markets = supportedJurisdictions();
const bar = "─".repeat(78);

console.log(bar);
console.log(`Calibration — ${CALIBRATION.length} pages, markets ${markets.join(" · ")}`);
console.log(bar);

let outOfBand = 0;

for (const page of CALIBRATION) {
  const result = scan({ text: page.text, source: { kind: "paste" }, jurisdictions: markets });
  const { marks } = annotate(page.text, result.findings);
  const inBand = marks.length >= page.expect.min && marks.length <= page.expect.max;
  if (!inBand) outOfBand += 1;

  const scores = markets.map((m) => `${m} ${String(result.byJurisdiction[m]?.value ?? "—").padStart(3)}`);
  console.log("");
  console.log(
    `${inBand ? "  " : "!!"} ${page.slug.padEnd(26)} ` +
      `${String(marks.length).padStart(2)} marks ` +
      `(expected ${page.expect.min}–${page.expect.max})   ` +
      `${String(result.score.value).padStart(3)}/100  ${scores.join("  ")}`,
  );
  console.log(`     ${page.note}`);
  for (const mark of marks) {
    const worst = mark.findings[0];
    if (!worst) continue;
    const others = mark.findings.length > 1 ? ` +${mark.findings.length - 1}` : "";
    console.log(
      `       ${String(mark.index).padStart(2)}. ${JSON.stringify(mark.text.trim()).padEnd(34)} ` +
        `${worst.severity.padEnd(6)} ${worst.ruleId}${others}`,
    );
  }
}

console.log("");
console.log(bar);
if (outOfBand === 0) {
  console.log(`All ${CALIBRATION.length} pages read inside their band.`);
} else {
  console.log(`${outOfBand} of ${CALIBRATION.length} pages read outside their band — see the !! rows.`);
  process.exitCode = 1;
}
console.log(bar);
