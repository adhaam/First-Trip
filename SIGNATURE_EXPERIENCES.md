# Signature Experiences

A curated, small-group trip line for weemapsinai.com — an editorial public
section plus full CRUD in the admin dashboard.

It is a **separate module** from Sinai Trips: `sinai_trips` are repeatable day
trips with no fixed departure roster, while a Signature Experience has named
partners, a day-by-day itinerary, and a limited number of spots on specific
dates.

---

## 1. Setup

### 1.1 Run the migration

Apply `supabase/migrations/016_signature_experiences.sql` to your Supabase
project (SQL editor, or `supabase db push` if you use the CLI).

It creates:

| Table | Purpose |
| --- | --- |
| `experience_categories` | The filter tags. Seeded with the 8 defaults; admins can add their own. |
| `experiences` | The experience itself — bilingual copy, itinerary, media, price, status. |
| `experience_dates` | Scheduled departures for one experience: date range, capacity, open/cancelled. |
| `experience_bookings` | Public booking requests, linked to a date and to `customers`. |
| `experience_date_availability` (view) | Convenience view returning `spots_taken` / `spots_remaining`. |

> **Why not `trip_dates` and `bookings`?** Both names were already taken in this
> schema and mean something else (`trip_dates` is the Sunday/Thursday Dahab
> package calendar; `bookings` is the accommodation/package booking record).
> Reusing them would have broken the existing pricing engine.

The migration is idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`), so
re-running it is safe.

### 1.2 Environment variables

No new *required* variables. The module uses what the app already has:

```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

One optional variable enables admin notification on a new booking request:

```
EXPERIENCE_BOOKING_WEBHOOK_URL=
```

When set, each new request is POSTed there as JSON (an n8n webhook, a Zapier
catch hook, anything that can send an email). When unset, the request is written
to the server log with `console.info` instead — the booking itself never fails
because of notification problems.

### 1.3 Run it

```bash
npm run dev
```

- Public listing: `/experiences` (Arabic) and `/en/experiences` (English)
- Experience page: `/experiences/<slug>`
- Admin: `/admin` → sign in → **Signature Experiences** in the sidebar

---

## 2. Architecture

This module follows the conventions already in the codebase — it is **not** the
client-side-Supabase pattern that generic tutorials use.

```
supabase/migrations/016_signature_experiences.sql   schema + RLS

src/lib/experiences.ts          types + pure helpers (safe on client & server)
src/lib/experiences-schema.ts   zod schemas shared by the API routes
src/lib/experiences-data.ts     server-only reads (service-role client)

src/app/api/admin/experiences/…            CRUD, admin-cookie protected
src/app/api/admin/experience-dates/…       departures
src/app/api/admin/experience-bookings/…    list + status change
src/app/api/admin/experience-categories/   custom tags
src/app/api/experience-bookings/           PUBLIC booking endpoint (rate limited)

src/app/[locale]/experiences/page.tsx         listing (server component)
src/app/[locale]/experiences/[slug]/page.tsx  detail (server component)

src/components/experiences/       public UI (cards, filters, gallery, booking form)
src/components/admin/ExperiencesManager.tsx  + components/admin/experiences/*
```

### Key decisions

**Supabase is server-side only.** `src/lib/supabase.ts` is marked `server-only`
and uses the service-role key. Nothing in the browser talks to Supabase
directly — the booking form POSTs to `/api/experience-bookings` instead.

**Admin auth reuses the existing session.** There is no Supabase Auth user in
this project; `src/lib/admin-auth.ts` issues a signed, expiring cookie from a
shared `ADMIN_PASSWORD`. Every admin route starts with `requireAdmin(req)`. The
RLS policies in the migration are defence in depth for the anon key.

**Spots taken is never stored.** It is always `SUM(spots_requested)` over
non-cancelled bookings for that date. Pending and confirmed bookings both hold a
spot; cancelling one releases it immediately. This means the number cannot drift
out of sync with reality — the cost is one extra aggregate query per page, which
is batched across all dates in a single `IN (…)` lookup.

**Prices are server-derived.** The client never sends an amount. The booking
endpoint reads `experience_dates.price_override ?? experiences.price` and
multiplies by the requested spots.

**Bilingual content, English admin.** Public copy is stored in `*_ar` / `*_en`
column pairs and rendered through `next-intl`; the admin dashboard labels are
English, as specified. `npm run check:translations` enforces AR/EN key parity.

---

## 3. Admin guide

### Creating an experience

**Signature Experiences → New experience.** Required: both titles and a price.
Everything else is optional and can be filled in later.

- **Slug** — leave blank and it is derived from the English title, with a numeric
  suffix if that slug is taken. Changing it later changes the public URL.
- **Duration** — leave blank and the card derives it from the next trip date
  ("3 days / 2 nights"). Fill it in to override.
- **Gallery** — up to 6 image URLs (enforced in the database too).
- **Status** — `Draft` is invisible to the public. Flip it with the
  Publish/Unpublish button on the list without opening the editor.

### Trip dates

Open **Dates & bookings** on any experience.

- **Total spots** is editable inline; it cannot be set below the number already
  booked (the API rejects it and tells you the floor).
- **Close booking** hides the Book button while keeping the date listed — it
  shows as "Booking closed" with a waitlist link.
- **Cancel** marks the date cancelled; it greys out publicly.
- **Sold out is automatic** — no switch for it. When remaining hits zero the
  public card and date row switch to "Join waitlist", which opens WhatsApp.
- Deleting a date with active bookings is blocked; you get a confirm prompt that
  forces the issue only if you really mean it.

### Bookings

Per-experience under **Dates & bookings**, or all of them under the **All
bookings** tab. Change status with the dropdown in the row. Restoring a
cancelled booking is refused when the date no longer has room for it.

**Export CSV** exports exactly the rows currently on screen (filters applied),
UTF-8 with a BOM so Excel reads Arabic correctly.

### Tags

**Tags** tab. Add a custom tag with an English and an Arabic label; the slug is
derived automatically. Tags in use by an experience cannot be deleted, and
`other` is permanent as the fallback.

---

## 4. Public behaviour

**Listing (`/experiences`)** — an editorial hero, then a filter bar showing only
the categories that actually have published experiences, then the card grid.
Each card shows the hero image, category badge, title, partner, duration, the
next available date, spots remaining on that date (highlighted in coral at ≤ 4),
and the price. Sold-out cards swap "View experience" for "Join waitlist".

**Detail (`/experiences/[slug]`)** — full-bleed hero, description, partner block,
accordion itinerary, two-column included / not-included, gallery with a keyboard
-navigable lightbox (Esc / ← / →), and the dates list. On desktop the dates sit
in a sticky sidebar; on mobile they appear inline after the gallery.

**Booking** — "Book now" opens a modal with name, phone, email, spots, notes and
the agreement checkbox. On submit the request is validated again on the server
(date still open, enough spots, price recalculated), saved as `pending`, linked
to a `customers` record by normalised phone, and the admin notification fires.
The visitor sees the Arabic confirmation and a WhatsApp shortcut. The spots
count on the page updates immediately.

Rate limit: 5 requests per IP per hour, matching the other public forms.

---

## 5. Things worth knowing

- Both public pages use `export const revalidate = 60`, so a newly published
  experience or a freshly booked spot can be up to a minute stale on the public
  page. The admin dashboard always reads live.
- The in-memory rate limiter resets on every deploy and is per-instance — same
  trade-off as `/api/bookings` and `/api/trip-bookings`.
- The `experience_date_availability` view exists for ad-hoc SQL and reporting;
  the app computes availability in TypeScript so the same logic serves the
  booking endpoint and the pages.
