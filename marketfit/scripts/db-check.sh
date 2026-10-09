#!/usr/bin/env bash
# Applies the migration and the rules seed to a throwaway local Postgres and
# runs the RLS checks in supabase/tests/rls.sql against it.
#
# Needs Postgres server binaries (initdb, pg_ctl). Uses a temporary cluster on
# a unix socket only; nothing touches a real Supabase project.
set -euo pipefail
cd "$(dirname "$0")/.."

BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [[ -z "$BIN" || ! -x "$BIN/initdb" ]]; then
  echo "db:check needs Postgres server binaries; set PG_BIN to their directory." >&2
  exit 2
fi

DIR="$(mktemp -d)"
RUN_AS=()
if [[ "$(id -u)" == "0" ]]; then
  # initdb refuses to run as root.
  chown postgres "$DIR"
  RUN_AS=(runuser -u postgres --)
fi
cleanup() { "${RUN_AS[@]}" "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$BIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$BIN/pg_ctl" -D "$DIR/data" -o "-k $DIR -c listen_addresses=''" -w start >/dev/null

PSQL=(psql -h "$DIR" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f supabase/tests/supabase-stub.sql
for migration in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$migration"; done
"${PSQL[@]}" -f supabase/seed.sql
"${PSQL[@]}" -o /dev/null -f supabase/tests/rls.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
echo "db:check passed: migration, seed and RLS"
