#!/usr/bin/env bash
#
# Apply every migration to a real PostgreSQL, then check that the archive
# actually keeps families apart.
#
# This exists because the migrations had never been executed by anything.
# They were reviewed, they typechecked in the sense that nothing else in the
# repo referred to a column they had not created, and the first one to be run
# in anger would have been run against somebody's archive. The run that
# introduced it failed twice on ordinary dependency ordering — a column
# cannot be dropped while a policy still mentions it, and one of those
# policies was on a different table.
#
# It needs no Supabase account and no network: it starts its own cluster,
# stubs the handful of objects Supabase provides, and throws the cluster away.
# Run it before every migration reaches a real project.
#
#   ./scripts/verify-schema.sh
#
# Set KEEP=1 to leave the database running for poking at afterwards.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PGPORT:-55432}"
PGDATA="${PGDATA:-/var/lib/postgresql/qotidia-verify}"
DB="qotidia_verify"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)"

if [ -z "$BIN" ]; then
  echo "No PostgreSQL server found. Install postgresql-16, or point this at one" >&2
  echo "with PGHOST/PGPORT and skip the cluster it would have started." >&2
  exit 1
fi

export PGHOST=/tmp PGPORT="$PORT" PGUSER=postgres

started_here=0
if ! "$BIN/pg_isready" -q 2>/dev/null; then
  echo "Starting a throwaway cluster on port $PORT…"
  id postgres >/dev/null 2>&1 || useradd -m postgres
  rm -rf "$PGDATA"; mkdir -p "$PGDATA"; chown -R postgres:postgres "$(dirname "$PGDATA")"
  su postgres -c "$BIN/initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
  su postgres -c "$BIN/pg_ctl -D $PGDATA -o '-p $PORT -k /tmp' -l $PGDATA/log start -w -t 30" >/dev/null
  started_here=1
fi

cleanup() {
  if [ "$started_here" = 1 ] && [ "${KEEP:-0}" != "1" ]; then
    su postgres -c "$BIN/pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true
    rm -rf "$PGDATA"
  fi
}
trap cleanup EXIT

psql -tAc "drop database if exists $DB" postgres >/dev/null
psql -tAc "create database $DB" postgres >/dev/null

echo
echo "Supabase primitives"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/supabase/harness/00_supabase_primitives.sql"

echo
echo "Migrations"
for f in "$HERE"/supabase/migrations/*.sql; do
  if psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>/tmp/qotidia-migrate.err; then
    echo "  ok   $(basename "$f")"
  else
    echo "  FAIL $(basename "$f")"
    grep -E "ERROR|DETAIL|HINT" /tmp/qotidia-migrate.err | head -5 | sed 's/^/       /'
    exit 1
  fi
done

echo
echo "Access"
# Notices carry the assertions; an exception anywhere aborts the whole file.
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/supabase/harness/01_access.sql" 2>&1 \
  | sed -n 's/^psql.*NOTICE:  /  /p'

tables=$(psql -tAc "select count(*) from information_schema.tables where table_schema='public'" -d "$DB")
policies=$(psql -tAc "select count(*) from pg_policies where schemaname='public'" -d "$DB")

# The one-paste file SETUP.md sends people to, applied to its own database
# and compared. It had fallen four migrations behind without anything
# noticing, which meant following the instructions exactly produced a schema
# the application cannot run against.
echo
echo "The one-paste setup file"
node "$HERE/scripts/build-setup-sql.mjs" | sed 's/^/  /'
if ! git -C "$HERE" diff --quiet -- supabase/setup.sql 2>/dev/null; then
  echo "  setup.sql was out of date and has been regenerated — commit it."
fi

psql -tAc "drop database if exists ${DB}_paste" postgres >/dev/null
psql -tAc "create database ${DB}_paste" postgres >/dev/null
psql -q -v ON_ERROR_STOP=1 -d "${DB}_paste" -f "$HERE/supabase/harness/00_supabase_primitives.sql"
if psql -q -v ON_ERROR_STOP=1 -d "${DB}_paste" -f "$HERE/supabase/setup.sql" 2>/tmp/qotidia-paste.err; then
  pt=$(psql -tAc "select count(*) from information_schema.tables where table_schema='public'" -d "${DB}_paste")
  pp=$(psql -tAc "select count(*) from pg_policies where schemaname='public'" -d "${DB}_paste")
  if [ "$pt" = "$tables" ] && [ "$pp" = "$policies" ]; then
    echo "  ok   produces the same $tables tables and $policies policies as the migrations"
  else
    echo "  FAIL setup.sql gives $pt tables / $pp policies, migrations give $tables / $policies"
    exit 1
  fi
else
  echo "  FAIL setup.sql does not apply"
  grep -E "ERROR|DETAIL" /tmp/qotidia-paste.err | head -4 | sed 's/^/       /'
  exit 1
fi

echo
echo "$tables tables, $policies row-level security policies. Schema verified."
