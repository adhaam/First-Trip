# Migrations

Files apply in filename order. Running all of them against an empty database
must reproduce production.

## Read this before adding a migration

**Check production first.** Several migrations were applied to the live
database but never committed here, and the gap was invisible because the
numbering had already collided — two different `017`s, two `018`s, two `019`s
existed at once. The trip-discount work walked straight into it: the code was
written against a `discount_type` vocabulary that did not match the CHECK
constraint already live in production, and would have failed on the first
save.

To see what is actually applied:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Anything in that list without a counterpart here is drift. The full SQL of
each applied migration is kept in the `statements` column of the same table,
so a missing one can be recovered rather than rewritten from memory.

## Numbering

Use the next free number. Never reuse one — a duplicate number is what hid
the drift above.

Files `023`–`027` are recoveries: their numbers reflect the order they apply
in on a fresh database, not when they were originally applied to production.
Each carries a header naming its real version and date. They are all `ALTER`s
and a view over tables created much earlier, so applying them last is
equivalent to the order production saw.

| File | Applied to production as | On |
|---|---|---|
| `023_accommodations_rating_allow_decimal` | `accommodations_rating_allow_decimal` | 2026-08-23 |
| `024_discounts_and_payment_tracking` | `017_discounts_and_payment_tracking` | 2026-08-25 |
| `025_site_settings_payment_instructions` | `018_site_settings_payment_instructions` | 2026-08-25 |
| `026_commerce_orders_discount_payment` | `019_commerce_orders_discount_payment` | 2026-08-25 |
| `027_experience_availability_view` | part of `016_signature_experiences` + `016a_…_security_invoker` | 2026-08-24 |

Note that `011_room_variants_schema.sql` is the room **upgrades** schema —
production recorded it as `011_room_upgrades_schema`. The filename is
misleading but the content matches; left as-is to avoid breaking the
correspondence with the applied version.

## Rebuilding from scratch

Files apply in a fixed bootstrap order: `supabase/schema.sql` →
`migration_v2.sql` → `migration_v3.sql` → `migration_v4.sql` →
`migrations/NNN_*.sql` in filename order. The loose files predate numbered
migrations — production was built from them before this folder existed.

`bash scripts/db-bootstrap-check.sh` proves the chain rebuilds cleanly by
running it, in that order, against a disposable local Supabase/Postgres
Docker container and failing on the first error. **LOCAL ONLY — never point
it at production.** `KEEP_DB=1` leaves the container running afterwards for
inspection; `CHECK_SQL=<path>` applies one more file at the end (e.g. a
migration you're drafting) as part of the same check.

`npm run check:migrations` (`scripts/check-migrations.ts`) is a fast,
Docker-free CI gate that enforces unique, contiguous numbering from `001` and
that every file opens with a header comment — it does not execute any SQL.

Migration `001` was made re-runnable (`DROP POLICY IF EXISTS` /
`DROP TRIGGER IF EXISTS` before creating them) purely so the chain applies
cleanly to an empty database; this does not change what the database looks
like once `001` has run.

## M1 foundation migrations (029–033)

- **029 — transport schedule.** Adds the operating schedule for transport
  services (weekly rules, date exceptions, scheduled vs. on-demand mode) and
  the commercial stay patterns WEEMAP actually sells, replacing weekday
  constants that used to live in code. Read by `src/lib/transport`.
- **030 — payment policies.** Adds `payment_policies` / `payment_methods` and
  an explicit `payment_kind` column on `trip_packages`, `bookings` and
  `trip_bookings`. Read by `src/lib/payment-rules.ts`. The payment kind is
  always **stored**, never inferred from the word "package": a Dahab **stay**
  package (`stay_package`) pays 50% after availability confirmation / 50% on arrival like a plain
  stay, while a Sinai **experience** package (`experience_package`, e.g.
  yacht + safari + Blue Hole) pays 100% after confirmation like a standalone trip. On
  insert a trigger always derives `payment_kind` from the booking type or the
  package catalogue — a caller-supplied value is ignored — and afterwards the
  stored kind is immutable (only a deliberate maintenance transaction with
  `set_config('weemap.payment_kind_maintenance', 'on', true)` can correct
  one). The same migration backfills existing rows once.
  `supabase/tests/payment_kind_invariants.sql`, run by the bootstrap check,
  proves both rules.
- **031 — request workflow, history, events.** Adds the
  `checking_availability` / `alternatives_required` / `awaiting_payment`
  states (allowed transitions enforced by `src/lib/request-workflow.ts`), the
  `status_history` table, and the `domain_events` outbox
  (`src/lib/domain-events.ts` mirrors the event vocabulary). Both
  `status_history` and `domain_events` are written by a single trigger in the
  **same transaction** as the status/payment_status change, so they cannot
  drift from the row. Nothing consumes `domain_events` yet — it is a pure
  outbox awaiting a future publisher.
- **032 — trip requests.** Adds `trip_requests`, the structured record of a
  submitted Trip Builder journey (origin, transport, dates, stay,
  experiences), read and written by `src/lib/trip-requests`. It is not a
  replacement for `bookings` / `trip_bookings`: confirming a request creates
  or links the concrete booking rows.
- **033 — trip category tags.** Adds `sinai_trip_category_tags`, letting a
  trip belong to several categories instead of one, read by
  `src/lib/trip-categories.ts`. `sinai_trips.trip_category_id` remains the
  primary category; the migration backfills each trip's primary category as
  one of its tags.

## M2 correction (034)

- **034 — trip packages are Sinai experience packages.** A `trip_package` is
  a bundle of Sinai trips and is paid like a trip (100% after confirmation):
  its `payment_kind` is normalised to and constrained to
  `experience_package`. `stay_package` remains only the internal
  classification of a transport + stay booking (`bookings`, trip-request
  payment parts). Apply it together with `029`–`033`.

## M3 Operations Center (035–036)

- **035 — staff identity and audit.** Adds `staff_users` (owner / admin /
  operations, scrypt password hashes, a `session_version` that a trigger bumps
  on disable / role / email / password change so old sessions die, and a
  trigger that refuses to remove the last active owner) and
  `weemap_current_actor()`, which trusts the `x-weemap-actor` header **only**
  on service-role requests. The 031 request trigger now records that actor in
  `status_history` and in event payloads. `audit_log` records every catalogue,
  pricing, transport, settings and staff change, plus field edits and deletes
  on request tables, in the same transaction. It redacts password hashes and
  summarises long text. See `docs/m3/OPERATIONS.md` for the transition from
  the shared password.
- **036 — Operations Center.** Adds `payment_records`, an append-only ledger
  written only by `weemap_record_payment()`. That function locks the row,
  rejects a stale caller, refuses money before availability is confirmed and
  any over-payment or over-refund, and derives `payment_status`. It never
  touches `payment_kind`. `weemap_convert_trip_request()` turns a confirmed
  Trip Builder request into a stay/transport `bookings` row plus one
  `trip_bookings` row per experience. It prices them from the frozen snapshot,
  keeps provenance and is idempotent via unique indexes. The migration also
  adds `trip_requests.internal_notes` / `converted_at` / `converted_by`, the
  customer domain events and the read-only `ops_work_items` queue view.
  `supabase/tests/operations_center.sql` proves the invariants inside a rolled
  back transaction.

## M3 Discovery (037)

- **037 — community discovery links.** `community_post_links` lets an
  operator curate "this guide is about that stay/trip/package/Signature
  experience" links (`target_type` in `stay | trip | trip_package |
  signature_experience`, `target_id` is that row's id in its own table — no
  cross-table FK, existence is checked in the admin API instead). Powers the
  community article's "Plan it with WEEMAP" block and the reverse "Local
  guides" block on stay/trip/package detail pages. Public read, service-role
  write RLS, same pattern as `033`. 035 and 036 are reserved for the Ops
  Center track and intentionally skipped here.

- **038 — public search documents.** `weemap_search_normalize()` folds the
  Arabic spelling variants people type (hamza forms, ى/ي, ة/ه, diacritics,
  tatweel) and lower-cases. `public_search_documents` is a view over public
  rows only (active stays, trips, Sinai packages and products; published
  community posts), and public search requires every query token in its
  normalised text. It must stay identical to `normalizeSearchText()`, which
  `supabase/tests/public_search.sql` checks.

## M4 launch hardening (039–041)

- **039 — commerce workflow integrity.** The order status graph lives in the
  database (`weemap_commerce_order_guard`): delivery goes ready →
  out_for_delivery → completed, pickup goes ready → completed and is never
  out for delivery. Order creation (`weemap_place_commerce_order`), status
  changes with their stock effects (`weemap_set_commerce_order_status`:
  restock on cancel, re-reserve on reopen, exactly once) and rental
  reservation moves (`weemap_update_rental_reservation`: availability checked
  under the product lock, so two operators can never both confirm the last
  unit) are each one transaction. Errors are `PT409`/`PT404`/`PT400` with a
  machine message (`stale_status`, `invalid_transition`,
  `insufficient_stock:<variant>`, `rental_unavailable:<product>`, …).
  `src/lib/request-workflow.test.ts` checks the TS graph equals the SQL one.
- **040 — payment truth guards.** `amount_paid` / `payment_status` change only
  inside `weemap_record_payment()`. The agreed total cannot drop below the
  money received (`total_below_paid`), and raising it re-derives paid ↔
  partial. A row inserted with money already received gets an opening ledger
  entry, rows with ledger entries cannot be deleted (`has_payments`), and no
  payment may be dated in the future. **One-off data change:** rows whose
  `amount_paid` exceeds their ledger balance (money typed in before 036)
  get one `received` entry for the difference, `recorded_by =
  'migration:040'`, so `amount_paid = Σ received − Σ refunded` holds for
  every row. Re-running inserts nothing.
- **041 — security hardening.** Drops the pre-M1 `authenticated` "Admins can
  manage …" policies and the anon INSERT policies (bookings, customers,
  Signature requests, partner inquiries, newsletter). Revokes every write
  privilege and every WEEMAP function EXECUTE from `anon` /
  `authenticated`, and SELECT on tables without a public-read policy, and
  sets the same defaults for future objects. Adds `staff_login_throttle`
  (sign-in throttle shared by all server instances; hashed keys only) and
  lets sign-out raise `session_version` (never lower it). The app uses only
  the service role, so nothing it does changes.

`scripts/db-upgrade-check.sh` proves the production path: schema up to 028,
legacy-shaped data (money without a ledger, a total below the money
received, a pickup order already out for delivery), then 029–041, checks,
a second full re-apply (idempotency), and the application-rollback helper.

## Production procedure — M4 release (029 → 041)

Production is on 028 (confirm in step 2). Apply in one maintenance window,
immediately followed by the application deploy.

1. **Freeze.** No catalogue or booking edits in the Operations Center during
   the window (15–30 min). The public site stays up.
2. **Confirm the starting point** (read-only):
   `select version, name from supabase_migrations.schema_migrations order by version;`
   — the latest entry must correspond to `028`; anything newer and unknown is
   drift: stop.
3. **Back up** (either, and keep the file):
   - Dashboard → Database → Backups → confirm a backup from today exists
     (paid plans), **and/or**
   - `pg_dump --no-owner --format=custom "<production connection string>" -f weemap-pre-m4.dump`
     then `pg_restore --list weemap-pre-m4.dump | wc -l` (non-empty) and
     record row counts of `bookings`, `trip_bookings`, `experience_bookings`,
     `commerce_orders`, `customers`.
4. **Apply** `029` … `041` in filename order, each as its own transaction
   (SQL editor or `psql -v ON_ERROR_STOP=1 -f`). Stop at the first error:
   everything before it is committed and re-runnable, so fix forward and
   re-run from the failed file.
5. **Verify:**
   ```sql
   select count(*) from pg_policies where schemaname='public'
     and (coalesce(qual,'')||coalesce(with_check,'')) like '%authenticated%';   -- 0
   select has_table_privilege('anon','public.customers','SELECT');             -- false
   select proname from pg_proc where proname in ('weemap_place_commerce_order',
     'weemap_set_commerce_order_status','weemap_update_rental_reservation',
     'weemap_login_throttle_check','weemap_record_payment','weemap_convert_trip_request');  -- 6 rows
   select count(*) from payment_records where recorded_by = 'migration:040';  -- = rows that had money
   select count(*) from (select t.id from bookings t left join payment_records p
     on p.entity_type='accommodation_booking' and p.entity_id=t.id group by t.id, t.amount_paid
     having coalesce(t.amount_paid,0) <> coalesce(sum(case p.direction when 'received'
     then p.amount else -p.amount end),0)) x;                                  -- 0
   select doc_type, count(*) from public_search_documents group by 1;
   ```
6. **Deploy** the M4 application (see `docs/m4/RELEASE.md`).
7. **Bootstrap the owner** (`docs/m3/OPERATIONS.md` → transition): sign in
   with the shared password (email empty), create the owner, sign out, sign
   in as the owner. Only then remove `ADMIN_PASSWORD` from Vercel.

**Rollback.** Migrations 029–041 are additive (041 drops only unsafe
policies) and are not reversed; problems are fixed forward. If the
application must go back to the pre-M4 deployment, also run
`supabase/rollback/m4_app_rollback_guards.sql`: the old admin writes
payments into rows and sends pickup orders out for delivery, which the M4
guards refuse. It removes only those triggers; data, ledger, history and the
privilege hardening stay. A full data restore from the step-3 backup is the
last resort and loses anything written after it.

## Production preflight for 035–038 (M3)

(Superseded for the launch by the M4 procedure above; kept for reference.)
Apply after 029–034 and before deploying the M3 code (the admin API needs the
staff table and RPCs). After applying, create the first owner by signing in
with the shared `ADMIN_PASSWORD` (email left empty) and adding the owner in
Team → Staff; from then on, the shared password is refused. See
`docs/m3/OPERATIONS.md`. Verify with:

```sql
select count(*) from staff_users where role = 'owner' and is_active;
select proname from pg_proc where proname in
  ('weemap_record_payment', 'weemap_convert_trip_request', 'weemap_current_actor', 'weemap_search_normalize');
select count(*) from ops_work_items;
select doc_type, count(*) from public_search_documents group by 1;
```

## Production preflight for 029–034

Before deploying the M1 code (payment kinds, new workflow states, transport
schedule, trip requests, category tags), run through this checklist:

1. **Check what's applied.** Run the `schema_migrations` query from the top
   of this README and confirm `001`–`028` match what's in this folder, with
   nothing unknown applied on top.
2. **Back up / snapshot the database first.**
3. **Apply `029` → `034` in order, in one maintenance window, before
   deploying the M1 code.** The old CHECK constraints reject the new admin
   statuses and `payment_kind` values, so the code must not go live before
   the migrations are applied. The code does fall back to its built-in
   defaults when the schedule/payment tables are missing entirely — but once
   deployed against a database still on the old constraints, status changes
   to the new states will fail outright.
4. **Verify afterwards**, for example:
   ```sql
   select transfer_type, schedule_mode from transfer_settings;
   select code, departure_weekdays, return_offset_days from stay_patterns;
   select booking_kind, upfront_percent, balance_due from payment_policies;
   select payment_kind, count(*) from bookings group by 1;
   select payment_kind, count(*) from trip_bookings group by 1;
   select count(*) from domain_events;  -- after making one test booking
   select tgname from pg_trigger where tgname like 'weemap_%';
   ```
5. **030 and 033 touch existing data.** `030` backfills `payment_kind` on
   existing `bookings` / `trip_bookings` rows; `033` backfills
   `sinai_trip_category_tags` from each trip's `trip_category_id`. Both are
   idempotent UPDATE/INSERT statements, not destructive rewrites.
6. **Nothing in 029–033 drops or rewrites existing data or constraints**
   other than widening the `status` and `payment_channel` CHECK lists.

## Conventions in this folder

- Additive wherever possible: `ADD COLUMN IF NOT EXISTS`,
  `CREATE TABLE IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` before `ADD`.
- Say in a header comment *why* the change exists and what contract it
  creates, not just what it alters. The discount vocabulary
  (`'amount' | 'percentage'`, NULL meaning none) is enforced by a CHECK
  constraint and relied on by `src/lib/pricing.ts` and
  `src/lib/experience-pricing.ts` — that kind of coupling belongs in writing.
- Pricing is never re-derived after a booking. Rates are frozen into
  `bookings.price_snapshot` / `trip_bookings.price_snapshot` at request time.
