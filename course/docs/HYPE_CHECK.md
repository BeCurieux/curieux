# Hype Check

`/hype`: paste a post, get a 0–100 score and the three things it leaves out
(SPEC.md → Email, keywords and lead capture). A weighted keyword rubric, no
AI call, so it costs nothing to run.

## The rubric: `content/hype/rubric.json`

The word lists are the founder's to write. What's there now is a starter
set built from the spec's categories, marked `"draft": true`.

- **signals**: what pushes the score up. Each has a `weight`, a `max` (how
  many matches count) and `patterns`: case-insensitive regular expressions.
  The starter signals are a dollar amount with a timeframe (25), passive
  (15), guaranteed (20), anyone can (15) and urgency (10).
- **omissions**: what a straight account would mention. When a post makes
  any claim at all, each omission it's missing adds its `weight` (costs 10,
  hours 10; the others 0). The first three it's missing, in file order,
  are "what it leaves out".

Score = signals (weight × matches, up to max) + missing omissions' weights
if the post claims anything, capped at 100. Under 30 "Mostly grounded",
under 60 "Some hype", otherwise "Heavy hype". The tests in
`tests/unit/hype.test.ts` show worked examples; update them with the
rubric.

Change `version` whenever the lists change, so the log shows which rubric
scored what.

## The log: `hype_checks`

Every check is stored for tuning, anonymised: emails, links, @handles and
phone numbers are replaced (`[email]`, `[link]`, `[handle]`, `[phone]`), with
no user id or IP. It stores the score, which signals fired, what was left
out and the rubric version. Only admins can read it (step 8 shows it).
