/**
 * Eight pages the corpus has to read sensibly before thirty real ones do.
 *
 * All invented. Not scraped, not paraphrased from a real brand's page, and no
 * real brand is named anywhere in this repository — BRIEF.md §9 and CLAUDE.md
 * both hold that line, and a fixture file is exactly where it would erode
 * first.
 *
 * They exist because the kill test's failure mode is not "the scanner missed
 * something". It is "the scanner flagged seventeen things and the founder
 * stopped reading". A card lands when the marks are the ones a specialist
 * would have made; it dies when the page looks like it was hit with a
 * highlighter. So each page carries an expected band, and `tests/calibration.
 * test.ts` fails when the corpus drifts out of it in either direction — too
 * loud is a failure here, not only too quiet.
 *
 * The bands were set by reading each page as a regulatory specialist would and
 * counting what genuinely deserves a mark, before running the scanner over it.
 */

export type CalibrationPage = {
  slug: string;
  /** What kind of brand and buyer this stands in for. */
  note: string;
  text: string;
  /** Marks a specialist would make, low and high. Not findings — marks. */
  expect: { min: number; max: number };
};

export const CALIBRATION: CalibrationPage[] = [
  {
    slug: "careful-skincare",
    note: "Skincare copy written by somebody who already knows the rules. The floor.",
    expect: { min: 0, max: 0 },
    text: `Nocturne Renewal Serum

0.3% encapsulated retinal in a squalane and oat-lipid base.

In a 12-week study of 42 volunteers, 87% reported skin that looked smoother.
Assessed for tolerance on 30 volunteers with sensitive skin over four weeks.
Formulated without parabens, sulfates or synthetic fragrance.
The outer carton is recyclable where facilities exist; the bottle is glass.

Apply two drops at night, after cleansing, before moisturiser. Introduce
gradually — two nights a week for the first fortnight.

From our founder: I made this for skin that reacts to everything, mine
included. It is the one step I have not swapped since 2021.`,
  },
  {
    slug: "ordinary-skincare",
    note: "The median aesthetic DTC skincare page. Two or three habits, not a disaster.",
    expect: { min: 2, max: 5 },
    text: `Meridian Barrier Cream

A rich, quiet cream for skin that has had enough.

Clinically proven to strengthen the skin barrier in 14 days.
Dermatologist tested.
100% natural actives, and nothing else.
Recyclable packaging.

Ceramides, squalane and a little colloidal oat. No fragrance, no essential
oils, no drama. Apply morning and night to clean skin.

"My cheeks stopped stinging after a week." — Nour, Sydney`,
  },
  {
    slug: "supplement-ad-disapproval",
    note: "The buyer whose Meta account went down on Tuesday. Should read loud.",
    expect: { min: 5, max: 9 },
    text: `Lumen Daily Immunity Drops

Boosts immunity through winter.
Clinically proven to reduce the number of days you spend unwell.
Prevents colds before they start.

A liquid blend of elderberry, zinc and vitamin D3, taken under the tongue.
Australia's number one immunity drop, three years running.

"In 7 days my sinus infection was gone." — Bec, Perth

Non-toxic, no nasties, and completely natural.`,
  },
  {
    slug: "clean-beauty-freefrom",
    note: "Clean-beauty positioning, heavy on exclusion lists. Retailer-onboarding buyer.",
    expect: { min: 3, max: 7 },
    text: `Halden Everyday Cleanser

A clean formula with no nasties.

Free from parabens, sulfates, phthalates, silicones and synthetic fragrance.
Non-toxic and completely natural.
Cruelty free, always.
Vegan.

A gel-to-milk cleanser with glycerin and rice bran. Massage into damp skin,
rinse, repeat if you wore sunscreen.`,
  },
  {
    slug: "sustainability-page-eu",
    note: "The ECGT wedge: a brand's sustainability page, sold into the EU.",
    expect: { min: 4, max: 8 },
    text: `Our commitment to the planet

Vesper is an eco-friendly beauty brand.

Every order ships carbon neutral.
Our packaging is fully recyclable and our refill pouches are biodegradable.
We will be plastic free by 2028.
Look for our sustainability seal on every pack.

We think beauty should be kind to the planet, and we have built the business
around that from the first batch.`,
  },
  {
    slug: "food-and-bev-clean-label",
    note: "Clean-label food and drink, the category adjacent to the core buyer.",
    expect: { min: 2, max: 6 },
    text: `Field & Flask Sparkling Tonic

All natural, with no nasties.

Made with green tea extract, yuzu and a little sea salt. Supports gut health
and gives you a lift without the crash.

Our cans are recyclable. Sustainably sourced from growers we visit twice a
year.

Nothing artificial, nothing you cannot pronounce.`,
  },
  {
    slug: "meta-ad-copy",
    note: "A paste into the ad checker: forty words, pre-launch, the acute moment.",
    expect: { min: 2, max: 5 },
    text: `Tired of skin that won't calm down?

Meridian Barrier Cream is clinically proven to repair the skin barrier in
14 days. Treats redness, dryness and irritation. 100% natural.

Shop now — free shipping over $60.`,
  },
  {
    slug: "safety-warnings",
    note: "The false-positive trap: a caution panel that names conditions responsibly.",
    expect: { min: 0, max: 1 },
    text: `Before you use this

Patch test on your inner arm and wait 24 hours.

Speak to your doctor before use if you are pregnant or breastfeeding, if you
have asthma, or if you are taking medication for diabetes or heart disease.

Not suitable for children under 12. Discontinue use and seek medical advice if
irritation persists. Keep out of reach of children. Store below 25°C.`,
  },
];
