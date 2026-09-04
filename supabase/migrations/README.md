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
