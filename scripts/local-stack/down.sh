#!/usr/bin/env bash
# Tears down ONLY the weemap-local-* containers/network created by up.sh.
# Never touches any other container (trading-runtime-postgres,
# miles-egypt-postgres, cz-egress, etc. are left completely alone).
set -euo pipefail

STACK_DIR="$(cd "$(dirname "$0")" && pwd)"

for c in weemap-local-proxy weemap-local-rest weemap-local-db; do
  if docker ps -a --format '{{.Names}}' | grep -qx "$c"; then
    echo "==> Removing container $c"
    docker rm -f "$c" >/dev/null
  fi
done

if docker network ls --format '{{.Name}}' | grep -qx "weemap-local"; then
  echo "==> Removing network weemap-local"
  docker network rm weemap-local >/dev/null 2>&1 || true
fi

rm -f "$STACK_DIR/.ports"

echo "==> weemap local stack removed"
echo "    (.env.development.local at the repo root was left in place; delete it manually if you want)"
