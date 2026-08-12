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

Two things it protects. The **Genome** — a model's reading of a merchant's
catalogue, which reads like page copy and is not page copy. And the merchant's
**own words**: `shop_versions` carries `prompt` and `audience`, the campaign
brief as they wrote it.

**If your project predates this change, re-run `schema.sql` before the check.**
There were two select policies, *"published shops are readable"* and *"current
versions are readable"*, and they are now dropped rather than created. RLS is
row-level, so the version policy handed over the whole row — including the
brief. Nothing needed either policy: every read this codebase performs goes
through the service role, and the one path built for an anon key is
`get_published_shop`, which is `security definer` and unaffected. The `drop`
statements are still in the file precisely so re-running it cleans up the
projects that already have merchants in them.

**The by-hand checklist this replaced was wrong about all four of its
assertions.** It asked for `permission denied` and said "an empty result is not
a pass". Both halves were mistaken:

- **A denied read comes back empty, not as an error.** Supabase grants `anon`
  table-level privileges on `public` by default and relies on RLS for row
  protection. A table with RLS on and no policy returns *zero rows* — Postgres
  does not raise. Empty **is** the pass. Anyone following the old instruction
  would have gone looking to "fix" grants on a database that was correct.
- **Two of the four could not have failed as written**, because `shops` and
  `shop_versions` had deliberate read policies at the time. The instruction and
  the schema disagreed with each other, and nobody had run both.

Writes are worth knowing the shape of too: `insert` raises
`insufficient_privilege`, but `update` and `delete` report **zero rows affected**
rather than failing. By eye those look like success. The check asserts the row
counts.

What it verifies, all confirmed against a local Postgres 16 with Supabase's own
roles and default grants reproduced:

| | anon |
|---|---|
| `stores`, incl. `genome` | 0 rows |
| `published_shops` (view, joins stores) | 0 rows |
| `shop_events`, `shop_funnel()` | 0 rows |
| `shops` | 0 rows |
| `shop_versions`, incl. `prompt` and `audience` | 0 rows |
| `get_published_shop('<published>')` | 1 row — the one public path |
| `get_published_shop('<draft>')` | 0 rows |
| `genome` in the function's column list | absent |
| insert event / insert shop | `insufficient_privilege` |
| update shop / update store / delete version | 0 rows affected |

And verified to fail, which matters more:

| broken on purpose | what it says |
|---|---|
| `select` policy on `stores` | *anon can read public.stores (2 rows). The Genome is exposed.* |
| `genome` added to the function | *get_published_shop returns a genome column: …* |
| both old policies restored | *anon can read public.shop_versions (2 rows). Merchant prompts are exposed.* |

That last one was checked by hand as well as by assertion: with both policies
back, `select prompt, audience from public.shop_versions` as `anon` returns
`a gift edit // first-time buyers`. Restoring only the version policy is inert,
because it joins `shops` — which is why the check asserts on both tables rather
than trusting one to imply the other.

Service-role reads are unaffected by any of this: `service_role` carries
`bypassrls`, so `listPublished` and the funnel summary still see everything.

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

  **Decide about `CHROMIUM_PATH` before the first run, not after.** The
  Playwright rung resolves its browser *only* from `CHROMIUM_PATH` — it does
  not fall back to the browser `playwright install` leaves on disk. Unset, the
  ladder's last rung is off and the trace says `no browser available` rather
  than failing, so a store that needed it comes back thin and nothing draws
  attention to why. `tests/visual/renderer.test.ts` asserts that behaviour
  deliberately, so it is a decision rather than a surprise: either export
  `CHROMIUM_PATH` for the run, or accept that a closed-feed store is out of
  scope for this batch. The rung itself works — that suite drives a real
  Chromium against a storefront whose catalogue only appears after JavaScript
  runs.
- **`genome`** — spot-check five products against what the merchant actually
  sells. This is a model inference over marketing copy and it will sometimes be
  confidently wrong. It never reaches a page, so a wrong reading degrades the
  merchandising rather than lying to a shopper — but a *systematically* wrong
  reading means the brief needs work.
- **`merchandise`** — attempts, and any warnings. More than one attempt means
  the first plan failed validation; the errors are worth reading even when the
  retry succeeded.
- **`cache_read_input_tokens`, on the second store and after.** Both adapters
  put a `cache_control` breakpoint on their system prompt, and a breakpoint
  below its model's minimum prefix does not error or warn — it silently does
  not cache. The merchandiser's prompt clears Opus 5's 512-token minimum and
  should show a non-zero read from the second store onward. The Genome's does
  not clear Sonnet 5's 1,024, so its system breakpoint is inert by measurement
  rather than by accident; `tests/genome-anthropic.test.ts` asserts both, so
  the day either changes the suite says so. What matters for the Genome is the
  catalogue, which is cached and is the expensive half — a zero read there,
  across retries on one store, is the number worth chasing.
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
