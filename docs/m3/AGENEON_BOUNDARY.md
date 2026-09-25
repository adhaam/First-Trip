# WEEMAP ↔ AGENEON boundary (M3)

M3 does **not** integrate AGENEON. This page fixes who owns what, so the integration can be
built later without the two systems both claiming the same truth.

## Ownership

| Concern | Owner | Notes |
|---|---|---|
| Catalogue (stays, rooms, meals, trips, Sinai packages, Signature, shop, rent) | **WEEMAP** | Includes the active/public state and prices. |
| Pricing and payment rules | **WEEMAP** | The quote engine, `payment_policies`, and `payment_kind`, which is immutable once stored (030/034). |
| Trip Builder request (customer intent) | **WEEMAP** | `trip_requests` is frozen as submitted. |
| Booking / order / rental state | **WEEMAP** | The workflow lives in `src/lib/request-workflow.ts`; history in `status_history`. |
| Supplier availability workflow | **WEEMAP** | Statuses checking_availability, alternatives_required, awaiting_payment. |
| Payments received / refunded | **WEEMAP** | Recorded in the append-only `payment_records` (036). There is no gateway. |
| Fulfilment and operations | **WEEMAP** | Handled in the Operations Center. |
| Staff identity and audit | **WEEMAP** | `staff_users` and `audit_log` (035). |
| Conversations (WhatsApp, Instagram, …), follow-ups, sales, CRM intelligence | **AGENEON (later)** | WEEMAP only hands off (the WhatsApp link carries the WR reference). |

AGENEON **reads** WEEMAP truth and **proposes** actions. Every state change still goes through
WEEMAP's own API and workflow, so the rules, CAS, audit and actor apply the same way. AGENEON
never writes WEEMAP tables directly. The data flows in one direction:

```
WEEMAP DB ──(same transaction)──► domain_events (outbox) ──► [future publisher] ──► AGENEON
AGENEON ──(authenticated WEEMAP API call, as a service identity)──► WEEMAP workflow ──► DB
```

## The outbox (exists now, nothing consumes it)

`public.domain_events` (migration 031) has `id, event_type, aggregate_type, aggregate_id, payload,
occurred_at, published_at, publish_attempts, last_error`. Rows are written **inside the same
transaction** as the business change, by triggers and RPCs, so a committed change always has its
event and a rolled-back change never does. The vocabulary is mirrored in `src/lib/domain-events.ts`,
and `src/lib/domain-events.test.ts` fails if the two drift apart.

| Event | Aggregate | Written by |
|---|---|---|
| booking_requested, signature_requested, commerce_order_requested, rental_requested | request tables, trip_request | insert trigger (031) |
| availability_check_started, alternative_required, availability_confirmed, payment_requested, booking_confirmed, booking_cancelled, booking_completed, booking_status_changed | bookings, trip bookings, Signature, trip requests | status trigger (031) |
| commerce_order_* / rental_* | orders, rentals | status trigger (031) |
| payment_received, payment_refunded | request tables | payment_status trigger (031) |
| payment_recorded, refund_recorded | the paid entity | `weemap_record_payment` (036), one event per ledger entry |
| trip_request_converted | trip_request | `weemap_convert_trip_request` (036); the payload lists the created booking ids |
| customer_created, customer_updated, customer_merged | customer | customer trigger (036) |

**Payload rule:** payloads carry identifiers and state only: ids, status, payment status,
amounts, reference, source, `trip_request_id`, and `actor` (`staff:<uuid>` or null). They never
carry names, phones or emails. A consumer looks contact data up through WEEMAP with proper access.

## What M3 deliberately did not build

- There is no publisher, webhook, queue or external call. `published_at` stays NULL.
- There is no second CRM: no pipelines, sequences, campaigns or opportunity objects.
- There is no AGENEON write path.

## When AGENEON integration starts (M4+)

1. Add a publisher that reads `domain_events WHERE published_at IS NULL ORDER BY occurred_at`, delivers
   with at-least-once semantics, and sets `published_at` / `publish_attempts` / `last_error`.
   Consumers must be idempotent on `domain_events.id`.
2. Give AGENEON its own `staff_users`-style service identity with the narrowest role, so every
   action it takes is attributed and auditable like a person's.
3. Keep conversation state in AGENEON. At most, WEEMAP stores a pointer (a conversation id) on the
   request.
