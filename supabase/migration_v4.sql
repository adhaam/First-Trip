-- ═══════════════════════════════════════════════════════════════════════════
-- FIRST TRIP · v4 · Newsletter / lead capture
-- ───────────────────────────────────────────────────────────────────────────
-- Adds a single table `newsletter_subscribers` for the email-capture form at
-- the bottom of the site. Emails come in from public visitors, so RLS is set
-- up to allow only INSERTs from the anon key — reading and deleting is
-- reserved for the service role (i.e. the admin dashboard).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  locale       TEXT NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  source       TEXT,                 -- e.g. 'homepage-footer'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_newsletter_created ON newsletter_subscribers(created_at DESC);

-- ─── RLS ───
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- anyone can subscribe (INSERT only)
DROP POLICY IF EXISTS "public can subscribe" ON newsletter_subscribers;
CREATE POLICY "public can subscribe"
  ON newsletter_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- reading and updating is service-role only (used by the admin dashboard)
DROP POLICY IF EXISTS "service role reads all" ON newsletter_subscribers;
CREATE POLICY "service role reads all"
  ON newsletter_subscribers FOR SELECT
  TO service_role
  USING (true);
