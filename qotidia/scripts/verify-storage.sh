#!/usr/bin/env bash
#
# Drive the R2 store against a real HTTP server that actually checks the
# signatures.
#
# Why this exists, when tests/sigv4.test.ts already checks the signing
# against Amazon's own vectors: those prove the algorithm. They do not prove
# that the URL we build survives being sent — that fetch does not drop a
# header we signed, that a browser's automatic content-length matches the one
# we bound, that a 404 on delete is tolerated, that the download filename
# arrives intact. Every one of those fails as a bare 403 from Cloudflare with
# no clue which of the fourteen steps disagreed, in production, on somebody's
# upload.
#
# The stub validates with botocore rather than with our own code, so this is
# two independent implementations agreeing over the wire rather than one
# implementation agreeing with itself.
#
#   ./scripts/verify-storage.sh
#
# Needs python3 with botocore (pip install botocore). Skips, loudly, without
# it — rather than passing and appearing to have checked something.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! python3 -c "import botocore" 2>/dev/null; then
  echo "SKIPPED: botocore is not installed, so signatures cannot be independently"
  echo "checked. Install it with: pip install botocore"
  exit 1
fi

python3 "$HERE/scripts/storage/s3-stub.py" &
STUB=$!
trap 'kill $STUB 2>/dev/null || true' EXIT

# Wait for it rather than sleeping a guessed amount.
for _ in $(seq 1 50); do
  if curl -s -o /dev/null "http://127.0.0.1:9111/ping" 2>/dev/null; then break; fi
  sleep 0.1
done

echo
echo "R2 store, end to end against a signature-checking server"
cd "$HERE" && npx tsx scripts/storage/check-r2.ts
