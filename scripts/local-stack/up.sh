#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# WEEMAP SINAI — LOCAL-ONLY data stack for browser acceptance testing.
# ───────────────────────────────────────────────────────────────────────────
# NEVER connects to production Supabase. Everything runs in local Docker
# containers: a disposable Postgres (the real supabase/postgres image, so the
# schema/migrations apply exactly like production), PostgREST in front of it,
# and a tiny nginx reverse proxy so the app can call
# http://127.0.0.1:54321/rest/v1/<table> exactly like it calls a real
# Supabase project.
#
# Idempotent: safe to run twice. Reuses existing containers/network instead
# of recreating them, then always re-applies the (idempotent) migration
# chain + seed data so the catalog is guaranteed to match this repo.
#
#   scripts/local-stack/up.sh     # start/refresh the stack
#   scripts/local-stack/down.sh   # tear it down
#
# Ports (override via env vars if already taken on your machine):
#   WEEMAP_DB_PORT   (default 54329) — Postgres, for psql/pgAdmin if needed
#   WEEMAP_REST_PORT (default 54321) — the URL the app talks to (/rest/v1/*)
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STACK_DIR="$ROOT/scripts/local-stack"
IMAGE="${WEEMAP_PG_IMAGE:-supabase/postgres:17.6.1.166}"
REST_IMAGE="${WEEMAP_REST_IMAGE:-postgrest/postgrest:v12.2.8}"
NETWORK="weemap-local"
DB_CONTAINER="weemap-local-db"
REST_CONTAINER="weemap-local-rest"
PROXY_CONTAINER="weemap-local-proxy"

# Fixed LOCAL-ONLY JWT signing secret — never used against production, and
# never read from any real Supabase/Vercel env. 44 chars (>= 32 required).
JWT_SECRET="weemap-local-dev-only-jwt-signing-secret-2609"
AUTHENTICATOR_PASSWORD="weemap_local_authenticator_pw"

PORTS_FILE="$STACK_DIR/.ports"

is_port_free() {
  local port="$1"
  ! (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null
}

pick_port() {
  local start="$1" port="$1"
  for _ in $(seq 0 9); do
    if is_port_free "$port"; then echo "$port"; return 0; fi
    port=$((port + 1))
  done
  echo "ERROR: no free port found starting at $start" >&2
  exit 1
}

echo "==> Resolving ports"
if [ -f "$PORTS_FILE" ]; then
  # Reuse the ports recorded from a previous run, so the URL stays stable.
  # shellcheck disable=SC1090
  source "$PORTS_FILE"
else
  DB_PORT="${WEEMAP_DB_PORT:-$(pick_port 54329)}"
  REST_PORT="${WEEMAP_REST_PORT:-$(pick_port 54321)}"
  printf 'DB_PORT=%s\nREST_PORT=%s\n' "$DB_PORT" "$REST_PORT" > "$PORTS_FILE"
fi
echo "    DB_PORT=$DB_PORT  REST_PORT=$REST_PORT"

echo "==> Ensuring docker network '$NETWORK'"
docker network create "$NETWORK" >/dev/null 2>&1 || true

echo "==> (Re)creating Postgres container '$DB_CONTAINER'"
# Always rebuilt from scratch rather than reused: schema.sql (the legacy
# base file, pre-dating this repo's migrations) issues bare CREATE POLICY
# statements with no DROP POLICY IF EXISTS guard, so replaying the full
# schema+migrations+seed chain against an already-initialized database
# fails on the second run. Recreating the container each time keeps up.sh
# trivially idempotent and guarantees the DB always matches this repo
# exactly — this is a disposable local stack, so the rebuild cost (~30s) is
# an acceptable trade for correctness.
docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$DB_CONTAINER" \
  --network "$NETWORK" \
  -e POSTGRES_PASSWORD=postgres \
  -p "${DB_PORT}:5432" \
  "$IMAGE" >/dev/null

echo "==> Waiting for Postgres to accept connections"
for _ in $(seq 1 60); do
  docker exec "$DB_CONTAINER" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
  sleep 2
done
# The supabase/postgres image restarts once after its own init scripts run —
# wait for that to settle by checking for the auth schema it creates.
for _ in $(seq 1 60); do
  docker exec "$DB_CONTAINER" psql -U postgres -tAc \
    "select 1 from pg_proc where proname='role' and pronamespace='auth'::regnamespace" 2>/dev/null \
    | grep -q 1 && break
  sleep 2
done

apply_sql() {
  local file="$1"
  printf '    %-55s' "$(basename "$file")"
  if docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -X \
      >/tmp/weemap_local_psql.log 2>&1 < "$file"; then
    echo ok
  else
    echo FAILED
    cat /tmp/weemap_local_psql.log
    exit 1
  fi
}

echo "==> Applying legacy base schema"
for f in schema.sql migration_v2.sql migration_v3.sql migration_v4.sql; do
  apply_sql "$ROOT/supabase/$f"
done

echo "==> Applying numbered migrations (001-033)"
for f in "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql; do
  apply_sql "$f"
done

echo "==> Applying local acceptance seed data"
apply_sql "$ROOT/supabase/dev/local-seed.sql"

echo "==> Setting authenticator role password (for PostgREST)"
# authenticator is a reserved role in the supabase/postgres image — only a
# superuser can ALTER it. The "postgres" role here is NOT a superuser
# (supabase_admin is), matching production's privilege layout.
docker exec "$DB_CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -X \
  -c "ALTER ROLE authenticator WITH LOGIN PASSWORD '${AUTHENTICATOR_PASSWORD}';" >/dev/null

echo "==> Reloading PostgREST schema cache"
docker exec "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -X \
  -c "NOTIFY pgrst, 'reload schema';" >/dev/null

echo "==> Ensuring PostgREST container '$REST_CONTAINER'"
docker rm -f "$REST_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$REST_CONTAINER" \
  --network "$NETWORK" \
  -e PGRST_DB_URI="postgres://authenticator:${AUTHENTICATOR_PASSWORD}@${DB_CONTAINER}:5432/postgres" \
  -e PGRST_DB_SCHEMAS="public" \
  -e PGRST_DB_ANON_ROLE="anon" \
  -e PGRST_JWT_SECRET="${JWT_SECRET}" \
  -e PGRST_DB_USE_LEGACY_GUCS="false" \
  "$REST_IMAGE" >/dev/null

echo "==> Ensuring reverse proxy container '$PROXY_CONTAINER'"
docker rm -f "$PROXY_CONTAINER" >/dev/null 2>&1 || true
# MSYS_NO_PATHCONV, scoped to this one command only: git-bash/MSYS on
# Windows otherwise mangles the container-side path in the -v mount spec
# (e.g. turns /etc/nginx/... into a bogus Windows path with a ';' instead of
# ':'). Scoping it (rather than exporting it for the whole script) keeps
# `node` and other native Windows tools below getting normal POSIX->Windows
# path conversion for their own arguments.
MSYS_NO_PATHCONV=1 docker run -d --name "$PROXY_CONTAINER" \
  --network "$NETWORK" \
  -p "${REST_PORT}:80" \
  -v "$STACK_DIR/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:alpine >/dev/null

echo "==> Waiting for PostgREST to come up behind the proxy"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${REST_PORT}/rest/v1/" 2>/dev/null || echo 000)
  [ "$code" != "000" ] && break
  sleep 1
done

echo "==> Generating local service-role JWT"
SERVICE_ROLE_JWT=$(node "$STACK_DIR/make-jwt.mjs" --role service_role --secret "$JWT_SECRET")

ENV_FILE="$ROOT/.env.development.local"
cat > "$ENV_FILE" <<EOF
# LOCAL DOCKER STACK ONLY — generated by scripts/local-stack/up.sh — never production
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${REST_PORT}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_JWT}
EOF
echo "==> Wrote $ENV_FILE"

echo "==> Verifying: fetching accommodations"
VERIFY=$(curl -s \
  -H "apikey: ${SERVICE_ROLE_JWT}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_JWT}" \
  "http://127.0.0.1:${REST_PORT}/rest/v1/accommodations?select=id,name_en")
echo "$VERIFY" | node -e "
  let data='';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    try {
      const rows = JSON.parse(data);
      if (!Array.isArray(rows)) throw new Error('not an array: ' + data);
      console.log('    accommodations rows: ' + rows.length);
    } catch (e) {
      console.error('    verification FAILED: ' + e.message);
      process.exit(1);
    }
  });
"

echo ""
echo "==> weemap local stack is up"
echo "    REST URL:  http://127.0.0.1:${REST_PORT}"
echo "    DB port:   ${DB_PORT} (psql -h 127.0.0.1 -p ${DB_PORT} -U postgres)"
echo "    Env file:  $ENV_FILE"
echo "    Down:      scripts/local-stack/down.sh"
