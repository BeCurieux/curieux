# Security

## Customer data isolation

Row level security is the boundary, not the app's queries. Policies and
grants are in `supabase/migrations/20261022000001_empire.sql`.
`tests/rls/rls.sql` proves them on real Postgres (run `npm run test:rls`):
another customer's rows are invisible and unchangeable; customers can't
forge model generations, grant themselves entitlements, write usage, or read
purchases or analytics; profile history is read-only; anonymous visitors see
nothing; deleting a login removes everything she owns. The local backend
mirrors the same rules and has its own test (`tests/unit/isolation.test.ts`),
and the end-to-end suite checks that one customer's studio URL is a 404 for
another.

The service-role key is used only in `SupabaseSystemRepo` and to insert
model-written generations after ownership is checked through the customer's
own client. `server-only` makes importing it from browser code a build error.

FIT Finder results (`fit_results`) follow the same rule: the RLS suite proves one customer can't read, change or create another's results, and they're deleted with her account.

## AI safety and prompt injection

- Customer text is placed only inside `<customer_data>` as JSON, with `</`
  escaped so it can't close the tag (tested).
- The system prompt tells the model to treat that block as data and ignore
  instructions in it. The model has no tools, no access to accounts, billing
  or other customers, so injected text can at worst affect her own copy.
- Every output is validated against its schema; malformed output is a
  failure, never shown.
- The claims guard flags reviews, ratings, certifications, health and eco
  claims, origin claims, delivery promises, pressure tactics and income
  claims not supported by her facts, and anything she prohibited.
- No open-ended chat. Generations are per-module, metered and limited.

## Uploads

Images only (JPEG, PNG, WebP), detected from the file's bytes, max 5 MB,
max 8 per product. Stored privately under `<user id>/<uuid>.<ext>`; the
storage policies (`20261022000002_storage.sql`) and the serving route both
check the folder is hers. Served with `nosniff` and a `default-src 'none'`
CSP. The storage migration needs Supabase's storage schema, so it isn't in
the plain-Postgres RLS run — review it by hand when changed.

## Payments

Gumroad pings are treated as hints: every sale is re-verified with Gumroad's
API before it grants anything. Pings need a secret token; the cron needs
`CRON_SECRET`. Purchases are idempotent on the sale id; a purchase already
linked to one account can't be claimed by another; the checkout reference is
HMAC-signed.

## Sessions

Supabase Auth with emailed one-time links. The local backend's cookie is
HMAC-signed, httpOnly, SameSite=Lax, and the backend refuses to start on a
Vercel production deployment.

## Before launch

- There are no passwords, so leaked-password protection doesn't apply; do
  set Supabase Auth rate limits and a custom SMTP sender.
- Set `Site URL` and redirect URLs in Supabase Auth to `APP_URL`.
- Run `npm run test:rls` against a Supabase branch database as well.
