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

# The ingester's last rung. Decided: on.
pnpm exec playwright install chromium
export CHROMIUM_PATH="$(node -p "require('playwright-core').chromium.executablePath()")"
pnpm browser:check                    # launches it — do not skip this
```

`CHROMIUM_PATH` is the one variable here that fails quietly in **two**
directions, which is why it gets a check of its own rather than a line in a
list. Unset, the ladder's last rung is skipped and the trace reads `no browser
available`: a store with a closed `/products.json` comes back thin and nothing
says why. Set to a path that is not there, the renderer builds anyway — the
code tests the variable, not the file — and every store fails at launch, one
line deep in a diagnostics trace nobody reads until the batch is over.

And the path can look right and be wrong. `playwright-core` reports the browser
build *its own version* expects, which is not necessarily the build on disk;
resolving without installing first gives a confident-looking path to nothing.
`pnpm browser:check` resolves, checks the file is there, launches it, and reads
a page whose only product link is written by a script after a tick — the same
thing the rung does on a real storefront. It exits non-zero on anything less.

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It must never be given
a `NEXT_PUBLIC_` prefix, never reach a browser bundle, and never be the key a
published page is served with. If it leaks, every merchant's Genome leaks with
it.

Without `AI_PROVIDER=anthropic` the pipeline still runs — it just assembles a
defensible default rather than merchandising. `pnpm killtest check` refuses to
start a run in that state, deliberately.

## 1. Apply the migration, then try to break it

Create the project at supabase.com, take its connection string, and run one
command:

```sh
export SUPABASE_DB_URL='postgresql://postgres:...@db.PROJECT.supabase.co:5432/postgres'
pnpm supabase:setup
```

That applies `schema.sql`, runs the RLS check below, and then does the thing
nothing else does: **exercises the adapter against real PostgREST.** Whether
`upsert` with `onConflict` updates rather than duplicates, what `maybeSingle`
returns on a miss, whether the embedded-resource select comes back nested the
way `listPublished` unwraps it, whether `get_published_shop` carries a Genome
column it must not — none of that is decidable from a schema file or a local
Postgres, and all of it is a string in a query until a real project answers.

It is safe against a project with merchants in it. The schema is `create table
if not exists` throughout, the RLS check rolls itself back, and every row the
probe writes is namespaced under a `.invalid` store URL and deleted in a
`finally` — including when an assertion fails partway through. It is
idempotent; run it again whenever the schema changes.

The two steps separately, if you would rather watch them:

```sh
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f src/lib/publish/schema.sql
pnpm rls:check                 # or: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f src/lib/publish/rls-check.sql
```

Two traps if you script around `rls:check`. The pass is *both* a `raise notice`
and a returned row: psql writes the notice to **stderr**, so matching on stdout
alone reads a passing check as a failure — which is exactly what
`supabase:setup` did on its first run against a real database.

The row exists because of the second trap. Run without psql — pasted into the
Supabase dashboard's SQL editor, which is the route when PostgreSQL client
tools are not installed — notices are not shown at all, and the editor renders
only the last statement's result. That statement is the `rollback`, so a full
pass and a file that did nothing both came out as `Success. No rows returned`,
and the operator was left inferring which they had from the absence of a red
error. The file now ends with a `select` after the rollback, so a pass is one
visible row in either tool.

The second command is the one that matters. It inserts probe rows, re-reads
them as `anon`, asserts what may and may not come back, and rolls the whole
thing back — safe against a live project, and it raises on the first failure
rather than printing a report nobody reads to the end.

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
| `early_access`, incl. name, email and store | 0 rows |
| `get_published_shop('<published>')` | 1 row — the one public path |
| `get_published_shop('<draft>')` | 0 rows |
| `genome` in the function's column list | absent |
| insert event / insert shop / insert early_access | `insufficient_privilege` |
| update shop / update store / delete version | 0 rows affected |

And verified to fail, which matters more:

| broken on purpose | what it says |
|---|---|
| `select` policy on `stores` | *anon can read public.stores (2 rows). The Genome is exposed.* |
| `genome` added to the function | *get_published_shop returns a genome column: …* |
| both old policies restored | *anon can read public.shop_versions (2 rows). Merchant prompts are exposed.* |
| `select` policy on `early_access` | *anon can read public.early_access (1 rows). Contact details are exposed.* |
| `insert` policy on `early_access` | *anon can write to early_access directly.* |

**`early_access` is new, and it is the only table here holding personal data.**
An existing project needs `schema.sql` re-run before the check will pass — the
statements are `create table if not exists`, so re-running is safe on a project
with merchants in it. Everything else popuup stores is a public product feed or
a random session id; this one is names, email addresses and store URLs of
people who wrote in, which is why it gets probes from both directions rather
than a read check alone. Both of the new rows above were confirmed to fail by
adding the policy, running the check, and dropping it again.

That last one was checked by hand as well as by assertion: with both policies
back, `select prompt, audience from public.shop_versions` as `anon` returns
`a gift edit // first-time buyers`. Restoring only the version policy is inert,
because it joins `shops` — which is why the check asserts on both tables rather
than trusting one to imply the other.

Service-role reads are unaffected by any of this: `service_role` carries
`bypassrls`, so `listPublished` and the funnel summary still see everything.

## 1b. The deployment

**Importing the repository.** The Next app is in `shopfront/`, not at the
repository root, so Vercel's **Root Directory** has to be set to `shopfront`
when the project is created. Left at the default, the build fails on the first
step with no `package.json` — a confusing error for a straightforward cause,
and the single most likely way this import goes wrong. Everything else is
detected: pnpm from the lockfile, Next from the dependency, `pnpm build` as
the build command.

```sh
vercel env pull            # or run this where the deployment's own variables are
pnpm deploy:check
pnpm build                 # the same thing Vercel runs; it is worth failing here first
```

Vercel is the second place a missing variable fails quietly, and it fails in
front of merchants rather than in a terminal. `storeNameFromEnv()` chooses the
Supabase adapter when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both
set and the **filesystem** adapter otherwise — right on a laptop, catastrophic
on Vercel. A deployment missing either one boots cleanly, serves the workbench,
and answers every published shop URL with a 404. No error, no log line, nothing
to grep for. The first signal is a merchant saying their link is broken.

`deploy:check` refuses on that, on a `NEXT_PUBLIC_`-prefixed secret, and on a
`PUBLIC_ORIGIN` that is missing, not https, or carries a path. It reads
configuration only; `pnpm rls:check` is the one that proves the database
answers.

**Deploying the landing page alone is a legitimate state, and `deploy:check`
will refuse it.** The check is written for a deployment that serves shops: it
treats a missing `SUPABASE_URL` as fatal because a published link would 404
with nothing saying why. Before anything is published there are no such links,
and `/` is a marketing page that needs no database. That deployment is fine —
the check is right about what it measures and is simply answering a question
that has not been asked yet. Read its output, then decide; do not weaken it.

`PUBLIC_ORIGIN` still matters in that state. It is what `metadataBase` resolves
the Open Graph image against, so a landing page deployed without it unfurls
every share with an image pointing at `localhost`.

**The workbench does not ship.** `/workbench` is a development tool — it lists
every shop in the local cache and shows the command that fills it. In a
production build it returns 404, which is the honest answer: there is no page
there. `/` is the landing page and is not gated. `WORKBENCH=1` puts it back for a deployment where that is
wanted, such as comparing five moods on a preview URL rather than on the
machine that generated them; `deploy:check` says so when it sees the variable
set. The gate is on `NODE_ENV`, not on Vercel's own variables, so a self-hosted
`next start` behaves the same way.

`/preview/<key>` is not gated and does not need to be — it reads the same local
cache, which is empty in a deployment, so every key 404s on its own.

**One thing to keep in mind.**

- **The Playwright rung does not run on Vercel.** It is on for the workstation
  runs (§0) because that is where `pnpm generate` runs. Serverless functions
  have no browser and `serverExternalPackages` does not put one there. Nothing
  in the deployment calls it today — generation is a CLI — so this is a fact to
  keep rather than a bug to fix, and it becomes a real constraint the moment
  generation is ever moved behind a route.

`tests/deploy-config.test.ts` holds the four settings that only matter once
deployed and cannot fail locally: `force-dynamic` on the shop page (without it
Next caches the page and serves a price that was true at build time, under a
dateline saying otherwise), `runtime = "nodejs"` on the funnel endpoint, the
service key reaching exactly the two files it should, and Next's image
optimiser staying off so no merchant CDN needs allowlisting before their
photographs load.

### When production is behind `main`

Merging is not deploying, and nothing in this repository records which commit
production is actually serving. The only source of truth is the project's
**Deployments** list: the top row marked `Production` names the commit, and
everything below it marked `Preview` is a branch build that is serving nobody.

Three things make that gap easy to miss, and all three happened here on one
day.

**A refused deployment is not retried.** Vercel's Hobby plan caps deployments
per account per day. Over the cap, a push produces no deployment at all — not a
failed one, not a queued one. Nothing. The merge lands in `main`, CI goes
green, the PR closes, and production keeps serving whatever it had. There is no
error anywhere a developer looks, because the thing that failed never started.
Two merges were lost this way and the symptom was "the site still looks old".

**The cap is per account, and this repository holds six apps.** Every push to
every branch of `haunted`, `lattice`, `ordinary-tuesday`, `qotidia`,
`shopfront` and `waterline` can trigger a build in whichever projects watch
this repo. A day of ordinary work across several branches reaches a hundred
without anybody doing anything unusual. Scope each project with **Settings →
Git → Ignored Build Step** so it only builds when its own directory changed;
for this one, when `shopfront/**` changed.

**Redeploy rebuilds that deployment's commit, not the latest one.** The button
on a deployment row re-runs *that* build. It is the right tool for a flaky
build or a changed environment variable — environment variables are baked in at
build time, so a variable added after a deployment does nothing until something
rebuilds — and it is the wrong tool for shipping newer commits. To move
production forward you need a new push to the production branch. Promoting an
existing preview works too and skips the build entirely, which is the way
through when the cap is the problem.

The confusing case is worth stating because the obvious inference was wrong
once: production may sit on a commit that *is* recent while still missing the
work you are looking for. A file uploaded through GitHub's web interface lands
on `main` as its own commit, and if that one deploys it carries every merge
beneath it. Production was therefore several merges ahead of where the missing
deployments suggested — and still two behind `main`. Read the commit on the
Production row and compare it with `git log`; do not infer it from which PRs
did or did not get a Vercel check.

### The domain is two hostnames

`example.com` and `www.example.com` are different names and need separate DNS
records. Vercel serving one while only the other resolves produces a domain
that does not load at all, with nothing wrong on the Vercel side to find:

```sh
getent hosts getpopuup.com          # apex → Vercel's address
getent hosts www.getpopuup.com      # nothing at all
```

That was the state here — the apex pointed at Vercel and was not an assigned
domain, while the assigned domain was `www`, which had no record. Vercel
redirected the apex to a hostname that did not exist. Whichever is canonical,
both should resolve and `PUBLIC_ORIGIN` should be the canonical one: it is what
every published shop URL is built from, so a `PUBLIC_ORIGIN` naming a hostname
that does not resolve hands merchants links that cannot open.

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

  The Playwright rung is **on** for these runs — see §0. If the trace says
  `no browser available` on any store, `CHROMIUM_PATH` did not survive into
  that shell; stop and re-run `pnpm browser:check` rather than reading the
  thin catalogue that follows as the store's own fault. The rung resolves
  from `CHROMIUM_PATH` and nothing else, which
  `tests/visual/renderer.test.ts` asserts deliberately, so an unset variable
  is a silent skip rather than an error.
- **`genome`** — spot-check five products against what the merchant actually
  sells. This is a model inference over marketing copy and it will sometimes be
  confidently wrong. It never reaches a page, so a wrong reading degrades the
  merchandising rather than lying to a shopper — but a *systematically* wrong
  reading means the brief needs work.
- **`merchandise`** — attempts, and any warnings. More than one attempt means
  the first plan failed validation; the errors are worth reading even when the
  retry succeeded.
- **`shop_versions.model` and `.prompt_version`, after the first store.** These
  are the two fields the build brief calls unrecoverable, and a run that
  records nulls in them is a run whose provenance cannot be joined to a model
  or a prompt revision afterwards. One query settles it:

  ```sql
  select version, model, prompt_version, genome_version
  from public.shop_versions order by created_at desc limit 5;
  ```

  Nulls here mean `pnpm generate` did not pass provenance — stop and fix that
  before generating the other three. `model` is the model that *answered*,
  which with server-side fallbacks in force is not always the one that was
  asked for; a surprise value there is a refusal that got re-served, and worth
  knowing about.
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
