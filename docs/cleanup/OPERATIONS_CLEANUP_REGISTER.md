# WEEMAP Operations Cleanup — evidence register

Branch `fix/ops-cleanup` (code `d1cfecd`). Production at audit time: `30f0364` (Vercel `dpl_JCATTMWersyUKZ2aXUQFq6g3yYho`), Supabase `ugekpmogiecfsmydyjxr`.
All production reads were done on 2026-11-04 through Codex on the **read-only** Supabase connection, after `get_project_url` confirmed the project. The only statement run on the write connection was the description dry run, which always ends in an exception, so it rolled back.

## 1. Missing accommodation booking (P0)

**Root cause.** Admin → Bookings → Stays only listed rows from `bookings` with `trip_request_id IS NULL`, i.e. direct stay bookings. A hotel booked through **Build Your Trip** is a `trip_requests` row (WR-…). If converted, its hotel booking is a *component* BK whose `trip_request_id` is set. Neither kind could appear in the Stays list.

**Affected category: Build Your Trip hotel requests (journeys), unconverted and converted.** Production on 2026-11-04:

| Request | Hotel | Status | Converted → component | Shown in Stays before? |
|---|---|---|---|---|
| WR-2611-0012 (created 2026-11-03) | Mojito Palm | checking availability | not yet | no |
| WR-2611-0011 | Havana House | confirmed, **arrives 2026-11-04** | BK-5534FCF8 (confirmed) | no |
| WR-2610-0010 | Amun Dahab Hotel | checking availability | not yet | no |
| WR-2610-0009 | Alaska Camp & Hotel Dahab | new | not yet | no |
| WR-2610-0008 | Cabana House – Velvet | cancelled | BK-D51A6951 (confirmed) | no |

The only direct (non-journey) stay bookings are 4 cancelled September bookings, and these were the only rows the old Stays list could show. `trip_requests` WR-2610-0006 and WR-2610-0007 have no hotel, so they are not stays.

**Fix (read-only, no records created).** Stays now shows a "Build Your Trip hotel requests" panel:
- every WR with a hotel, newest first;
- unconverted requests are labelled *awaiting conversion*;
- converted requests link to their BK component.

Direct bookings stay in the table below it. Search matches WR/BK references, customer name or phone, and hotel name. The panel only reads data, so payments, ownership and work items are not duplicated.

**Tests.**
- `src/lib/ops/journey-stays.test.ts` (6): row building, unconverted/converted/cancelled states, trips-only exclusion, newest-first ordering and search.
- Local acceptance on synthetic rows (`ZZ`/"Synthetic" names only), in AR and EN.

## 2. Newest first (P0)

- The ops queue defaults to `created_at` descending, with `entity_type:entity_id` as a stable tiebreak.
- A labelled control offers Newest / Oldest / Upcoming arrival / Longest waiting.
- The *Upcoming* and *Stale* views keep their own defaults.
- The sort survives reload (URL `sort=`) and pagination; pages concatenate exactly.
- The bookings and trip-bookings APIs gained an `id` tiebreak. Production has 0 `created_at` ties among bookings today, but trip-bookings created in one conversion share a timestamp.
- Tests: `src/lib/ops/work-items.test.ts`.

## 3. Hotel descriptions

**Audit (48 hotels, 47 active):** 29 are fine. **19** active hotels have an empty `description_ar` and a bilingual `description_en` (Arabic, then an "English Description" heading, then English). No row has a pure-Arabic English field. Because of this, both the AR and EN pages showed the bilingual block, rendered left-to-right.

**Correction (proposed, not applied):** `supabase/maintenance/2026-11-cleanup/descriptions_fix.sql` splits the existing text of **18** reviewed rows. Every word, and the exact before/after text, is in [DESCRIPTION_CHANGES.md](DESCRIPTION_CHANGES.md).

Guards — any failure aborts the whole run:
- each row is identified by id prefix and the md5 of its current text;
- `description_ar` must still be empty;
- the split must be exactly one heading, or a clean Arabic→English paragraph boundary (4S Hotel);
- the Arabic part must be clearly Arabic and the English part must contain no Arabic letter;
- the whole text, without whitespace and heading labels, must be identical before and after;
- every row is backed up to `maintenance.desc_fix_20261104_accommodations` first;
- every other column of every hotel must be byte-identical (fingerprint) after the update;
- exactly 18 rows must change.

**Production dry run (2026-11-04):**

```
RESULT DRY: would split 18 row(s): 4s hotel [paragraphs, ar 553 / en 682]; ayana studios [heading, ar 294 / en 299]; …; tropital dahab [heading, ar 320 / en 403]
```

**Unresolved: 1.** *Torino camp dahab*: its text describes Dahab Hills Hotel, so it needs the owner's own text and is left untouched.

**Content notes, kept as is:**
- Tropitel's English text ends with `tropitelhotels.com+1`.
- Several Arabic/English names differ from the admin name: Miamy/Miami Beach, Remal/Ramal, Roketa/Rocketa, Happy Life Resort/Village.

**Local test:** a disposable Postgres 17 database with fixtures for each pattern. Results:
- dry run, apply, backup and rollback all worked;
- runs with a stale fingerprint, an existing Arabic description, a wrong row count or Arabic left in the English part were refused;
- refusals changed nothing;
- a second apply is refused.

## 4. Migration history (044–046, 049–051)

**Registry today:** 39 rows in `supabase_migrations.schema_migrations`.
- 029–042 are recorded with placeholder versions `20260926000001`–`…14` and **0 statements**, from an earlier reconciliation.
- 043 is `sinai_package_commercial_content` (8 statements), 047 is `site_pages` and 048 is `ops_edition_requests`.
- 052 is recorded as two parts (`20261102200549`, `20261102200802`).
- **044, 045, 046, 049, 050 and 051 have no rows.**

**Identity check — each file's effect is present in production:**

| File | Effect checked in production | Result |
|---|---|---|
| 044_weemap_editions | `editions` + `edition_requests` tables, `update_editions_updated_at` trigger, service-role policies, 6 edition rows | present |
| 045_editions_server_only_reads | `editions_public_read` policy absent | absent ✔ |
| 046_editions_public_experience_wording | old "Edition" wording left in descriptions | 0 ✔ |
| 049_journey_commercial_ownership | 6 functions; `journey` payment policy; `trip_requests_payment_status_check` text identical to the file | present ✔ |
| 050_stay_patterns_8d7n_and_custom | `bus_8d7n`, `hiace_8d7n` | present ✔ |
| 051_journey_amendments | `trip_request_revisions` + append-only triggers, `weemap_amend_trip_request` | present ✔ |

Current function fingerprints, `md5(prosrc)` (the post-052 baseline):

| Object | Fingerprint |
|---|---|
| `weemap_convert_trip_request` | `cd521247` |
| `weemap_amend_trip_request` | `37c347d5` |
| `weemap_record_payment` | `49ceaecc` |
| `ops_work_items` view | `376b1607` |

**Decision: nothing was written.**
- Never rerun 049 or 051: both contain data backfills that insert `payment_records` and `trip_bookings`, so a rerun would duplicate real financial rows.
- 052 is untouched.
- The registry is bookkeeping only: this repo applies migrations by file number and never via `supabase db push`. Adding rows would require inventing version timestamps.
- The mapping above is the reconciled record.

**Optional later step (needs owner OK):** add 6 registry rows with empty statements, following the 029–042 convention, to complete the registry. They would be marked `created_by = 'weemap-reconciliation-20261104'` and use versions between their neighbours.

## 5. Homepage errors

Vercel runtime errors on `30f0364` include:
- `INVALID_MESSAGE`: 176 events;
- `RangeError: Incorrect locale information`: 44 events.

All of them come from scanner paths such as `/.env`, `/wp-login.php`, `/security.txt` and `/meta.json`. The middleware skips dotted paths, so those requests reach `[locale]` with locale `.env`.

**Fix:** the layout calls `notFound()` for any non-app locale. Locally these paths now return 404 with no server error, while `/`, `/en`, `/plan` and `/en/plan` return 200.

**Seen but out of scope:** `/book-dahab/null` logs "invalid uuid null".

## 6. Codex tooling

- The global `@openai/codex` 0.157.1 is still broken: its `node_modules/@openai` folder is empty.
- The working copy is `C:\Users\adham\tools\codex-0.157.1-win32-x64\` (official package, same SHA-256 as the verified one), and it was used for every step above.
- **Repair plan (needs owner OK, may affect AGENEON):** `npm install -g @openai/codex@0.157.1`, then `codex --version` and `codex mcp list`. Keep the tools copy until both pass.

## 7. Release checks

| Check | Result |
|---|---|
| Type check | OK |
| ESLint | 0 errors (2 old warnings) |
| Tests | 832/832 |
| Translation parity | 2257 keys |
| Migrations check | 001–052 OK |
| `next build` | compiled |
| Vercel preview `dpl_9xw2UJwpZ4Q4EPxgt6WjHUjKrkTs` (`d1cfecd`) | READY |
| `origin/main` = `30f0364` | ancestor of the branch (fast-forward) |
| Database migrations in this release | none |

**Production acceptance (after authorization):**
1. Description fix applied: `RESULT APPLIED … 18`, 18 backup rows, unchanged fingerprint.
2. AR and EN hotel list, detail and admin pages show the right language for e.g. Havana House and 4S Hotel; Torino is unchanged.
3. Stays panel lists WR-2611-0012, 0011, 0010, 0009 and 0008 newest first; BK-5534FCF8 links from WR-2611-0011.
4. Stays search by `BK-5534`, "havana" and a WR reference.
5. The queue opens newest first; the sort control works in AR and EN and on mobile.
6. `/.env` and `/wp-login.php` return 404; `/` and `/en` return 200.
7. No new runtime errors after the deploy.
8. Ledger and record counts are unchanged except the 18 description fields.

## Remaining debt (not changed)

- **WR-2610-0008:** the request is *cancelled*, but its BK and 9 TB components are still *confirmed*. Ops should review.
- **WR-2610-0006** (cancelled, no hotel): its component BK-C140B605 is still *awaiting payment* and has no hotel. This is a pre-052 trips-only conversion.
- `/book-dahab/null` errors.
- Torino Camp needs its own description.
- Migration registry rows for 044–046 and 049–051 (optional, see §4).
- Global Codex repair (see §6).

## 8. Production release and acceptance — 2026-11-04 (owner-authorized)

**Description correction.** It was applied once via Codex `supabase_rw` after the project URL check.

| Measure | Before | After |
|---|---|---|
| Backup / split rows | — | 18 / 18 |
| Active hotels with empty `description_ar` | 19 | 1 (Torino, unchanged) |
| Non-description fingerprint | `8fca05937ec1` | `8fca05937ec1` |
| trip_requests / bookings / trip_bookings / payment_records | 7 / 7 / 14 / 8 | 7 / 7 / 14 / 8 |
| Payments total | 38,950 | 38,950 |

**Deploy.** `main` was fast-forwarded `30f0364 → d41a2a9`. Vercel production `dpl_AesygPZXQgFeKZWrUL5buEdG8B7U` is READY; rollback candidate `dpl_JCATTMWersyUKZ2aXUQFq6g3yYho`.

**Acceptance (all pass):**
1. Description apply result as above.
2. Public detail pages: Havana House and 4S Hotel are Arabic-only on `/` and English-only on `/en`. Torino is unchanged. Admin API: only Torino lacks Arabic.
3. Stays → "Build Your Trip hotel requests (5)", newest first: WR-2611-0012, -0011 (→ BK-5534FCF8), -0010, -0009, -0008.
4. Stays search: `BK-5534` → WR-2611-0011, `havana` → WR-2611-0011, `WR-2610-0010` → WR-2610-0010.
5. The queue (15 items) is newest first by default and `sort=oldest` reverses it. Labels are translated in EN and AR (RTL). At 375 px there is no horizontal overflow.
6. `/.env`, `/wp-login.php`, `/security.txt` and `/meta.json` return 404; `/`, `/en`, `/plan`, `/en/plan` and `/book-dahab` return 200.
7. Vercel runtime errors: none on the new deployment. The last `INVALID_MESSAGE`/`RangeError` was at 02:06 UTC on the previous deployment.
8. Ledger and record counts are unchanged; only the 18 description fields changed.

**WEEMAP OPERATIONS CLEANUP — PRODUCTION VERIFIED.**
