#!/usr/bin/env bash
# Rebuilds the WEEMAP schema from the repository's SQL files inside a
# disposable local Supabase Postgres container and fails on the first error.
# LOCAL ONLY — never point this at production.
#
#   scripts/db-bootstrap-check.sh            # fresh container, full chain
#   KEEP_DB=1 scripts/db-bootstrap-check.sh  # leave the container running
#
# Bootstrap order (the loose pre-migration files come first; production was
# built from them before numbered migrations existed):
#   schema.sql → migration_v2.sql → migration_v3.sql → migration_v4.sql
#   → migrations/NNN_*.sql in filename order
set -euo pipefail
IMAGE="${WEEMAP_PG_IMAGE:-supabase/postgres:17.6.1.166}"
NAME="weemap-bootstrap-check"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
  sleep 2
done
# pg_isready can pass before the image's init scripts finish; wait for auth.
for _ in $(seq 1 60); do
  docker exec "$NAME" psql -U postgres -tAc "select 1 from pg_proc where proname='role' and pronamespace='auth'::regnamespace" 2>/dev/null | grep -q 1 && break
  sleep 2
done

apply() {
  local file="$1"
  printf '  %-60s' "$(basename "$file")"
  if docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -X >/tmp/weemap_psql.log 2>&1 < "$file"; then
    echo ok
  else
    echo FAILED; cat /tmp/weemap_psql.log; exit 1
  fi
}

echo "Applying legacy base files"
for f in schema.sql migration_v2.sql migration_v3.sql migration_v4.sql; do apply "$ROOT/supabase/$f"; done
echo "Applying numbered migrations"
for f in "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql; do apply "$f"; done

if compgen -G "$ROOT/supabase/tests/*.sql" >/dev/null; then
  echo "Running database regression checks"
  for f in "$ROOT"/supabase/tests/*.sql; do apply "$f"; done
fi

if [ -n "${CHECK_SQL:-}" ]; then
  echo "Running $CHECK_SQL"; apply "$CHECK_SQL"
fi
echo "Bootstrap OK"
[ -n "${KEEP_DB:-}" ] || docker rm -f "$NAME" >/dev/null
