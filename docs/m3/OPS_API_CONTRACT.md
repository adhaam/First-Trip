# M3 Operations Center — API contract

Shared between the backend and the dashboard UI. All routes are under `/api/admin`, and all
of them start with the guard:

```ts
const gate = await requireStaff(req)          // import { requireStaff } from '@/lib/admin-auth'
if (!gate.ok) return gate.response            // 401 not signed in / revoked, 403 role not allowed
const supabase = getSupabaseAdmin(gate.staff) // sends x-weemap-actor → history/audit record who
```

The role matrix is in `src/lib/staff-policy.ts`. Error bodies are always
`{ error: string, code?: string, ... }`, and the UI switches on `code`.

## Shared types (`src/lib/ops/types.ts`)

```ts
type OpsEntityType = 'accommodation_booking' | 'trip_booking' | 'signature_request' | 'trip_request' | 'commerce_order'

type NextAction =
  | 'start_availability_check'      // new / pending / contacted
  | 'confirm_availability'          // checking_availability → confirm or offer alternatives
  | 'plan_signature'                // signature planning
  | 'agree_alternative'             // alternatives_required
  | 'convert_to_booking'            // trip_request awaiting_payment|confirmed, not converted
  | 'collect_payment'               // awaiting_payment, or confirmed with the upfront amount unpaid
  | 'mark_completed'                // confirmed and the service end date has passed
  | 'refund_due'                    // cancelled while money is held
  | 'contact_customer' | 'confirm_order' | 'prepare_order' | 'mark_ready' | 'hand_over' | 'complete_delivery'
  | 'none'                          // nothing for staff to do right now

type WorkItem = {                   // one row of the view ops_work_items (migration 036) plus derived fields
  entity_type: OpsEntityType; entity_id: string; reference: string; subtype: string | null
  payment_kind: string | null; customer_id: string | null; customer_name: string; customer_phone: string
  status: string; payment_status: string | null  // trip_request: 'converted' | null
  amount_total: number | null; amount_paid: number | null
  start_date: string | null; end_date: string | null; people: number | null
  title_en: string; title_ar: string; transfer_type: string | null; source: string
  trip_request_id: string | null; created_at: string; updated_at: string
  // derived
  next_action: NextAction
  needs_action: boolean            // staff own the next step (not waiting on the customer)
  last_change_at: string           // latest status_history.changed_at, or created_at
  waiting_hours: number            // since last_change_at
  stale: boolean                   // waiting longer than STALE_HOURS[status]
  attention: AttentionCode[]       // exceptions, see below
  upfront_due: number | null       // from payment_kind + payment_policies; null when per-quote
  outstanding_now: number | null   // max(0, upfront_due - amount_paid) once availability is confirmed
}

type AttentionCode =
  | 'unpaid_close_to_service'      // confirmed/awaiting_payment, upfront unpaid, service within 2 days
  | 'service_passed_not_completed' // confirmed and end/start date passed
  | 'refund_due'                   // cancelled with amount_paid > 0
  | 'stale'
  | 'transfer_unconfirmed'         // has transfer_type, service within 3 days, not confirmed
```

`STALE_HOURS`: new/pending/contacted 24, checking_availability 48, planning 72,
alternatives_required 72, awaiting_payment 72. The commerce states new/contacted also use 24.

## Endpoints

### GET `/ops/today?date=YYYY-MM-DD`
The default date is today in Africa/Cairo. Returns:
```ts
{ date: string,
  counts: { needs_action, new_requests, awaiting_availability, alternatives_required, awaiting_payment,
            arrivals_today, departures_today, trips_today, transfers_attention, stale, exceptions },
  sections: {
    needs_action: WorkItem[]          // max 50, oldest waiting first
    arrivals: WorkItem[]              // start_date = date, stays/transfers/requests (unconverted), not cancelled
    departures: WorkItem[]            // end_date = date
    trips: WorkItem[]                 // trip_booking / signature_request with start_date = date
    transfers: WorkItem[]             // transfer_type set, service within [date, date+3], not cancelled
    upcoming: WorkItem[]              // start_date in (date, date+7], not cancelled, max 30
    stale: WorkItem[]
    exceptions: WorkItem[]            // attention not empty (excluding plain 'stale')
    recent_activity: Activity[]       // last 25 across status_history + payment_records
  } }
type Activity = { kind: 'status' | 'payment_status' | 'payment' | 'refund', entity_type, entity_id,
  reference, customer_name, from_value: string | null, to_value: string | null, amount?: number,
  method?: string, actor: string | null, actor_name: string | null, at: string }
```
Every count has a matching queue view, so a click on it opens the list.

### GET `/ops/queue`
Query: `view=needs_action|awaiting_payment|upcoming|stale|exceptions|all` (default needs_action),
`type=<OpsEntityType>`, `status=`, `payment=unpaid|partial|paid|refunded`, `from=`/`to=`
(filter on start_date, or end_date when `date_field=end` — e.g. the "departures today" tile),
`date_field=start|end` (default start), `transfer=1` (only rows with `transfer_type` set — the
"transfers needing attention" tile; combine with `view=exceptions` or `view=all`), `q=` (reference,
customer name or phone, title), `page=` (1-based) and `page_size=` (default 25, max 100). By default
the list leaves out terminal states (completed and cancelled) unless `status` asks for them or
`view=all`.
Returns `{ items: WorkItem[], total: number, page: number, page_size: number }`.

### GET `/ops/items/:type/:id`
```ts
{ item: WorkItem,
  record: Record<string, unknown>,       // the full table row plus joined names (accommodation, trip, package, experience)
  history: { field, from_value, to_value, actor, actor_name, changed_at }[],
  payments: { id, direction, amount, method, reference, note, received_at, recorded_by, recorded_by_name, amount_paid_after }[],
  audit: { id, occurred_at, action, changes, actor, actor_name }[],   // [] for the operations role
  related: { trip_request: WorkItem | null, items: WorkItem[] },       // same trip_request_id, excluding self
  customer: { id, name, phone, email } | null,
  payment_expectation: { kind: string | null, total: number | null, upfront_percent: number | null,
     upfront_amount: number | null, balance_amount: number | null, balance_due: 'on_arrival' | 'before_service' | null,
     amount_paid: number, outstanding_now: number | null, outstanding_total: number | null } | null,
  allowed_statuses: string[],            // from allowedNextStatuses(), excluding the current status
  payment_allowed: boolean,              // the status currently accepts money (see migration 036)
  can_convert: boolean }                 // trip_request only
```

### POST `/ops/items/:type/:id/status`
Body: `{ status, expected_status }`. The request is refused if the row's status is no longer
`expected_status`, which is how a stale screen is caught. Transitions are checked with
`src/lib/request-workflow.ts`.
- 200 `{ item: WorkItem }`
- 409 `{ code: 'stale_status', current_status }`
- 409 `{ code: 'invalid_transition', allowed }`
- 404

### POST `/ops/items/:type/:id/notes`
Body: `{ internal_notes, expected_updated_at }`. This writes staff notes only and never touches
the customer's `notes`.
- 200 `{ internal_notes, updated_at }`
- 409 `{ code: 'stale_record' }`

### POST `/payments`
Body: `{ entity_type: 'accommodation_booking'|'trip_booking'|'signature_request'|'commerce_order',
entity_id, direction: 'received'|'refunded', amount, method, expected_amount_paid, reference?, note?,
received_at? }`. It calls the RPC `weemap_record_payment`.
- 200 `{ payment_record_id, amount_paid, payment_status }`
- 409 `{ code: 'stale_payment_state' }`
- 422 `{ code: 'payment_before_confirmation' | 'overpayment' | 'refund_exceeds_paid' | 'invalid_amount' }`
- 404

`method` is one of instapay, vodafonecash, cash, card_link, bank_transfer, other.

### POST `/trip-requests/:id/convert`
It calls the RPC `weemap_convert_trip_request`.
- 200 `{ already_converted, booking_id, trip_booking_ids }`
- 409 `{ code: 'request_not_confirmed' }`
- 422 `{ code: 'missing_accommodation' | 'missing_quote_snapshot' | 'snapshot_mismatch' }`
- 404

### PATCH `/trip-requests/:id`
Body: `{ status?, internal_notes? }`, strict. The customer's `notes` and journey are never
editable.

### GET `/ops/search?q=`
Needs at least 2 characters. Returns
`{ customers: {id,name,phone,email,last_activity_at}[], items: WorkItem[], catalogue: {type:'stay'|'trip'|'package'|'signature'|'product', id, title_en, title_ar, is_active, subtitle}[] }`.
Phone matching is on digits only.

### GET `/customers/:id/profile`
```ts
{ customer: {...row, merged_into}, merged_from: {id,name,phone}[],
  items: WorkItem[],                      // every request/booking/order of this person, newest first
  payments: (payment row + entity_type/entity_id + reference)[],
  activity: Activity[],                   // last 50
  totals: { items, open_items, lifetime_paid, outstanding_now } }
```

### GET `/audit?table=&row_id=&actor=&page=`
Owner and admin only. Returns `{ entries: { id, occurred_at, actor, actor_name, table_name, row_id, action, changes }[], total, page }`.

### Transport configuration (owner/admin write, everyone reads)
- GET `/transport` returns
  `{ services: {transfer_type, name_ar, name_en, schedule_mode, is_active}[], weekly_rules: row[], exceptions: row[] (service_date >= today-30), stay_patterns: row[], governorates: {code,name_ar,name_en}[], preview: { transfer_type, direction, dates: string[] }[] }`.
  The preview holds the next 28 days of operating dates, computed with `src/lib/transport`
  from the same data the public Builder reads.
- PATCH `/transport/services/:transfer_type` with `{ schedule_mode }`.
- POST `/transport/weekly-rules` and PATCH/DELETE `/transport/weekly-rules/:id`, with
  `{ transfer_type, direction, weekday, origin_governorate_code?, valid_from?, valid_to?, is_active, notes? }`.
- POST `/transport/exceptions` and PATCH/DELETE `/transport/exceptions/:id`, with
  `{ transfer_type, direction: 'outbound'|'return'|'both', service_date, kind: 'blackout'|'extra', origin_governorate_code?, reason_ar, reason_en, is_active }`.
  A new exception cannot be dated in the past.
- POST `/transport/stay-patterns` and PATCH `/transport/stay-patterns/:code`, with
  `{ code (create only), transfer_type|null, name_ar, name_en, duration_days, nights, return_offset_days, departure_weekdays|null, is_active, sort_order }`.
  Stay patterns are never deleted. A pattern is rejected (422 `{code:'pattern_not_operable', details}`)
  when a scheduled service has no active outbound rule on a departure weekday, or no return
  service on departure + return_offset_days.
- Validation errors return 400 `{ code:'invalid', details }`, and duplicates return 409 `{ code:'duplicate' }`.
