#!/usr/bin/env bash
# Applies the migrations to a scratch database on plain Postgres, with a stub
# of Supabase's auth schema, and runs the row level security tests.
#
#   RLS_DATABASE_URL  admin connection (default: local socket as postgres)
#
# The storage migration needs Supabase's storage schema and is skipped here;
# its policies are four lines and reviewed by hand (docs/SECURITY.md).
set -euo pipefail
cd "$(dirname "$0")/.."

ADMIN_URL="${RLS_DATABASE_URL:-postgresql:///postgres}"
DB="empire_rls_test"
psql_admin() { psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q "$@"; }

psql_admin -c "drop database if exists $DB" -c "create database $DB"
TEST_URL="$(echo "$ADMIN_URL" | sed -E "s#/[^/?]*(\?|$)#/$DB\1#")"

psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f tests/rls/stub-auth.sql
for file in supabase/migrations/*.sql; do
  case "$file" in *_storage.sql) continue ;; esac
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f tests/rls/rls.sql
psql_admin -c "drop database $DB"
