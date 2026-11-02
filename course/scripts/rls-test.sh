#!/usr/bin/env bash
# Applies the migrations to a scratch database on plain Postgres, with a stub
# of Supabase's auth schema, and runs the row level security tests.
#
#   RLS_DATABASE_URL  admin connection (default: local socket as postgres)
#
# Against the local Supabase stack instead:
#   RLS_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54522/postgres npm run test:rls
# (it creates and drops its own database there; the stub replaces auth).
set -euo pipefail
cd "$(dirname "$0")/.."

ADMIN_URL="${RLS_DATABASE_URL:-postgresql:///postgres}"
DB="course_rls_test"
psql_admin() { psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q "$@"; }

psql_admin -c "drop database if exists $DB" -c "create database $DB"
TEST_URL="$(echo "$ADMIN_URL" | sed -E "s#/[^/?]*(\?|$)#/$DB\1#")"

psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f tests/rls/stub-auth.sql
for file in supabase/migrations/*.sql; do
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done
for file in tests/rls/rls.sql tests/rls/schema.sql; do
  echo "  $file"
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f "$file"
done
psql_admin -c "drop database $DB"
echo "Row level security: all checks passed."
