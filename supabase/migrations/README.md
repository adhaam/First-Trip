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

## Production preflight for 029–033

Before deploying the M1 code (payment kinds, new workflow states, transport
schedule, trip requests, category tags), run through this checklist:

1. **Check what's applied.** Run the `schema_migrations` query from the top
   of this README and confirm `001`–`028` match what's in this folder, with
   nothing unknown applied on top.
2. **Back up / snapshot the database first.**
3. **Apply `029` → `033` in order, in one maintenance window, before
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
