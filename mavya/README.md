# MAVYA — Claude Code Handoff

This folder is the source-of-truth starter pack for **Mavya v0.1**.

## What to do first

1. Create an empty GitHub repository named `mavya`.
2. Copy the contents of this folder into the repository root.
3. Open the repo in Claude Code.
4. Tell Claude:

> Read `CLAUDE.md` and every file in `/docs`. Do not write product code yet. First return a concise implementation plan for M0 only, including proposed file structure, dependencies, Supabase setup, auth/RLS approach, tests, and any conflicts you see with the source-of-truth docs.

5. Review that plan before allowing implementation.
6. Implement **M0 only**.
7. Do not start M1 until M0 acceptance criteria pass.

## Product principle

The product must feel **consumer-grade on the front end and boring/reliable underneath**.

The first proof loop is:

**business creates class → child enrols → parent reports absence → Mavya finds a valid make-up → vacancy becomes available → another eligible family can claim it → instructor records progress → parent sees it beautifully.**

Everything else is secondary.
