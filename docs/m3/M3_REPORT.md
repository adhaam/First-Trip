# WEEMAP M3 — Operations Center + Discovery report

Base: M2 `3294772`. Nothing pushed, deployed, or applied to production. All acceptance ran
against the local Docker stack and a local `next build` / `next start`.

## Commits
| Commit | Batch |
|---|---|
| `dfe2f15` | Foundation: staff identity, role policy, actor-attributed audit (035); payment ledger, request → booking conversion, queue view, customer events (036); `requireStaff` on every admin route |
| `ed453a9` | Operations Center APIs and UI, transport configuration, discovery track (037), fixtures, docs |
| `7aa5cea` | Typed ops routes, list-page SEO (CollectionPage/ItemList, breadcrumbs, per-page OG), data-derived intros, Arabic ops copy |
| `b25558c` | Acceptance fixes: normalised Arabic search (038), readable request journey, reload after status change, SEO titles, accessibility |
| (this) | Report |

## What shipped
- **Operations Center:** an action-first shell. Its first screen is **Today**: every metric
  tile links to a filtered queue. It lists needs-action items (oldest first), exceptions
  (unpaid close to service, service passed, refund due, stale, unconfirmed transfer),
  arrivals, departures, trips, transfers, the next 7 days, and recent activity with actor
  names. A **work queue** unifies stays/transfers, Sinai trips and packages, Signature, Trip
  Builder requests, and orders/rentals. It has views, filters, search, pagination, and
  derived next action, waiting time, and staleness. The **item detail** shows status
  actions (only allowed transitions, and it rejects a stale screen), staff notes (the
  customer's words stay read-only), payments, and a history of status, payments and audit.
  A **customer profile** gives one person one history. Also added: **global admin search**
  and a **catalogue health** view. Legacy CRUD screens remain reachable.
- **Staff and security:** staff sign in with personal accounts. There are three roles:
  owner, admin and operations. Access is enforced server-side on every admin route (401/403).
  Sessions are revoked immediately when someone is disabled, or their role, email or
  password changes. The last owner can't be removed. The legacy shared password works only
  to create the first owner. Details are in `docs/m3/OPERATIONS.md`.
- **Actor audit:** `status_history`, `audit_log` (catalogue, pricing, transport, settings,
  staff, and request field edits), `payment_records` and domain events all record who acted.
  The actor comes from an `x-weemap-actor` header, which the database trusts only on
  service-role requests.
- **Request → booking:** a request moves checking → alternatives/awaiting payment →
  **Convert**. Conversion creates the stay/transport booking plus one trip booking per
  experience, at the frozen quote prices. It is idempotent even under a parallel double
  click, and it keeps provenance. The request stays the untouched record of what the
  customer asked for; its panel is labelled "as submitted — read-only" and shows the frozen
  quote breakdown and payment split.
- **Payments:** an append-only ledger with methods Vodafone Cash, InstaPay, cash, card link
  (on request), bank transfer and other. It refuses money before confirmation,
  over-payment, over-refund, and a stale screen. `payment_status` is derived by the
  database. `payment_kind` is never touched. The 50/50 and 100% expectations come from
  the policies. Edit routes reject direct payment fields.
- **Transport configuration:** a screen with the operating schedule (mode, weekly rules,
  blackout/extra dates, and a 4-week preview from the same loader the public Builder uses)
  kept separate from commercial stay patterns. A pattern with no service on its days is
  refused, and so is removing a rule a pattern depends on. Changes appear on `/plan`
  immediately.
- **Search:** public search runs on a normalised view (038). It handles Arabic spelling
  variants and split/joined words, covers stays, trips, Sinai packages, shop, rent and
  community, and never returns internal records. Admin search covers customers, references,
  bookings, orders and the catalogue.
- **SEO/GEO:** every public page has its own title, description, canonical, ar/en/x-default
  hreflang, og:url, and robots rules (noindex for cart, search, Signature build, and
  prefilled `/plan`). Also done: an accurate sitemap, breadcrumbs everywhere, a
  CollectionPage/ItemList of rendered items on list pages, and LodgingBusiness, TouristTrip,
  Product/Offer and Article on detail pages. Nothing is fabricated: invented organisation
  coordinates were removed, and there is no rating or priceRange. Short intros on
  explore/trips/stays/packages are built only from data.
- **Community discovery:** curated links (037) connect a community post to a stay, trip,
  package or Signature experience. Articles offer "Plan it with WEEMAP" plus a Build Your
  Trip prefill. Detail pages show a reverse "Local guides" block. Nothing is inferred.
- **AGENEON boundary:** see `docs/m3/AGENEON_BOUNDARY.md`. The outbox vocabulary now covers
  requests, status, payments recorded/refunded, request conversion, orders/rentals and
  customer created/updated/merged. Nothing is published yet.

## Migrations added (local only, not applied to production)
035 staff identity and audit · 036 Operations Center · 037 community discovery links ·
038 public search documents. See the preflight in `supabase/migrations/README.md`.

## Gates (final)
- 532/532 tests.
- Typecheck clean. ESLint: 0 problems.
- Translation parity: 1,783 keys each.
- Migrations 001–038 contiguous.
- The full from-scratch rebuild passes, with DB regression suites `operations_center`,
  `payment_kind_invariants` and `public_search`.
- `next build` OK.

## Browser and API acceptance (production build, local DB)
- **Owner, English desktop:**
  - Legacy bootstrap → owner created → legacy revoked.
  - Today view.
  - New Trip Builder request (`WR-2609-0003`, AR contact): readable journey, frozen quote
    28,100 reconciling line by line.
  - Transitions through the UI.
  - Stale screen rejected ("changed while you were looking").
  - Invalid transition 409.
  - Converted in the UI: 23,500 + 1,800 + 2,800.
  - Deposit of 11,750 recorded in the UI.
- **Operations role, Arabic mobile and tablet (RTL):**
  - Today tiles and queue cards.
  - Transport screen read-only.
  - Owner-only navigation hidden.
  - 403 on catalogue, transport, staff and audit writes.
- **Other paths:**
  - Merch + rental order: payment refused before confirmation; ledger payment; order and
    rental workflow; events.
  - Signature request: planning → awaiting payment, quote, partial card-link payment
    attributed.
  - Customer profile: one history, outstanding 4,600.
  - Catalogue price edit: operations 403, owner 200, audited, reflected publicly after ISR.
  - Disabled staff: session 401 at once, cannot sign in, re-enable does not revive old
    sessions.
  - Transport blackout blocked the public quote for that date.
- **Discovery:**
  - AR and EN search.
  - Canonical, hreflang and og:url.
  - Sitemap (88 URLs, public only).
  - robots.txt.
  - JSON-LD parsed on 13 pages, no fabricated fields.
  - Community → trip/stay/Build Your Trip.
  - Trip → local guides.
- **Accessibility:** axe WCAG 2 A/AA is clean on Today, the queue, the item detail, the
  customer profile and transport screens, public search, packages and a community article,
  after fixing the rail focusability and cancel-button contrast. Keyboard order and visible
  focus were checked.

## Defects found and fixed during M3
- A stale payment raised SQLSTATE 40001, which hung PostgREST; it now uses PT409 (HTTP 409).
- `Date.parse` accepted 2026-02-30 in transport validation.
- The transport rule edit sent immutable fields and `notes: null`.
- Transport and catalogue-health response shapes were mismatched between the UI and the API.
- Item detail did not reload after a status change.
- The request panel showed raw ids and "no quote lines".
- The home `<title>` rendered an i18n key.
- Invented organisation GeoCoordinates were in the structured data.
- Arrivals counted Sinai trips.
- Arabic search missed spelling variants.
- The home rail was not keyboard-focusable.
- The destructive button had low contrast.
- Arabic operations copy used transliterations and dialect.
- Codex's partial work had wrong next-action precedence (shop orders shown as "collect
  payment").

## Known debt (deferred to M4)
- Production: apply 029–038 after a snapshot, then create the first owner and retire
  `ADMIN_PASSWORD`.
- Legacy RLS policies `USING auth.role() = 'authenticated'` on `bookings` and `customers`
  (from the pre-M1 schema) should be tightened in the security hardening pass.
- The M1 order workflow routes pickup orders through `out_for_delivery` (there is no
  ready → completed). It is kept as authoritative, and needs a business decision.
- `transfer_settings` Arabic service names still carry old wording ("نقل الباكدج"). This is
  catalogue data, editable in Transfers pricing.
- The queue derives views in memory over at most 1,000 open items. That's fine at today's
  scale; revisit if volume grows.
- Staff sign-in has no MFA or password-reset-by-email (the owner resets passwords). The
  login rate limit is per process.
- There is no domain-event publisher, as intended; AGENEON integration comes later.
- Real photography is still pending, and `images.unoptimized` remains.

## Workforce note
Codex hit its usage limit mid-batch (it resets 2026-09-28). A second Codex launch was blocked
by the permission classifier and was not retried. Sonnet 5 workers and the lead covered that
scope. Hermes ran a read-only security and i18n audit: no security findings, and three
Arabic wording issues, all fixed.

## Can M4 begin?
Yes.
