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
| `curieux` | **unconfirmed** | not yet added |
| `curieux-rifc` | **unconfirmed** | not yet added |

The last two are named after the repository rather than after a product, which
is what a project created by connecting the repo without choosing a Root
Directory looks like. Until somebody confirms which directory each is meant to
build — or that they are duplicates and one should be deleted — they have been
left alone. Scoping a project to the wrong directory stops it deploying at all,
and nothing reports that; it is discovered the next time somebody needs the
site.

To scope one once its directory is known, add to `<directory>/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."
}
```

and set the Root Directory to match. Both halves are required.

## Checking it worked

Push a commit touching one directory and watch the PR: only that project should
report a deployment. The others should show *skipped*, not *failed* — a skipped
build is a green check with no deployment behind it.

To test the command's decision locally, from inside a project directory:

```
git diff --quiet HEAD^ HEAD -- . && echo SKIP || echo BUILD
```

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
