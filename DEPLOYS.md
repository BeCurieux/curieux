# Vercel, and why a workflow-only commit was costing four deployments

This repository holds several independent products side by side. Vercel does
not know that: a project connected to the repo builds on **every** push to a
branch it watches, whatever the commit touched. A commit editing only
`.github/workflows/` was triggering four builds, and on the free tier's
hundred-a-day ceiling that adds up fast — it is what exhausted the quota on
2026-08-18.

The fix is an **Ignored Build Step**: a command Vercel runs before building,
where exit `0` means *skip this build* and any other exit means *build*.

```json
{ "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ." }
```

`git diff --quiet` exits 0 when there is no difference. Run from the project's
own directory, that reads as: *nothing here changed in this commit, so do not
rebuild.* A commit under `assay/` no longer wakes the `shopfront` project.

It fails in the safe direction. On a root commit, or a shallow clone that did
not fetch the parent, `HEAD^` does not resolve and git exits non-zero — which
Vercel reads as *build*. An unnecessary deployment is the correct outcome for a
check that could not run.

## The half that is not in this repository

**`vercel.json` is read from the project's Root Directory.** If a project's
Root Directory is the repository root, `shopfront/vercel.json` is never opened
and the ignore command does nothing — silently, with no error anywhere.

So each project needs its Root Directory set, in Vercel → Project → Settings →
Build & Deployment → Root Directory:

| Vercel project | Root Directory | `vercel.json` |
|---|---|---|
| `waterline` | `waterline` | yes — framework, build, rewrites, ignore |
| `popuup` | `shopfront` | yes — ignore only; the framework is auto-detected |
| `curieux` | `haunted` | yes — ignore only |
| `curieux-rifc` | `waterline` | shares `waterline/vercel.json` — being deleted, see below |

Every Root Directory above is **already set** — this half needed no work. The
values are not guesses: Vercel's own PR comment carries a base64 payload naming
each project's `rootDirectory`, which is where these came from.

## `curieux-rifc` is a second project on the same directory

`curieux-rifc` and `waterline` both build `waterline/`. Two projects, one app,
two deployments per push — and on a hundred-a-day ceiling that is a quarter of
the budget spent on a duplicate. It is scoped now, because it reads the same
`waterline/vercel.json`, so it is no longer *waking* for unrelated commits. It
is still deploying the same site twice.

**The owner has decided to delete it (2026-08-18).** It could not be done from
the build environment — `api.vercel.com` is refused by the egress policy, so
there is no path to the Vercel API from here with or without a token. It is a
dashboard action: Vercel → `curieux-rifc` → Settings → Advanced → Delete
Project.

One check first, because it is the half that can take a site down. Open Settings
→ Domains on **both** projects. `waterline` should hold the live domain and
`curieux-rifc` should hold only its `*.vercel.app` preview URLs. If a real
domain is attached to `curieux-rifc`, move it to `waterline` before deleting,
or the site goes dark at the moment of deletion.

Nothing in this repository references the project, so no code change is needed
either before or after — `waterline/vercel.json` stays exactly as it is and
keeps serving the `waterline` project.

To scope a project added later, add to its Root Directory's `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."
}
```

and set the Root Directory to match. Both halves are required.

## Confirmed working, on all four projects

On `af7d9cc` — a commit touching only `assay/` and two markdown files — Vercel
reported:

```
4 Skipped Deployments
  curieux        Ignored   (haunted)
  curieux-rifc   Ignored   (waterline)
  popuup         Ignored   (shopfront)
  waterline      Ignored   (waterline)
```

Four projects, four skips, zero builds. That is the whole mechanism working as
intended, and it is the first commit since the daily allowance reset — every
attempt before it was rejected by the quota before Vercel got as far as cloning,
which is why this took a day to observe.

A single earlier skip had been seen on `a30a7ff`, but only for `curieux-rifc`:
it was the one project with quota left, so it was the only one that got far
enough to run the command at all.

### Building is not a result — read the final state, not the first

`30d5fde` touched only this file and every project reported **Building**
seconds after the push, which looks like the scoping failing. It was not. The
ignore command runs *inside* the build phase, so a deployment that is about to
be skipped shows Building first and flips to Ignored a few seconds later. The
final state for that commit was four Ignored, the same as `af7d9cc`.

Worth writing down because the webhook stream shows every intermediate state,
and acting on the first one produces a confident wrong answer. If you are
checking whether a skip worked, wait for the comment to settle — the summary
line reads `N Skipped Deployments` when it is done.

**Also still not settled: whether an *Ignored* deployment consumes one of the
hundred.** The deployment record exists before the build is cancelled, so it
may. What is certain is that a one-directory commit no longer runs four builds
— the stated goal — but "no longer runs four builds" is weaker than "runs
none", and the paragraph above is why.

## While the quota is exhausted, none of this runs

The ignore command is part of a **build**, and a rate-limited deployment never
gets that far — Vercel rejects it before cloning, so the command is never
opened and every project reports:

```
Vercel – <project>  failure  Deployment rate limited — retry in 24 hours.
```

Four red checks in that state are not evidence that the scoping failed. They
are the reason it was added. The first push after the window resets is the
first one that actually tests it.
