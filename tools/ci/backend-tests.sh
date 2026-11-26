#!/usr/bin/env bash
# Run from the repository root. Only an ephemeral DB and test-generated data.
set -euo pipefail
root=$(pwd)
mkdir -p .cache/ci/backend
db="theme-api-check-${RANDOM}-$$"
cleanup() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    docker logs --tail=150 "$db" > "$root/.cache/ci/backend/database.log" 2>&1 || true
    cat "$root/.cache/ci/backend/database.log"
  fi
  docker rm -f "$db" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT
docker run -d --name "$db" -p 127.0.0.1::26257 \
  cockroachdb/cockroach:v25.4.17 start-single-node --insecure --store=type=mem,size=1GiB
ready=false
for attempt in $(seq 1 30); do
  if timeout 5s docker exec "$db" cockroach sql --insecure --execute='SELECT 1' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
if [ "$ready" != true ]; then
  echo 'CockroachDB did not become ready within the bounded startup window' >&2
  exit 1
fi
port=$(docker port "$db" 26257/tcp)
export TEST_DATABASE_URL="postgresql://root@${port}/defaultdb?sslmode=disable"
cd apps/backend
# The suite creates a unique DB and initializes it using the real table migration.
go test -count=1 -timeout=3m -v ./... 2>&1 | tee "$root/.cache/ci/backend/tests.log"
