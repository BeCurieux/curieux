# CLAUDE.md — Empire Studio

Empire Studio is Her Little Empire's Shopify launch studio. Read
`README.md`, `docs/PLAN.md` and `content/REGISTER.md` before changing
product behaviour.

## Rules

1. **Build on what Her Little Empire already owns.** Generator methods come
   from the founder's documents (`content/REGISTER.md`,
   `src/content/methodology.ts`). Never invent source content; mark gaps.
2. **Never fabricate facts.** Generated copy states only what the customer
   supplied. Keep the claims guard (`src/lib/ai/guard.ts`) and its tests in
   step with any prompt change.
3. **Row level security is the boundary.** Never weaken a policy to make a
   feature work. Schema changes: new migration + `docs/DATA_MODEL.md` +
   `npm run test:rls`.
4. **Every AI call goes through `runGeneration`** — limits, budget,
   validation, guard, ledger. No open-ended chat.
5. **Nothing is overwritten.** Edits, regenerations and restores add
   versions.
6. **Don't unpublish or change existing Gumroad products** without the plan
   in `docs/MIGRATION.md`.
7. **Honest UI copy.** No guaranteed sales, fake scarcity, invented reviews,
   or promises about what Sidekick can do.
8. Every user-visible feature needs a test (unit or Playwright).

Next.js 16 differs from older versions: see `AGENTS.md` and
`node_modules/next/dist/docs/` before writing framework code.
