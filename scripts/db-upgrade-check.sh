#!/usr/bin/env bash
# Rehearses the production upgrade in a disposable local container.
# LOCAL ONLY — never point this at production.
#
#   scripts/db-upgrade-check.sh                          # production profile (default)
#   UPGRADE_PROFILE=legacy scripts/db-upgrade-check.sh   # legacy money/pickup data
#
# production: builds the repository chain up to 028, reshapes it into the
#   schema the M4 read-only preflight measured on production
#   (supabase/tests/upgrade/production_shape.sql) and PROVES the match against
#   the stored production catalog fingerprint (production_inventory.txt),
#   loads production-shaped synthetic data, applies 029 → latest, checks,
#   re-applies everything (idempotency), checks again, then runs the
#   application-rollback helper.
# legacy: same chain on 028 as built from the repository, with legacy-shaped
#   money/pickup data (legacy_fixture.sql / after_upgrade.sql).
set -euo pipefail
IMAGE="${WEEMAP_PG_IMAGE:-supabase/postgres:17.6.1.166}"
NAME="weemap-upgrade-check"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FROM="028"
PROFILE="${UPGRADE_PROFILE:-production}"
UP="$ROOT/supabase/tests/upgrade"

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
sleep 3

apply() {
  local file="$1"
  printf '  %-60s' "$(basename "$file")"
  if docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -X >/tmp/weemap_upgrade.log 2>&1 < "$file"; then
    echo ok
  else
    echo FAILED; cat /tmp/weemap_upgrade.log; exit 1
  fi
}

release() {
  for f in "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql; do
    n="$(basename "$f" | cut -c1-3)"
    if [ "$n" \> "$FROM" ]; then apply "$f"; fi
  done
}

echo "Building the repository chain up to $FROM"
for f in schema.sql migration_v2.sql migration_v3.sql migration_v4.sql; do apply "$ROOT/supabase/$f"; done
for f in "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql; do
  n="$(basename "$f" | cut -c1-3)"
  if [ "$n" \> "$FROM" ]; then break; fi
  apply "$f"
done

if [ "$PROFILE" = production ]; then
  echo "Reshaping into the measured production schema"
  apply "$UP/production_shape.sql"
  printf '  %-60s' "catalog fingerprint = production_inventory.txt"
  docker exec -i "$NAME" psql -U postgres -X -A -t < "$UP/inventory_hash.sql" | tr -d '\r' | sed '/^$/d' | sort > /tmp/weemap_shape.txt
  tr -d '\r' < "$UP/production_inventory.txt" | grep -v '^#' | sed '/^$/d' | sort > /tmp/weemap_prod.txt
  if diff -q /tmp/weemap_prod.txt /tmp/weemap_shape.txt >/dev/null; then
    echo "ok ($(wc -l < /tmp/weemap_prod.txt) objects)"
  else
    echo FAILED; diff /tmp/weemap_prod.txt /tmp/weemap_shape.txt; exit 1
  fi
  echo "Loading production-shaped synthetic data"
  apply "$UP/production_fixture.sql"
  CHECK="$UP/after_upgrade_production.sql"; ROLLBACK_CHECK="$UP/after_rollback_production.sql"
else
  echo "Loading legacy-shaped data"
  apply "$UP/legacy_fixture.sql"
  CHECK="$UP/after_upgrade.sql"; ROLLBACK_CHECK="$UP/after_rollback.sql"
fi

echo "Applying the release migrations"
release
echo "Checking the upgraded database"
apply "$CHECK"
echo "Re-applying the release migrations (a repeated or resumed window must be harmless)"
release
apply "$CHECK"
echo "Rollback helper (app rolled back to pre-M4 code) lifts the guards, keeps data"
apply "$ROOT/supabase/rollback/m4_app_rollback_guards.sql"
apply "$ROLLBACK_CHECK"
echo "Upgrade OK ($PROFILE: $FROM → $(ls "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql | tail -1 | xargs basename | cut -c1-3))"
