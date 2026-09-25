#!/usr/bin/env bash
# Proves the production upgrade path: builds the schema only up to the level
# production is on (UPGRADE_FROM, default 028), loads legacy-shaped data
# (supabase/tests/upgrade/legacy_fixture.sql), then applies every later
# migration in order and checks the upgraded data
# (supabase/tests/upgrade/after_upgrade.sql).
# LOCAL ONLY — never point this at production.
#
#   scripts/db-upgrade-check.sh                 # 028 → latest
#   UPGRADE_FROM=034 scripts/db-upgrade-check.sh
set -euo pipefail
IMAGE="${WEEMAP_PG_IMAGE:-supabase/postgres:17.6.1.166}"
NAME="weemap-upgrade-check"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FROM="${UPGRADE_FROM:-028}"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
trap '[ -n "${KEEP_DB:-}" ] || docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
  sleep 2
done
for _ in $(seq 1 60); do
  docker exec "$NAME" psql -U postgres -tAc "select 1 from pg_proc where proname='role' and pronamespace='auth'::regnamespace" 2>/dev/null | grep -q 1 && break
  sleep 2
done

apply() {
  local file="$1"
  printf '  %-60s' "$(basename "$file")"
  if docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -X >/tmp/weemap_upgrade.log 2>&1 < "$file"; then
    echo ok
  else
    echo FAILED; cat /tmp/weemap_upgrade.log; exit 1
  fi
}

echo "Building the production-level schema (up to $FROM)"
for f in schema.sql migration_v2.sql migration_v3.sql migration_v4.sql; do apply "$ROOT/supabase/$f"; done
for f in "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql; do
  n="$(basename "$f" | cut -c1-3)"
  [ "$n" \> "$FROM" ] && break
  apply "$f"
done
echo "Loading legacy-shaped data"
apply "$ROOT/supabase/tests/upgrade/legacy_fixture.sql"
echo "Applying the release migrations"
for f in "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql; do
  n="$(basename "$f" | cut -c1-3)"
  [ "$n" \> "$FROM" ] && apply "$f"
done
echo "Checking the upgraded data"
apply "$ROOT/supabase/tests/upgrade/after_upgrade.sql"
echo "Re-applying the release migrations (a repeated or resumed window must be harmless)"
for f in "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql; do
  n="$(basename "$f" | cut -c1-3)"
  [ "$n" \> "$FROM" ] && apply "$f"
done
apply "$ROOT/supabase/tests/upgrade/after_upgrade.sql"
echo "Rollback helper (app rolled back to pre-M4 code) lifts the guards, keeps data"
apply "$ROOT/supabase/rollback/m4_app_rollback_guards.sql"
apply "$ROOT/supabase/tests/upgrade/after_rollback.sql"
echo "Upgrade OK ($FROM → $(ls "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql | tail -1 | xargs basename | cut -c1-3))"
