# Getting Qotidia running on your computer

A complete walkthrough, assuming no prior setup. Roughly 20–30 minutes the
first time. Written for Windows; Mac steps are noted where they differ.

You will need two free accounts: **Node.js** (software, not an account) and
**Supabase** (database + login + file storage). Stripe, Anthropic and
Prodigi are **not** required — the app ships with working stand-ins for all
three, so the whole product runs without them.

---

## Step 1 — Install Node.js

Download the **LTS** version from <https://nodejs.org> and install it with
the default options.

To confirm it worked, open **PowerShell** (press Start, type "powershell",
hit Enter) and run:

```powershell
node --version
```

You should see something like `v22.11.0`. Any version 18 or higher is fine.

---

## Step 2 — Get the code onto your computer

In PowerShell, pick a folder to work in and clone the repository:

```powershell
cd ~\Documents
git clone https://github.com/BeCurieux/curieux.git
cd curieux
git checkout claude/childhood-archive-mvp-j5fmet
cd qotidia
```

**No git installed?** Either install it from <https://git-scm.com>, or
download the code as a ZIP: go to the branch on GitHub, click the green
**Code** button → **Download ZIP**, unzip it, and open the `qotidia` folder
inside it in PowerShell.

---

## Step 3 — Create a Supabase project

1. Sign up at <https://supabase.com> (free tier is plenty).
2. Click **New project**.
3. Give it a name (e.g. `qotidia-dev`), choose a region near you, and set a
   database password. **Save that password somewhere** — you won't need it
   for this guide, but you will eventually.
4. Wait ~2 minutes while it provisions.

---

## Step 4 — Create the database tables

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `qotidia/supabase/setup.sql` from the code you downloaded,
   select all of it, and copy it.
4. Paste it into the Supabase SQL editor and click **Run**.

You should see "Success. No rows returned." That's correct — it built the
tables rather than fetching data.

To check: click **Table Editor** in the sidebar. You should see tables like
`subjects`, `memories`, `books`, and `little_things`. There should be 33 in
all.

> `setup.sql` is generated from `supabase/migrations/`, so it is always the
> whole schema and never a stale copy of part of it. If you are changing the
> database rather than setting it up, run `npm run verify:schema` — it
> applies every migration to a throwaway PostgreSQL, checks that one family
> genuinely cannot read another's archive, and confirms this one-paste file
> still matches the migrations. It needs no Supabase account and no network.

---

## Step 5 — Copy your Supabase keys

In Supabase, go to **Project Settings** (gear icon) → **API**. You need
three values from that page:

| On the Supabase page | What it's called |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

The `service_role` key is hidden behind a **Reveal** button. Treat it like a
password — it bypasses all security rules. It only ever lives on your own
machine in the file you're about to create.

---

## Step 6 — Create your settings file

In the `qotidia` folder, create a file named exactly **`.env.local`**
(note the leading dot). In PowerShell:

```powershell
notepad .env.local
```

Notepad will ask if you want to create it — say yes. Paste this in, filling
in the three values from Step 5:

```
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-the-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=paste-the-service-role-key-here

AI_PROVIDER=mock
PRINT_PROVIDER=mock
JOBS_SECRET=any-random-text-you-like
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Save and close. `AI_PROVIDER=mock` and `PRINT_PROVIDER=mock` are what let
the app run without AI or printing accounts.

---

## Step 7 — Install and start

```powershell
npm install
npm run dev
```

The first command takes a couple of minutes. When the second finishes,
you'll see `ready - started server on http://localhost:3000`.

Open <http://localhost:3000> in your browser. You should see the landing
page: *"They won't remember being two."*

**Leave this PowerShell window open** — closing it stops the app. To stop it
deliberately, press `Ctrl+C`.

---

## Step 8 — Load the demo family (recommended)

This creates Florence, age 2, with 41 memories — Bun Bun, the yellow boots,
strawberries, garbage trucks — so you can see the whole product without
uploading anything.

Open a **second** PowerShell window (leave the first running), and:

```powershell
cd ~\Documents\curieux\qotidia
npm run seed
```

It will print a login: **demo@ordinarytuesday.test** / **tuesday-demo-password**.

Then process the queued work — this is what generates the story clusters and
the follow-up questions:

```powershell
npm run jobs
```

Now go back to your browser, log in with the demo credentials, and you'll
land on Florence's dashboard with memories, suggested clusters and questions
waiting.

---

## What you can click through

- **Dashboard** → her year at a glance
- **Add memories** → drag in photos; watch them dedupe and process
- **The little things** → the 60-second capture flow
- **Questions** → the ones the photos can't answer
- **Create their book** → generates the structure, then `npm run jobs` again
  in the second window to build it
- **Book overview** → page thumbnails; click any page to edit
- **"Why is this here?"** → on drafted text, shows which memories support it
- **Approve → checkout → order status** → the full print path, using the
  mock printer

Whenever something says it's processing, run `npm run jobs` in the second
window to push it along. In production a scheduler does that automatically
every minute.

---

## Common problems

**"npm is not recognized"** — Node.js isn't installed, or PowerShell was
open before you installed it. Close PowerShell, open it again, retry.

**Landing page loads but signup fails** — the Supabase keys in `.env.local`
are wrong or have stray spaces. Check them, then stop (`Ctrl+C`) and restart
`npm run dev`. Changes to `.env.local` only apply on restart.

**"relation does not exist"** — Step 4 didn't complete. Re-run `setup.sql`
in the Supabase SQL Editor and read the output for errors.

**Notepad saved it as `.env.local.txt`** — Windows hides extensions. In File
Explorer: View → Show → File name extensions, then rename it to remove
`.txt`.

**Nothing happens after clicking "Create their book"** — that's expected;
the work is queued. Run `npm run jobs` and refresh.

---

## Turning on the real services later

When you're ready to move past the stand-ins, in `.env.local`:

- **Real AI** — set `AI_PROVIDER=anthropic` and add `ANTHROPIC_API_KEY=...`
  from <https://console.anthropic.com>
- **Real payments** — add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
  from your Stripe dashboard (test mode first)
- **Real printing** — set `PRINT_PROVIDER=prodigi` and add
  `PRODIGI_API_KEY`, leaving `PRODIGI_API_URL` on the sandbox until you've
  inspected physical samples

Each can be switched on independently — the app doesn't care which
combination you run.
