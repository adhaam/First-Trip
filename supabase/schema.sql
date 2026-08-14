-- ─── First Trip — Supabase Schema ───
-- Run this in Supabase SQL Editor (one-time setup)
-- All tables have RLS enabled. Public can READ, only admins can WRITE.

-- ─── 1. Accommodations (hotels, chalets, camps) ───
CREATE TABLE IF NOT EXISTS accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hotel', 'chalet', 'camp')),
  description_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  images TEXT[] DEFAULT '{}',
  rating INTEGER DEFAULT 4 CHECK (rating BETWEEN 1 AND 5),
  location TEXT DEFAULT '',
  amenities_ar TEXT[] DEFAULT '{}',
  amenities_en TEXT[] DEFAULT '{}',
  price_per_night NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_4day NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_5day NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Governorate pricing ───
CREATE TABLE IF NOT EXISTS governorate_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governorate TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price_surcharge NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. Sinai Trips (day trips) ───
CREATE TABLE IF NOT EXISTS sinai_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  category_ar TEXT DEFAULT '',
  category_en TEXT DEFAULT '',
  images TEXT[] DEFAULT '{}',
  duration TEXT DEFAULT '',
  price NUMERIC(10,2) DEFAULT 0,
  includes_ar TEXT[] DEFAULT '{}',
  includes_en TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. Trip Dates (Sunday/Thursday calendar) ───
CREATE TABLE IF NOT EXISTS trip_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_date DATE UNIQUE NOT NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('sunday', 'thursday')),
  duration INTEGER NOT NULL CHECK (duration IN (4, 5)),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. Bookings ───
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('package', 'accommodation-only', 'transfer-only')),
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE SET NULL,
  governorate TEXT,
  trip_date DATE,
  return_date DATE,
  duration INTEGER,
  nights INTEGER,
  transfer_type TEXT CHECK (transfer_type IN ('package_bus', 'hiace')),
  transfer_direction TEXT CHECK (transfer_direction IN ('to_dahab', 'from_dahab', 'round_trip')),
  num_people INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  total_price NUMERIC(10,2),
  source TEXT NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_trip_date ON bookings(trip_date);
CREATE INDEX IF NOT EXISTS idx_bookings_accommodation_id ON bookings(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- ─── 6. Customers (auto-created from bookings) ───
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  total_bookings INTEGER DEFAULT 0,
  last_booking_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 7. Community Posts (News Feed) ───
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_ar TEXT DEFAULT '',
  content_en TEXT DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('blog', 'hidden-gems', 'stories', 'dahab-guide')),
  image_url TEXT,
  video_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 8. Site Settings (hero, contact, socials) ───
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  hero_type TEXT DEFAULT 'image' CHECK (hero_type IN ('image', 'video')),
  hero_media_url TEXT DEFAULT '',
  whatsapp_number TEXT DEFAULT '',
  phone_number TEXT DEFAULT '',
  email TEXT DEFAULT '',
  facebook_url TEXT DEFAULT '',
  instagram_url TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  refund_policy_ar TEXT DEFAULT '',
  refund_policy_en TEXT DEFAULT '',
  privacy_policy_ar TEXT DEFAULT '',
  privacy_policy_en TEXT DEFAULT '',
  terms_ar TEXT DEFAULT '',
  terms_en TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- ─── 9. Newsletter Subscribers ───
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL DEFAULT 'ar',
  source TEXT DEFAULT 'homepage-footer',
  unsubscribed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ROW LEVEL SECURITY (RLS) ───
ALTER TABLE accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE governorate_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinai_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- ─── Policies: PUBLIC can READ active content ───
CREATE POLICY "Public can read active accommodations" ON accommodations
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read governorate pricing" ON governorate_pricing
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read active sinai trips" ON sinai_trips
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read active trip dates" ON trip_dates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read published community posts" ON community_posts
  FOR SELECT USING (is_published = true);

CREATE POLICY "Public can read site settings" ON site_settings
  FOR SELECT USING (true);

-- ─── Policies: Newsletter subscribers ───
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full access" ON newsletter_subscribers
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Policies: ANYONE can INSERT a booking (public form) ───
CREATE POLICY "Anyone can create a booking" ON bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can create a customer" ON customers
  FOR INSERT WITH CHECK (true);

-- ─── Policies: Only AUTHENTICATED ADMINS can WRITE/DELETE ───
-- (Admins are users in auth.users table)
CREATE POLICY "Admins can manage accommodations" ON accommodations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage governorate pricing" ON governorate_pricing
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage sinai trips" ON sinai_trips
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage trip dates" ON trip_dates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage bookings" ON bookings
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage customers" ON customers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage community posts" ON community_posts
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage site settings" ON site_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── Auto-update updated_at trigger ───
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accommodations_updated_at BEFORE UPDATE ON accommodations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sinai_trips_updated_at BEFORE UPDATE ON sinai_trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletter_subscribers_updated_at BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Seed data: governorate pricing ───
INSERT INTO governorate_pricing (governorate, name_ar, name_en, price_surcharge) VALUES
  ('cairo', 'القاهرة', 'Cairo', 0),
  ('alexandria', 'الإسكندرية', 'Alexandria', 200),
  ('zagazig', 'الزقازيق', 'Zagazig', 150),
  ('mansoura', 'المنصورة', 'Mansoura', 150)
ON CONFLICT (governorate) DO NOTHING;

-- ─── Seed data: site settings row ───
INSERT INTO site_settings (id, whatsapp_number, phone_number, email) VALUES
  (1, '+201000000000', '+201000000000', 'info@firsttrip-eg.com')
ON CONFLICT (id) DO NOTHING;

-- ─── STORAGE BUCKETS (run separately in Supabase Dashboard → Storage) ───
-- 1. Create bucket: "accommodations" (public read)
-- 2. Create bucket: "community" (public read)
-- 3. Create bucket: "hero" (public read)

-- ─── ADMIN USER SETUP ───
-- Create your admin user via Supabase Dashboard → Authentication → Users
-- Then to make them admin, ensure they're in the "authenticated" role
-- (default for any signed-up user via Supabase Auth)
-- For more granular admin roles, create a `user_roles` table or use Supabase Auth JWT claims.