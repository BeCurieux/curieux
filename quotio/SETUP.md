# Getting Quotio running

Assumes nothing is installed. About ten minutes.

Nothing in this walkthrough needs an account anywhere — no database, no API
keys, no card. Those are all optional swaps you can make later.

---

## Step 1 — Install Node.js

Download the **LTS** build from <https://nodejs.org> and install it with the
default options.

Check it worked. Open a terminal (**PowerShell** on Windows, **Terminal** on a
Mac) and run:

```bash
node --version
```

You should see something like `v22.11.0`. Anything from v18 up is fine.

---

## Step 2 — Get the code

```bash
cd ~/Documents
git clone https://github.com/BeCurieux/curieux.git
cd curieux/quotio
```

---

## Step 3 — Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

That's it. The homepage widget is real — click through it. Then type something
into the box below it, like:

> A calculator for my dog grooming business. Ask what size the dog is and
> whether they want nails clipped. Small dogs are $40, medium $55, large $70
> and nails are $12.

Press **Build it** and you'll land in the editor with a working widget.

---

## Step 4 — Load the demo data (optional)

If you'd rather look at a dashboard with something in it:

```bash
npm run seed
```

Then sign in at <http://localhost:3000/login> with:

```
demo@quotio.test
demo-password
```

You'll get three published widgets with a fortnight of traffic and a list of
enquiries. The account is on the Pro plan, so lead capture and analytics are
both switched on.

To start over, delete the `.data` folder and run `npm run seed` again.

---

## Where your data lives

In `.data/store.json`, inside the project folder. It's a plain JSON file — you
can open it, and you can delete it to reset everything. It's ignored by git,
so it never leaves your machine.

This is a real, persistent store, not a stub. Every feature works against it.
Swap it for Postgres when you have actual users (Step 7).

---

## Step 5 — Better widget generation (optional)

Without an API key, prompts are parsed locally: the app reads prices and
questions out of your sentence and builds the widget. It's genuinely useful and
it's what the tests run against, but a language model does a better job of
copywriting and of unusual requests.

Create a `.env.local` file in the `quotio` folder:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Restart `npm run dev`. If the model ever returns something unusable, the app
repairs it, asks again once, and then falls back to the local parser — you'll
never see a failed generation.

---

## Step 6 — Publishing and embedding

Press **Publish** in the editor. You'll be asked to create an account at that
point, and only that point — everything you built while anonymous comes with
you.

You'll then get three ways to use it:

- a link, like `http://localhost:3000/w/your-widget`
- a `<script>` tag that resizes itself as people answer
- a plain `<iframe>`

To try the script version, save this as `test.html` anywhere and open it:

```html
<!doctype html>
<h1>My website</h1>
<script src="http://localhost:3000/embed.js" async></script>
<div data-widget="your-widget-slug"></div>
```

For a real deployment, set `NEXT_PUBLIC_APP_URL` to your live domain, or the
snippets people copy will point at `localhost`.

---

## Step 7 — Postgres, for production (optional)

1. Create a free project at <https://supabase.com>.
2. Open the **SQL Editor**, paste in `supabase/migrations/0001_init.sql`, run
   it.
3. In **Settings → API**, copy the project URL and the **service_role** key.
4. Add to `.env.local`:

```bash
DATA_STORE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

The service role key bypasses row-level security, so it must only ever be set
on the server — never in a `NEXT_PUBLIC_` variable.

---

## Step 8 — Payments (optional)

Plan limits are enforced whether or not Stripe is configured. Without it, the
pricing page says card payments aren't switched on rather than showing a button
that fails.

To switch it on, create two annual prices in Stripe and add:

```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
```

Point a Stripe webhook at `https://your-domain/api/stripe/webhook` for the
events `checkout.session.completed`, `customer.subscription.updated` and
`customer.subscription.deleted`.

---

## Common problems

**`npm install` fails with a permissions error.** On Windows, close any editor
holding the folder open and try again. On a Mac, don't use `sudo` — if npm was
installed as root, reinstall Node.js from the installer.

**Port 3000 is already in use.** Run `npm run dev -- -p 3001`.

**The fonts look wrong.** DM Sans is loaded from Google Fonts. If that's
blocked, the design falls back to a similar geometric stack on purpose — the
layout won't break.

**Everything's gone.** You probably deleted `.data/store.json`. Run
`npm run seed` for the demo data back.

---

## Checks

```bash
npm run typecheck
npm test
```

And the full journey in a real browser:

```bash
npm run build
npx next start -p 3210
# in another terminal:
BASE=http://localhost:3210 node scripts/smoke.mjs
```

Screenshots of each step land in `.smoke/`.
