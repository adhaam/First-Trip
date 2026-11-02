# Release runbook — Experience & Operations stabilization (migration 052 + app)

Target: Supabase `ugekpmogiecfsmydyjxr`, Vercel project `weemap-sinai` (`prj_LH7WWHlxX1hmYwmlExnpY2BuV3th`), domain `weemapsinai.com`.
Code: branch `fix/experience-ops-stabilization`, a fast-forward of production `96d443a`.

## Preflight evidence (read-only, 2026-11-02)

| Check | Production | Expected (local origin/main) | Result |
|---|---|---|---|
| Project URL | `https://ugekpmogiecfsmydyjxr.supabase.co` | — | ✔ |
| `weemap_convert_trip_request` (normalized md5) | `3eed8dd2…a476` | `3eed8dd2…a476` | ✔ identical |
| `weemap_amend_trip_request` | `fa01afad…6957` | `fa01afad…6957` | ✔ identical |
| `weemap_record_payment` (not changed by 052) | `eba7f698…b7e5` | `eba7f698…b7e5` | ✔ identical |
| `ops_work_items` view | `5735e2f9…d9b3`, 24 cols, `security_invoker=true`, owner postgres, 0 dependents | same | ✔ identical |
| Functions owner / SECURITY DEFINER | postgres / true | 049/051 | ✔ |
| Ledger: amount_paid vs payment_records | 0 mismatches (8 records: 4 trip_request, 4 accommodation_booking) | 0 | ✔ |
| Overpaid / paid-but-short / unpaid-with-money / negative | 0 / 0 / 0 / 0 | 0 | ✔ |
| Journey components holding money | 0 (13 components) | 0 | ✔ |
| Converted journeys without agreed_total | 0 (3 converted, all plan kind `journey`) | 0 | ✔ |
| Trips-only / no-accommodation transport requests | 0 / 0 | — | 052 changes no existing row's payment kind |
| Payment policies | trip 100, transfer 100, experience_package 100, journey/stay/stay_package 50 + on_arrival | — | ✔ |
| Maintenance backups (`flr_20261001_*`, `stays_20261007_*`) | present | keep | ✔ untouched |

After 052, the 3 existing converted journeys keep `payment_kind = journey` (their stored plan kind), so no due-now figure moves.

## Scripts (this folder)

All generated from `supabase/migrations/052_trips_only_journeys.sql` with full-line comments stripped (transport limit ~27 KB per call). Each is **one DO statement** (atomic however it is sent) with hash guards: it refuses unless the live definitions are the audited pre-052 (or already post-052) ones, and rolls back unless what it installed hashes to the locally verified result.

| File | Size | Post-hash |
|---|---|---|
| `part1_convert_view.sql` | 14.9 KB | convert `44a6d6de…45a7`, view `595d95bf…2f0e` |
| `part2_amend.sql` (refuses before part 1) | 23.8 KB | amend `f7644c18…0125` |
| `verify_rollback_only.sql` | 11.3 KB | always raises; success = `RESULT OK: …`; zero residue, no WR number consumed |
| `rollback_part1_amend.sql`, `rollback_part2_convert_view.sql` | 22.9 / 14.0 KB | restore `fa01afad…`, `3eed8dd2…`, `5735e2f9…`; refuse once a trips-only journey has been converted |

Rehearsed locally on a DB built from origin/main: wrong-order and tampered parts refused; parts applied, re-applied idempotently; regression SQL (trips-only, amendments, payment-kind invariants) passed; verify script `RESULT OK` with unchanged row counts; rollback restored the exact pre-052 hashes and re-apply worked.

## Sequence (database first — 052 is backward-compatible with the running app)

Why DB first: with 052 live, the current production app behaves exactly as today (it never creates trips-only requests; existing journeys keep their stored plan kind). Deploying the app first would let customers submit trips-only requests that Ops could not convert.

1. **Fingerprint (read-only)** — re-run the preflight query (counts + hashes above). Stop on any difference.
2. **Apply part 1** — `apply_migration` on server `supabase_rw`, name `052_trips_only_journeys_part1`, body = `part1_convert_view.sql`. Expect `052 part 1 applied: convert 44a6d6de…, view 595d95bf…`.
3. **Apply part 2** — `apply_migration`, name `052_trips_only_journeys_part2`, body = `part2_amend.sql`. Expect `052 part 2 applied: amend f7644c18…`.
4. **Post-apply read-only check** — hashes = post-hashes; record_payment unchanged; ledger invariants still 0; existing converted journeys still `journey`.
5. **Rollback-only verification** — `execute_sql` with `verify_rollback_only.sql`; expect the error text `RESULT OK: 052 production verification passed — everything rolled back`; then re-run the counts and confirm identical (zero residue).
6. **Deploy the app** — fast-forward `main` to the reviewed branch head and push (`git push origin <sha>:main`); Vercel builds production. Confirm the production deployment for that exact SHA is READY and aliased to `weemapsinai.com`.
7. **Production browser acceptance (no customer records created)**
   - Public, EN + AR, 1280/1440 and 375/390/430: Build Your Trip — travellers 1→4 stays open; self-arrival → "No accommodation — trips only" → trip → price = trips only, 100% after confirmation (the quote endpoint does not persist); add/remove a hotel → "Recalculating…" then the reconciled total; Package Quick View; a hotel detail page (gallery, description fallback on one of the 19 hotels without Arabic text).
   - Ops (owner signs in): Today tiles match their lists; an existing journey shows one primary action, documents panel (Provisional Quotation / Booking Confirmation gated by status / receipts per payment) with the logo; a journey booking shows "Paid via the journey" and supplier-status actions only.
   - Convert / payment / receipt paths on production are covered by step 5 (rollback-only), not by creating real records.
8. **Fingerprint again** — counts unchanged by acceptance.

## Rollback

- **App**: Vercel instant rollback / promote `dpl_HHzeTJW3ib9BTdSMgdRcvh7PWjux` (`96d443a`). Safe with 052 left in place.
- **Database** (only if the owner decides): `rollback_part1_amend.sql` then `rollback_part2_convert_view.sql`. They refuse once a trips-only journey has been converted.

## Known risks

- `supabase_migrations.schema_migrations` already lags the live schema (044–046 and 049–051 applied but unrecorded; newest recorded is 048 `ops_edition_requests`). Pre-existing; 052 does not depend on it. Recording 052 via `apply_migration` adds its two rows.
- 19 of 43 active hotels have no Arabic description; after release they show their own English text on the Arabic site until staff add Arabic.
- Vercel preview deployments of this branch may point at the production database: do not submit requests on previews before step 3.
- Supabase MCP OAuth tokens expire within days; Codex currently runs from an isolated binary in a temporary folder.
- Pre-existing low-volume home-page runtime errors (`INVALID_MESSAGE`, locale `RangeError`) since 2026-08 — unrelated, untouched.
