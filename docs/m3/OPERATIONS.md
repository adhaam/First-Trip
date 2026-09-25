# WEEMAP Operations Center — how it works (M3)

## Staff identity and access (migration 035)

Every person signs in with their own email and password. Each person has one of three roles:

| Role | Can do |
|---|---|
| **owner** | Everything, including managing staff (Team → Staff) |
| **admin** | Everything except staff management |
| **operations** | Read everything except staff and the audit log. Operational writes: requests, bookings, payments, customers, orders, rentals, partner inquiries, quotes. Never deletes. Catalogue, pricing, settings and transport configuration are read-only. |

The matrix is in `src/lib/staff-policy.ts`, with tests. `requireStaff()` in `src/lib/admin-auth.ts`
enforces it on **every** `/api/admin/*` call, not in the UI. A signed-out caller gets 401 and a
signed-in caller without permission gets 403. A new admin route defaults to "owner/admin may
write, operations may only read".

**Revocation.** The session cookie is HMAC-signed and names the person and a `session_version`.
Each API call re-reads the person's row. A trigger bumps the version when someone is disabled or
when their role, email or password changes, so every older session stops working on its next
request. Staff are disabled, never deleted, so the names in history always resolve. The database
refuses to disable or demote the last active owner.

**Attribution.** Admin routes use `getSupabaseAdmin(gate.staff)`, which sends `x-weemap-actor:
staff:<uuid>`. `weemap_current_actor()` trusts that header only on service-role requests, which
come from this server. A public or anonymous request can never claim an actor. The actor is
recorded in:
- `status_history.actor` for every status and payment-status change;
- `audit_log` for every catalogue, pricing, transport, settings and staff change, and every field
  edit or delete on request tables. Long text is summarised and password hashes are redacted;
- `payment_records.recorded_by` and the domain-event payload.

### Transition from the shared password

1. Deploy with `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` still set. Every old cookie is
   invalid, because the token format changed, so everyone signs in again.
2. Sign in with the shared password, leaving the email field empty. The resulting session
   works **only while no active owner exists**.
3. Team → Staff: create the owner account(s) and each staff member.
4. From the moment an owner exists, the shared password is refused and any shared-password
   session stops working.
5. Remove `ADMIN_PASSWORD` from the environment (recommended, not required).

Sessions last 12 hours. Login attempts are rate-limited per IP.

## Request → booking flow

```
Trip Builder submit ─► trip_request (new) ─► checking_availability ─► awaiting_payment ─┐
                                        └► alternatives_required ◄──┘                   │
                                                                                          ▼
                              Convert (POST /api/admin/trip-requests/:id/convert)
                              ├─ bookings row: stay/transport side (payment_kind by 030)
                              └─ trip_bookings rows: one per trip / Sinai package
```

- The **customer request** (`trip_requests`) never changes after submission, except for its
  status and staff notes (`internal_notes`). It is the historical truth of what was asked.
- The **operational bookings** created by conversion are what staff adjust, fulfil and collect
  money on. Every edit to them is audited.
- Conversion uses only the request's frozen `quote_snapshot` prices. It is idempotent (unique
  indexes plus a returned "already converted"), refuses requests whose availability is not
  confirmed, and emits `trip_request_converted`.

## Payments (migration 036)

- Money is recorded through **POST /api/admin/payments**, which writes to an append-only
  `payment_records` ledger. Mistakes are corrected with a refund entry.
- The database refuses: money before availability is confirmed, over-payment beyond the agreed
  total, refunds beyond what was received, and a stale screen (`expected_amount_paid`).
- `payment_status` is derived as unpaid / partial / paid / refunded. `payment_kind` is never
  touched.
- The due amounts come from the stored `payment_kind` and `payment_policies`:
  - stay and Build-your-trip stay/transport (`stay_package`): 50% after confirmation, 50% on
    arrival;
  - Sinai trip, Sinai experience package, transfer: 100% after confirmation;
  - Signature, shop and rent: per quote.
- Edit routes reject `payment_status` / `amount_paid` / … with `payment_via_ledger`.
- Methods are Vodafone Cash, InstaPay, cash, and a card payment link (on request). There is no
  gateway.

## Transport configuration

Team → Settings → Transport schedule edits the same tables the public Builder reads, per request,
so a change shows up on `/plan` immediately. The **operating schedule** (weekly rules and date
exceptions) and the **commercial stay patterns** remain separate. A pattern that would depart or
return on a day with no service is refused, and so is deactivating a rule an active pattern
depends on.
