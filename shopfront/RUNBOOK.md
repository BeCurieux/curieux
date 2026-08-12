# The first real run

Everything in `shopfront/` has been exercised against a fixture storefront on
localhost, a faked Anthropic client and a filesystem store, because the build
environment's egress proxy refused real storefront hosts, `api.anthropic.com`
credentials and `supabase.com`. This is the list of what that leaves unproven,
in the order worth doing it, with the commands.

Nothing here is optional before a merchant sees a shop. The third item is the
kill test, and the kill test is the whole content of step 7.

## 0. What to set

```sh
export ANTHROPIC_API_KEY=...          # server-only
export AI_PROVIDER=anthropic          # the deterministic default does not merchandise
export SUPABASE_URL=https://PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...  # server-only
export PUBLIC_ORIGIN=https://popuup.com
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It must never be given
a `NEXT_PUBLIC_` prefix, never reach a browser bundle, and never be the key a
published page is served with. If it leaks, every merchant's Genome leaks with
it.

Without `AI_PROVIDER=anthropic` the pipeline still runs — it just assembles a
defensible default rather than merchandising. `pnpm killtest check` refuses to
start a run in that state, deliberately.

## 1. Apply the migration, then try to break it

```sh
psql "$SUPABASE_DB_URL" -f src/lib/publish/schema.sql
```

Then verify by hand, because this is the one thing no test in the repo can
prove. The Genome is a model's reading of a merchant's catalogue — it reads
like page copy and is not page copy — and the only thing standing between it
and the public is these grants.

Against the project with the **anon** key, not the service role:

```sql
-- Must succeed: the one public read path.
select * from public.get_published_shop('some-published-slug');

-- Must all fail, with permission denied rather than an empty result.
select * from public.stores;
select genome from public.stores;
select * from public.shop_versions;
select * from public.shop_events;
```

An empty result is not a pass. An empty result means the query was allowed and
happened to match nothing, which is the same shape a bug takes when it starts
matching something. What you want is the error.

`get_published_shop` is `security definer` and its return column list is the
allowlist; `stores` has no select policy at all. If any of the four `select`s
above returns rows, stop and fix the grants before publishing anything.

## 2. Four real catalogues

```sh
pnpm generate https://a-real-store.com "a gift edit for someone buying their first proper wool piece"
```

Four different merchants, and **one of them chosen for bad photography** — the
brief's phrase is "must flatter mediocre product photography", and a catalogue
of clean studio shots cannot test it. The fixture is deliberately bad in seven
ways; a real store will be bad in ways nobody predicted.

What to read in the output, in order of how badly it matters:

- **`ingest`** — how many products, and which rung of the ladder answered.
  `diagnostics.trace` records every attempt. A store that fell through to
  Playwright is a store whose `/products.json` is closed, and that is worth
  knowing before thirty of them.
- **`genome`** — spot-check five products against what the merchant actually
  sells. This is a model inference over marketing copy and it will sometimes be
  confidently wrong. It never reaches a page, so a wrong reading degrades the
  merchandising rather than lying to a shopper — but a *systematically* wrong
  reading means the brief needs work.
- **`merchandise`** — attempts, and any warnings. More than one attempt means
  the first plan failed validation; the errors are worth reading even when the
  retry succeeded.
- **The page itself, on a phone.** Prices, availability and the dateline
  against the merchant's own site. Anything invented is a bug of the most
  serious kind available here.

## 3. Only then, the kill test

```sh
pnpm killtest check targets.txt      # refuses if anything above is not in place
pnpm killtest generate targets.txt
pnpm killtest log https://merchant.com --stage wants_it_live
pnpm killtest status
```

Thirty merchants. `status` computes the verdict rather than offering an
opinion: proceed at five wanting it live, and it will not call a kill before
thirty have been asked and every conversation has resolved.

Sprint 3 — OAuth sync, email capture, creator shops, billing, word-editing,
TikTok-URL input — stays shut until that verdict arrives. `tests/stop-line.test.tsx`
enforces it, so building any of it early turns CI red on purpose.
