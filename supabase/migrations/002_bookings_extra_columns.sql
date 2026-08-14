-- Bookings table was missing columns the app already writes to
-- (return_date, transfer_type, transfer_direction, nights) plus a new
-- `source` column so the dashboard can tell website bookings apart from
-- ones an admin logged manually (phone / WhatsApp / walk-in).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS return_date DATE,
  ADD COLUMN IF NOT EXISTS transfer_type TEXT CHECK (transfer_type IN ('package_bus', 'hiace')),
  ADD COLUMN IF NOT EXISTS transfer_direction TEXT CHECK (transfer_direction IN ('to_dahab', 'from_dahab', 'round_trip')),
  ADD COLUMN IF NOT EXISTS nights INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'manual'));

CREATE INDEX IF NOT EXISTS idx_bookings_trip_date ON bookings(trip_date);
CREATE INDEX IF NOT EXISTS idx_bookings_accommodation_id ON bookings(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
