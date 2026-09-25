#!/usr/bin/env bash
# Toggles the merch/rental inventory fixture on top of the local stack, so
# you can verify the storefront renders active products purely from data —
# no code changes required.
#
#   scripts/local-stack/inventory.sh on    # 4 merch + 3 rental products, active
#   scripts/local-stack/inventory.sh off   # deactivates them (0 active again)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_CONTAINER="weemap-local-db"
MODE="${1:-}"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "ERROR: $DB_CONTAINER is not running. Run scripts/local-stack/up.sh first." >&2
  exit 1
fi

case "$MODE" in
  on)
    echo "==> Applying supabase/dev/local-seed-inventory.sql (4 merch + 3 rental products, active)"
    docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -X \
      < "$ROOT/supabase/dev/local-seed-inventory.sql"
    echo "==> Inventory ON"
    ;;
  off)
    echo "==> Deactivating inventory fixture products"
    docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -X <<'SQL'
UPDATE public.commerce_products SET is_active = false
WHERE id IN (
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000002',
  '31000000-0000-4000-8000-000000000003',
  '31000000-0000-4000-8000-000000000004',
  '32000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000002',
  '32000000-0000-4000-8000-000000000003'
);
NOTIFY pgrst, 'reload schema';
SQL
    echo "==> Inventory OFF"
    ;;
  *)
    echo "Usage: scripts/local-stack/inventory.sh on|off" >&2
    exit 1
    ;;
esac
