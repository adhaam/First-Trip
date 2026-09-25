# WEEMAP SINAI — local data stack

**LOCAL ONLY.** This stack never touches production Supabase. Everything
runs in disposable Docker containers on your machine:

- `weemap-local-db` — the real `supabase/postgres:17.6.1.166` image, so the
  schema/migrations apply exactly like production. Host port `54329`.
- `weemap-local-rest` — PostgREST (`postgrest/postgrest:v12.2.8`) in front
  of it, connected as the `authenticator` role.
- `weemap-local-proxy` — a tiny `nginx:alpine` reverse proxy so the app can
  call `http://127.0.0.1:54321/rest/v1/<table>` exactly like it calls a real
  Supabase project (supabase-js always requests `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/...`).
  `/storage/v1/*` returns a graceful 404 (this stack has no storage service).

## Usage

```bash
scripts/local-stack/up.sh      # start/refresh the stack (idempotent — safe to re-run)
scripts/local-stack/down.sh    # remove only the weemap-local-* containers/network
scripts/local-stack/inventory.sh on   # add 4 active merch + 3 active rental products
scripts/local-stack/inventory.sh off  # deactivate them again (back to 0 active)
```

`up.sh`:

1. (Re)creates `weemap-local-db` from scratch, applies `supabase/schema.sql`
   → `migration_v2.sql` → `migration_v3.sql` → `migration_v4.sql` →
   `supabase/migrations/001..033_*.sql` in order (same approach/order as
   `scripts/db-bootstrap-check.sh`), then `supabase/dev/local-seed.sql`.
2. Sets the `authenticator` role's password (it's a reserved role in the
   supabase/postgres image — only the `supabase_admin` superuser can alter
   it; the `postgres` role used for migrations is *not* a superuser here,
   matching production's privilege layout).
3. Starts/replaces PostgREST and the nginx proxy.
4. Generates a local `service_role` JWT (`scripts/local-stack/make-jwt.mjs`,
   HS256, signed with a fixed local-only secret) and writes
   `.env.development.local` at the repo root (gitignored):
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_SERVICE_ROLE_KEY=<generated jwt>
   ```
5. Verifies `accommodations` returns 6 rows through the proxy.

**The DB container is always recreated, not reused**, even on a second run —
`supabase/schema.sql` (the legacy pre-migrations base file) issues bare
`CREATE POLICY` statements with no `DROP POLICY IF EXISTS` guard, so
replaying the chain against an already-initialized database fails. Rebuilding
from scratch each time keeps `up.sh` trivially idempotent and guarantees the
DB always matches this repo exactly. This also means **re-running `up.sh`
resets all seeded data**, including anything the running app wrote against it
(test bookings, orders, etc.) — expected for a disposable acceptance-testing
DB, not something to rely on for anything you want to keep.

Ports are recorded in `scripts/local-stack/.ports` (gitignored-by-convention,
not committed) so they stay stable across runs; override with
`WEEMAP_DB_PORT` / `WEEMAP_REST_PORT` env vars before the first run if
`54329` / `54321` are already taken on your machine.

## What the seed contains (`supabase/dev/local-seed.sql`)

Deterministic, fixed-UUID, bilingual (Arabic + English) fixtures:

- `site_settings` (row `id=1`): WhatsApp/contact info, SEO copy, payment
  instructions — updates the row the migration chain already creates.
- 6 Dahab **accommodations** (camp/chalet/hotel, budget/standard/premium/
  lagoon tiers), each with 3-4 images, bilingual descriptions/amenities,
  room prices, 4 meal plans, one seasonal rate, 3 room upgrades.
- 10 **Sinai trips** across all 6 trip categories (Sea & Snorkeling, Desert &
  Safari, Mountains & Hiking, Culture & Bedouin, Night Experiences, Day
  Escapes — the two V2 categories are activated by this seed, since
  migration 033 seeds them inactive) with multi-tag category membership.
- 4 **trip packages**: 2 `stay_package` ("Dahab Stay Packages" category) + 2
  `experience_package` ("Sinai Experience Packages" category), every
  included trip has a valid `package_price` so `getTripPackages()` treats
  all 4 as valid/publishable.
- 6 **community posts** (2 `blog`, 2 `dahab-guide`, 1 `hidden-gems`, 1
  `stories` — the only 4 categories the DB's `CHECK` constraint actually
  allows; see "Schema surprises" below), multi-paragraph bilingual content.
- 3 **signature experiences** (honeymoon, dive-journey, kite-escape
  categories) with itineraries, galleries, and open dates.
- 4 **commerce categories**, 2 **delivery zones**, and **zero** active
  merch/rental products (intentional empty state — see `inventory.sh`).
- 2 additional **testimonials** (on top of `migration_v3.sql`'s 3 seeded
  placeholders — this file truncates `testimonials`, so the total after
  seeding is 2, not 5).

`supabase/dev/local-seed-inventory.sql` (applied only via `inventory.sh on`):
4 active merch products (t-shirt, scarf, dive mask/snorkel set, water
bottle — with size/color variants and stock) and 3 active rental products
(scuba gear set, mountain bike, kayak — with 1/3/7-day rental tiers).

All images are `https://images.unsplash.com/photo-<id>?w=1600&q=80` URLs,
each verified with `curl -sI` to return HTTP 200 before use.

## Schema surprises found while building this

- **`community_posts.category` CHECK is narrower than the TypeScript
  `PostCategory` type.** The DB constraint (from `supabase/schema.sql`,
  never widened by any migration) only allows `'blog' | 'hidden-gems' |
  'stories' | 'dahab-guide'`. `src/lib/types.ts`'s `PostCategory` union lists
  14 values. Migration 019's own header comment confirms production only
  ever used those same 4 values ("confirmed live in production with 30
  published rows across 4 of the 14 PostCategory values"), so this seed only
  uses the 4 the database actually accepts.
- `trip_categories` seeds `culture-bedouin` and `night-experiences` as
  **inactive** (migration 033) — this seed activates both, since the task's
  requested taxonomy needs all 6 categories live.
- `authenticator` is a reserved role in the `supabase/postgres` image itself
  (an event trigger blocks `ALTER ROLE` on it from a non-superuser) — the
  `postgres` role this repo's tooling normally connects as is *not* a
  superuser here; only `supabase_admin` can set its password.
- Running under git-bash/MSYS on Windows, `docker run -v <path>:<container-path>`
  gets its container-side path silently mangled (e.g. `/etc/nginx/...`
  becomes a bogus `C:\...` path with a `;` instead of `:`) unless
  `MSYS_NO_PATHCONV=1` is set for that specific command — `up.sh` scopes this
  to only the one `docker run` that needs it, since setting it shell-wide
  also breaks native Windows tools like `node` resolving their own script
  path arguments.

## Nothing else is started

`up.sh` does not run `next dev` — start that yourself once the stack is up
and `.env.development.local` exists.
