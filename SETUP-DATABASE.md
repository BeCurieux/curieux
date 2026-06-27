# Connect Skippr to a database (so bookings save)

This makes bookings, trip edits, and settings stick instead of resetting on
refresh. It uses **Supabase** — a free hosted database. ~10 minutes, no coding.

You'll know it worked when the top bar of the app changes from
**"Demo mode · not saving"** to **"Saving to database"**.

---

## 1. Create a Supabase project
1. Go to **https://supabase.com** and sign up (free).
2. Click **New project**. Give it a name (e.g. `skippr`), set a database
   password (save it somewhere), pick the region closest to you, and create it.
3. Wait ~2 minutes for it to finish setting up.

## 2. Create the tables
1. In your project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase/schema.sql` from the project, copy **all** of it, and
   paste it into the editor.
4. Click **Run**. You should see "Success". (This builds the tables and adds the
   demo charter — Capt. Mick, the three trips, the week's bookings.)

## 3. Get your two keys
1. Click **Settings** (gear icon) → **API**.
2. Copy two things:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

## 4. Put the keys into the app
1. In the project folder, find the file `.env.example`. Make a copy of it named
   exactly **`.env`** (same folder).
2. Open `.env` in a text editor and fill in the two values:
   ```
   VITE_SUPABASE_URL=https://abcdxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your-long-key...
   ```
3. Save the file.

## 5. Restart and check
1. If `npm run dev` is running, stop it (`Ctrl + C`) and start it again:
   ```
   npm run dev
   ```
2. Open **http://localhost:5173/skippr.html**.
3. Top bar should now say **"Saving to database"**.
4. Test it: go to **Customer booking**, make a booking, then **refresh the
   page** — your booking is still there. It also shows up under the captain's
   **Customers** and **Payments**. 🎉

---

## When you deploy it later
Add the same two variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in
your host's environment settings (e.g. Vercel → Project → Settings → Environment
Variables). Don't commit the `.env` file — it's already git-ignored.

## Before real customers use it
The database is currently open (anyone with the link can read/write) so the demo
works without logins. Before launch, add captain login (Supabase Auth) and
tighten the access rules at the bottom of `supabase/schema.sql`. Happy to do this
when you're ready.
