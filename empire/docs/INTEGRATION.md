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
4. **FIT Finder.** When FIT Finder's code and source documents are
   available, it can either stay on the main site and hand off with a link
   that pre-fills onboarding (planned: `/sign-in?start=1&category=…`) or
   move into this app as a route (`content/REGISTER.md`, priority 1).
5. **Gumroad.** Existing product pages stay as they are. Add one line to
   relevant listings pointing to the studio (`MIGRATION.md`).
6. **Shared sign-in** across site and studio is not needed now; if the site
   later gains accounts, use the same Supabase project.
