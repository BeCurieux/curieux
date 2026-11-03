# Public page copy

One markdown file per public page. The founder's copy replaces these
placeholders; until then each has `draft: true`, which shows a "Draft copy"
notice on the page, and the launch check (step 9) refuses drafts.

- Never type a price: use `{{price:module-0}}`, `{{price:course}}`,
  `{{price:course-with-credit}}`, `{{price:founding}}`,
  `{{price:benchmark-pack}}`. They're filled in from the database in the
  visitor's currency (A$ in Australia, US$ elsewhere).
- Also `{{founding_places}}` (places left) and `{{refund_days}}`.
- No earnings language anywhere: a unit test checks these files.
