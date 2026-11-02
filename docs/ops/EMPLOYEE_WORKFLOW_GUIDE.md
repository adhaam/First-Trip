# Operations Specialist Guide — Request to Completion

For new Operations Specialists using the Operations Center (Admin → Dashboard). Read once, keep open on your first week.

## 1. The workflow

Every request moves through the same path. The status pill on the item always tells you where it is.

1. **New Request** — a customer submitted on the website (or you entered it manually). Status: New.
2. **Availability Check** — you confirm the hotel, transfer and trips can actually be done for those dates. Status: Checking availability.
3. **Alternative / Revision** — if something is not available, propose an alternative. Revise it in place (**Revise request**); the customer keeps the same reference and every earlier quotation stays in "Revisions & quotations". Status: Alternatives required.
4. **Customer Confirmation** — the customer agrees to the (possibly revised) plan. Press **Availability confirmed — request payment**.
5. **Payment Request** — status Awaiting payment. Send the **Booking Confirmation & Payment Request**. For a Build Your Trip request, press **Confirm as journey (create bookings)** first — payments are recorded on the journey.
6. **Payment Recording** — when money arrives (cash, InstaPay, Vodafone Cash, bank transfer), press **Record payment** and enter it. Never record money you have not received. Then give the customer that payment's **Payment Receipt**.
7. **Fulfillment** — status Confirmed. Arrange the stay, transfer and trips; chase anything still owed.
8. **Completion** — after the service date, mark the item Completed.

## 2. One screen, one main button

Open an item from **Today** or the **Work queue**. At the top you see **one primary "next action" button** — it is the single thing the system recommends right now (for example "Confirm availability" or "Collect payment"). Do that first. Everything else is under **Other actions** below it (change status, edit/revise, cancel…). If the button says "Nothing to do", the item is waiting on the customer or on a date.

In lists, the Next action column is a link: it opens the item so you can do that action there. It does not perform the action by itself.

Cancelling or completing always asks you to confirm. Read the dialog.

## 3. Journeys vs their bookings

A **Build Your Trip** request becomes a **journey** (reference starting **WR-…**). When converted, it creates normal bookings (stay, transfer, trips) as its **components**.

- **Money and documents only on the journey.** Record payments and refunds, and issue quotations, confirmations and receipts, on the WR- item.
- Component bookings are **fulfilment only**. They show "Part of journey WR-…" and "Paid via the journey". They are not separate bills — the system will not let you record money or issue documents on them. Use their own status buttons only to track each booking with its supplier (confirmed with the hotel / trip operator, completed, cancelled).
- A **trips-only** journey has no stay/transfer booking at all — only its trip bookings. That is correct.
- In a customer profile, components are listed directly under their journey and marked "Part of WR-…".

## 4. Payment rules (what the customer owes, and when)

| Request type | After confirmation | Later |
|---|---|---|
| Anything that includes accommodation | **50%** | **50% on arrival** |
| Trips / packages only (no hotel, no transport) | **100%** | nothing |
| Transport only (no hotel) | **100%** | nothing |
| Transport + trips / packages (no hotel) | **100%** | nothing |

What decides it is what the customer is actually buying, not which form they used. A journey keeps the terms it was quoted with; if you revise it, the new quote follows these rules.

The item screen shows "Due now" and "Due later" — use those numbers, do not calculate by hand. A trips-only journey shows "Self-arrival (customer arranges own travel)" and "No accommodation — customer has their own stay"; there are no room or meal details, and that is correct.

## 5. Documents (the "Customer documents" card on the item; "Documents" in the old Stays/Trips lists)

Pick the right document for the moment. The system only offers what makes sense for the item's status. Each document has View / Print / Download and an Arabic / English switch. None of them is a tax invoice.

- **Provisional Quotation** — *before availability is confirmed.* A price estimate only. It is not a booking and not a payment request.
- **Booking Confirmation & Payment Request** — *after confirmation.* Shows the booking, **due now** and **due later**. Send this when you ask for payment.
- **Payment Receipt** — one per recorded payment. **Never issue a receipt before the money is recorded**, and never for a payment that was not received.

## 6. Daily routine

1. Open **Today**. Work tiles top to bottom: Needs action, Exceptions, then Arrivals / Departures / Trips / Transfers.
2. Each tile opens a list with the same count as the tile. If a number looks wrong, tell your supervisor.
3. Clear **Stale** items (no movement for days) — contact the customer or close them.
4. Check **Awaiting payment** before arrivals in the next 2 days.
5. At the end of the day, complete items whose service date has passed.

## 7. Common mistakes

- Recording a payment on a component booking instead of the WR- journey.
- Sending a Payment Receipt (or marking Paid) before the money has actually arrived.
- Sending the Provisional Quotation as if it were a confirmation.
- Cancelling an item that has money recorded without handling the refund (it shows as "Refund due" — do not ignore it).
- Creating a second request instead of revising the existing one when the customer changes dates.
- Using the old Bookings list to change status without reading the confirmation dialog.
- Quoting the 50/50 split for anything without a hotel (trips only, transport only, or transport + trips are all 100%).
- Trying to add a hotel to a confirmed trips-only journey by revision — the system refuses; cancel it and create a new request.
- Leaving "Checking availability" untouched — the customer is waiting.
