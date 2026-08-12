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
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f src/lib/publish/schema.sql
pnpm rls:check                 # or: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f src/lib/publish/rls-check.sql
```

The second command is the one that matters. It inserts probe rows, re-reads
them as `anon`, asserts what may and may not come back, and rolls the whole
thing back — safe against a live project, and it raises on the first failure
rather than printing a report nobody reads to the end. A silent
`RLS check passed` notice is the pass.

The Genome is what this protects: a model's reading of a merchant's catalogue,
which reads like page copy and is not page copy.

**This used to be a by-hand checklist, and the checklist was wrong about all
four of its assertions.** It asked for `permission denied` on `stores`,
`shop_versions`, `shop_events` and `stores.genome`, and said "an empty result
is not a pass". Both halves were mistaken:

- **Denied reads come back empty, not as an error.** Supabase grants `anon`
  table-level privileges on `public` by default and relies on RLS for row
  protection. A table with RLS on and no policy returns *zero rows* — Postgres
  does not raise. For `stores` and `shop_events`, empty **is** the pass. Anyone
  following the old instruction would have gone looking to "fix" grants on a
  database that was already correct.
- **Two of the four are supposed to return rows.** `schema.sql` deliberately
  creates *"published shops are readable"* on `shops` and *"current versions are
  readable"* on `shop_versions`. An anon read of those returning a published
  shop is the schema working, not a leak.

Writes are worth knowing the shape of too: `insert` raises
`insufficient_privilege`, but `update` and `delete` report **zero rows affected**
rather than failing. By eye those look like success. `rls-check.sql` asserts the
row counts.

What the check verifies, all of it confirmed against a local Postgres 16 with
Supabase's own role and grant setup reproduced:

| | anon |
|---|---|
| `stores`, incl. `genome` | 0 rows |
| `published_shops` (view, joins stores) | 0 rows |
| `shop_events`, `shop_funnel()` | 0 rows |
| unpublished shop and its version/prompt | 0 rows |
| `get_published_shop('<published>')` | 1 row — the one public path |
| `get_published_shop('<draft>')` | 0 rows |
| `genome` in the function's column list | absent |
| insert event / insert shop | `insufficient_privilege` |
| update shop / update store / delete version | 0 rows affected |

It was also verified to fail: adding a `select` policy to `stores` raises
*"anon can read public.stores (2 rows). The Genome is exposed."*, and adding
`genome` to `get_published_shop`'s column list raises on the column list. A
check that has never failed has proved nothing.

**One thing the check does not decide for you.** `shop_versions.prompt` and
`.audience` are readable by `anon` for published shops, by design — the
provenance policy is deliberate. That means a merchant's own campaign brief
("clear the slow-moving knitwear before the sale") is public to anyone who
queries the table directly. Nothing renders it, and it is not the Genome, but
it is the merchant's words. Decide whether that is acceptable before thirty of
them are in the table.

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
