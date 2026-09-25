# WEEMAP M4 — release and launch runbook

For the engineer (or Founder) running the production release. The details of
each migration and of the SQL checks are in `supabase/migrations/README.md`
("Production procedure — M4 release"). How the Operations Center works is in
`docs/m3/OPERATIONS.md`.

## Release state

| | |
|---|---|
| Release candidate | the commit tagged in the M4 report (`git log -1` on `main` after M4) |
| Migrations to apply | `029` → `041` (production is on `028`: confirm first) |
| Current production deployment (rollback target) | `dpl_JCaQk7vmAk9vCYcZVqySX73TL24H` — `weemap-sinai-793zvo8p2-weemap-sinai.vercel.app`, 2026-09-05, aliased to weemapsinai.com |
| Vercel project | `weemap-sinai` (team `weemap-sinai`), **git-connected to `adhaam/First-Trip` `main`** |
| Production env (names) | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `WEEMAP_N8N_CHAT_WEBHOOK_URL`, `WEEMAP_N8N_CHAT_SECRET`, `NEXT_PUBLIC_WEEMAP_AI_ENABLED`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (unused by the code — remove after launch) |

**Pushing `main` to GitHub deploys to production.** Do not push before step 6.

## Architecture in one paragraph

Next.js 16 on Vercel; Supabase Postgres reached **only** from the server with
the service role (no anon key, no Supabase Auth in the app). The database
owns the invariants: payment ledger and money columns (036, 040), request →
booking conversion (036), order workflow and inventory (039), actor-attributed
history and audit (031, 035). Staff sign in with personal accounts (scrypt,
HMAC session cookie with a per-person `session_version`), roles
owner / admin / operations enforced on every `/api/admin/*` call. Images are
served unoptimised (`images.unoptimized`, see below).

## Sequence (after explicit Founder authorisation)

1. `git status` clean, `HEAD` = release commit. `npm test`, `npm run typecheck`,
   `npm run lint`, `npm run check:migrations`, `npm run check:translations` pass.
2. Production read-only check: `schema_migrations` ends at 028 (README step 2).
3. **Backup** and verify it (README step 3). Record the five row counts.
4. Apply `029` → `041` (README step 4) and run the verification SQL (step 5).
   Expected downtime: none for the public site; the pre-M4 admin may refuse
   payment edits between steps 4 and 6 (minutes).
5. Note the time. If a migration fails: stop, fix forward, re-run from the
   failed file (all of 029–041 are re-runnable). Do not deploy on a partial chain.
6. Deploy: `git push origin main` (Vercel git integration builds `main`), or
   `npx vercel deploy --prod` from the clean checkout. Wait for Ready.
7. `npx vercel inspect weemapsinai.com` → the new deployment id; record it below.
8. Owner bootstrap: `/admin` → shared password with email empty → Team → Staff
   → create the owner (and staff) → sign out → sign in as the owner. Confirm the
   shared password now answers "Sign in with your email and password".
9. Only after step 8 works: remove `ADMIN_PASSWORD` from Vercel production env
   (`npx vercel env rm ADMIN_PASSWORD production`). No redeploy is needed for
   the refusal (it is already refused once an owner exists); the next deploy
   drops it from the runtime.
10. Production smoke (below). Watch Vercel runtime logs for 30 minutes.

## Production smoke (read-only; do not create customer bookings)

- `/`, `/en`, one stay, one Sinai trip, one package, `/plan` (get a quote, do
  not submit), `/signature`, `/community`, `/search?q=دهب`, `/merch`, `/rent`,
  `/policy#cookies` — all 200, no console errors, images load, AR is RTL.
- Consent banner shows; before Accept no request to googletagmanager.com /
  facebook.net (DevTools → Network); after Accept both load.
- `/sitemap.xml` (≈98 URLs, no /admin, /cart, /search), `/robots.txt`,
  canonical + hreflang on one page, JSON-LD present.
- Headers on `/`: `content-security-policy` (frame-ancestors), `x-frame-options`,
  `x-content-type-options`; on `/api/admin/me`: `cache-control: private, no-store`.
- Owner signs in; Today and the work queue load; open one item read-only;
  Transport schedule visible; an operations account gets 403 on catalogue edits.
- Security sanity from outside:
  `curl -s "$SUPABASE_URL/rest/v1/customers?select=id&limit=1" -H "apikey: <anon key>"` → error / `[]` with permission denied.
- Database: `select max(version) from supabase_migrations.schema_migrations` shows 041's entry.

## Rollback

Triggers (any one): public home or a detail page returns 5xx for more than
5 minutes; Builder quote or order submission fails for valid input; owner
cannot sign in after bootstrap; money screen refuses a valid payment; a
security check in the smoke fails.

1. `npx vercel rollback dpl_JCaQk7vmAk9vCYcZVqySX73TL24H` (or Vercel → Deployments
   → 793zvo8p2 → Promote). Confirm `weemapsinai.com` serves it.
2. Run `supabase/rollback/m4_app_rollback_guards.sql` in production. The pre-M4
   admin writes payments into rows and sends pickup orders out for delivery;
   the M4 guards refuse both. Data, ledger and history are kept.
3. Keep `ADMIN_PASSWORD` set — the pre-M4 admin signs in with it.
4. Migrations are not reversed (additive; 041 only removed unsafe policies).
   Full restore from the step-3 backup only if data is corrupted; it loses
   anything written since.

Proven locally: `scripts/db-upgrade-check.sh` (028 → 041 on legacy-shaped
data, double apply, then the rollback helper).

## Images

`images.unoptimized` stays. Vercel's optimiser previously answered 402 (quota)
in production. Measured on the mobile home page (production build): CLS 0,
21 of 23 images lazy, no broken images, the two eager images are the 74 KB
WebP hero poster and the 41 KB logo; neutral WEEMAP media is local and
pre-encoded. Owner-uploaded Supabase images are served at their uploaded size.
Keep uploads ≤ 300 KB WebP until an image CDN is chosen deliberately.

## Owner bootstrap / ADMIN_PASSWORD state

Recorded at release: owner created at ____ by ____; shared password refused
(✓/✗); `ADMIN_PASSWORD` removed from Vercel at ____.

## Deployment record

| | |
|---|---|
| Release commit | |
| Backup | |
| Migrations applied | 029–041 at ____ |
| Deployment id | |
| Smoke | |

## First-day operations checklist

- Owner creates one account per person (no sharing); operations staff get the
  `operations` role.
- Each operator records money only through **Record payment** (never edits
  totals to "fix" a payment; a total below money received is refused on
  purpose: record a refund first).
- Pickup orders: Ready → Completed at handover. Delivery: Ready → Out for
  delivery → Completed.
- Check Today → exceptions (unpaid close to service, refund due) morning and
  evening.
- A "Too many attempts" at sign-in clears after 15 minutes.
- Signing out signs the person out on every device.

## Incident notes

- **Sign-in fails for everyone**: check Supabase status; sign-in fails closed if
  the database is unreachable. `staff_login_throttle` rows can be cleared by the
  owner in SQL if a lock-out must be lifted early:
  `delete from staff_login_throttle;`.
- **"Not enough stock" on reopen**: the order stays cancelled; adjust stock or
  create a new order.
- **Payment refused**: the message code says why (`payment_before_confirmation`,
  `overpayment`, `stale_payment_state` → reload the screen).
- Server logs carry codes and record ids (`[orders] …`, `record payment error`,
  `staff login …`), never passwords, tokens or card data.

## Post-launch debt

**Do soon** (weeks)
- Staff 2FA (TOTP) for owner/admin.
- Self-service password reset by email (today the owner resets passwords).
- Remove the unused `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Vercel; confirm Supabase
  Auth sign-ups are disabled in the dashboard (the app does not use Auth).
- Re-authenticate the Supabase MCP / add a read-only production SQL path so
  preflights do not depend on one tool.
- Real WEEMAP photography (neutral media until then; never stock imagery).

**Can wait**
- Per-session revocation (today sign-out ends all of a person's sessions).
- Content-Security-Policy `script-src` with nonces (needs dynamic rendering).
- Image CDN / optimiser once there is budget for it.
- Queue beyond 1,000 open items (in-memory derivation).
- `transfer_settings` Arabic service names (catalogue data).

**Optional**
- Deeper observability (error tracker) — logs + DB history suffice at this scale.
- AGENEON event publisher over `domain_events`.
