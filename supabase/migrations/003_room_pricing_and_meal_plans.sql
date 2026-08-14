-- Room-based pricing: instead of a flat admin-set package price, the
-- package/stay total is now computed from real components — room price,
-- meal plan, transfer, and included/extra Sinai trips. See src/lib/pricing.ts
-- for the actual formula (computed server-side only, never trusted from the client).

ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS price_double_room NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_single_room NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Array of { key, label_ar, label_en, price_per_person_per_night, is_active }
  -- e.g. room-only / breakfast / half-board / all-inclusive, priced per property.
  ADD COLUMN IF NOT EXISTS meal_plans JSONB NOT NULL DEFAULT '[]';

-- The two (or however many) Sinai trips bundled into every package by
-- default — their price sums into the package total automatically.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS package_included_trip_ids UUID[] NOT NULL DEFAULT '{}';

-- What the customer actually picked, so the price can be reconstructed /
-- audited later and shown in the admin bookings detail view.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS room_type TEXT CHECK (room_type IN ('double', 'single')),
  ADD COLUMN IF NOT EXISTS meal_plan_key TEXT,
  ADD COLUMN IF NOT EXISTS extra_trip_ids UUID[] NOT NULL DEFAULT '{}';
