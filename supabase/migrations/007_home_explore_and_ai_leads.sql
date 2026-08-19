-- WEEMAP SINAI · Migration 007 · Home discovery media and Ask WEEMAP leads
-- Additive only. Run after 006_weemap_public_content_controls.sql.

BEGIN;

-- Existing Website Settings extension for the cinematic Home discovery band.
-- Empty values keep the application's built-in localized copy/media fallbacks.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS explore_media_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS explore_media_alt_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS explore_media_alt_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS explore_copy_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS explore_copy_en TEXT NOT NULL DEFAULT '';

-- Minimal lead record for Ask WEEMAP. Conversation/message persistence is
-- intentionally deferred until the n8n transcript contract is finalized.
CREATE TABLE IF NOT EXISTS public.ai_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  whatsapp TEXT NOT NULL CHECK (char_length(whatsapp) BETWEEN 7 AND 20),
  email TEXT CHECK (email IS NULL OR char_length(email) <= 254),
  locale TEXT NOT NULL CHECK (locale IN ('ar', 'en')),
  source TEXT NOT NULL DEFAULT 'website_ai' CHECK (source = 'website_ai'),
  initial_page_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_leads_created_at_idx
  ON public.ai_leads (created_at DESC);

ALTER TABLE public.ai_leads ENABLE ROW LEVEL SECURITY;

-- There are deliberately no anon/authenticated policies. Leads are written
-- and read only by validated server routes using the server-side service role.
DROP TRIGGER IF EXISTS update_ai_leads_updated_at ON public.ai_leads;
CREATE TRIGGER update_ai_leads_updated_at
  BEFORE UPDATE ON public.ai_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.ai_leads IS
  'Website Ask WEEMAP leads. Server-only access; no public RLS policy.';
COMMENT ON COLUMN public.ai_leads.session_id IS
  'Anonymous durable browser UUID. Never derived from contact details.';

COMMIT;
