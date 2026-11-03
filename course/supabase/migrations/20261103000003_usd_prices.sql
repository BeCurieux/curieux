-- USD prices for visitors outside Australia (SPEC.md → Non-negotiables:
-- AUD by default, USD for non-AU visitors).
--
-- The spec gives AUD prices only. These are the AUD prices converted at
-- about 0.70 USD per AUD (mid-market, early November 2026) and rounded to
-- the nearest whole dollar. Like AUD, no tax is added or itemised.
--
--   Module 0        A$49   → US$34
--   Full course     A$250  → US$175   (US$141 after the Module 0 credit)
--   Founding cohort A$349  → US$244
--   Benchmark pack  A$29   → US$20
--
-- To change one later: update public.products set price_usd_cents = …
-- where slug = '…'; (and create the matching Stripe price).

update public.products set price_usd_cents = 0 where slug = 'product-check';
update public.products set price_usd_cents = 3400 where slug = 'module-0';
update public.products set price_usd_cents = 17500 where slug = 'course';
update public.products set price_usd_cents = 24400 where slug = 'founding';
update public.products set price_usd_cents = 2000 where slug = 'benchmark-pack';

-- From here on every product has both prices.
alter table public.products alter column price_usd_cents set not null;
