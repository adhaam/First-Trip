-- 020_partner_inquiries.sql
-- Partner Inquiries — businesses/people CONTACTING WEEMAP to become a
-- partner, submitted via the public "Partner with WEEMAP" page form.
--
-- NOT to be confused with `experience_partners` (migration 018), which is
-- the internal list of partners ALREADY working with Signature Experiences
-- (dive shops, kite centers, etc.) and deliberately has no public SELECT
-- policy. `partner_inquiries` is a brand-new, separate table: a public lead
-- inbox for the Admin to triage, not an operational partner record.
--
-- Additive and non-destructive: CREATE TABLE IF NOT EXISTS, no drops or
-- renames of any existing table/column. Safe to run against a fresh
-- database or one that already has this table.

CREATE TABLE IF NOT EXISTS public.partner_inquiries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  business_name    TEXT,
  phone            TEXT NOT NULL,
  email            TEXT,
  partnership_type TEXT,
  message          TEXT,
  status           TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'contacted', 'in_discussion', 'closed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.partner_inquiries IS
  'Inbound leads from businesses/people asking to become a WEEMAP partner, submitted via the public /partner page form. Distinct from experience_partners (migration 018), which tracks partners already operationally onboarded — that table is internal-only and unrelated to this one.';

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_status ON public.partner_inquiries (status);
CREATE INDEX IF NOT EXISTS idx_partner_inquiries_created ON public.partner_inquiries (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — same convention as every other table in this repo (see 018): no
-- Supabase Auth sessions anywhere, admin routes gate via a custom cookie
-- (requireAdmin()) and always talk to Supabase through the service-role
-- key. Public INSERT is allowed (a prospective partner submits an inquiry
-- without being "admin"); SELECT/UPDATE are service-role only.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.partner_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_inquiries_service_role_all" ON public.partner_inquiries;
CREATE POLICY "partner_inquiries_service_role_all" ON public.partner_inquiries
  FOR ALL USING (auth.role() = 'service_role');

-- Public INSERT stays (defense in depth — the public API route also uses
-- the service-role client itself, so this policy is not the primary gate).
-- Deliberately NO public SELECT policy.
DROP POLICY IF EXISTS "partner_inquiries_public_insert" ON public.partner_inquiries;
CREATE POLICY "partner_inquiries_public_insert" ON public.partner_inquiries
  FOR INSERT WITH CHECK (true);
