#!/usr/bin/env bash
# Writes .env.local from the running local Supabase stack.
#
# Local keys are the CLI's fixed development keys, never real credentials,
# so generating them is safer than asking anyone to copy them by hand.
# CI runs this too, which keeps a developer's setup and CI's identical.
set -euo pipefail
cd "$(dirname "$0")/.."

status="$(npx supabase status -o json 2>/dev/null)"
field() { node -e "process.stdout.write(JSON.parse(process.argv[1])[process.argv[2]] ?? '')" "$status" "$1"; }

cat > .env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$(field API_URL)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$(field PUBLISHABLE_KEY)
SUPABASE_SECRET_KEY=$(field SECRET_KEY)
SEED_PASSWORD=mavya-local-only-password
# Email goes to the local test mailbox (http://127.0.0.1:54324).
EMAIL_TRANSPORT=mailpit
MAILPIT_URL=$(field MAILPIT_URL)
EMAIL_FROM="Ovyko <hello@ovyko.test>"
APP_URL=http://localhost:3000
CRON_SECRET=local-only-cron-secret-0000000000000000
# Card payments go to Stripe's test double (docker run -p 12111:12111
# stripe/stripe-mock), never to Stripe.
STRIPE_SECRET_KEY=sk_test_localonly
STRIPE_WEBHOOK_SECRET=whsec_local_only
STRIPE_API_URL=http://localhost:12111
STRIPE_SCHOOL_PRICE_ID=price_localonly
ENV

echo "Wrote .env.local for $(field API_URL)"
