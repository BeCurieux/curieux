# Integrating with herlittleempire.com

The main website wasn't available to inspect, so Empire Studio runs as its
own app and leaves the site untouched.

## Recommended setup

1. **Subdomain.** Add a CNAME `studio.herlittleempire.com` → Vercel
   (Vercel → Project → Domains shows the exact target). Set
   `APP_URL=https://studio.herlittleempire.com`.
2. **Links from the site.** Add "Empire Studio" to the site navigation and
   product pages, linking to `https://studio.herlittleempire.com/?utm_source=website`
   (or `&utm_source=fit-finder` from FIT Finder, `instagram` from bio links)
   so `/admin` shows which source converts.
3. **Brand consistency.** The studio uses the brand tokens in
   `src/app/globals.css` (ivory, oxblood, blush, ink, accent pink). If the
   site's exact fonts differ from Fraunces/Inter, change them there.
4. **FIT Finder.** Now built into the studio at `/studio/fit` (the Income Fit Test's engine, ported 1:1). With Vee's approval (it's a live listing), link to it from the Income Fit Test's Gumroad page and the kit's Start Here.
5. **Gumroad.** Existing product pages stay as they are. Add one line to
   relevant listings pointing to the studio (`MIGRATION.md`).
6. **Shared sign-in** across site and studio is not needed now; if the site
   later gains accounts, use the same Supabase project.
