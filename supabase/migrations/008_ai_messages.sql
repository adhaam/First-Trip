-- WEEMAP SINAI · Migration 008 · Ask WEEMAP persistent conversation history
-- Additive only. Run after 007_home_explore_and_ai_leads.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_leads(session_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_messages_session_created_idx
  ON public.ai_messages (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_messages_expires_at_idx
  ON public.ai_messages (expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Deliberately no anon/authenticated policies. The n8n workflow must use a
-- dedicated trusted server credential for session-scoped transcript access.
COMMENT ON TABLE public.ai_messages IS
  'Ask WEEMAP transcript rows. Server-only access; no public RLS policy.';
COMMENT ON COLUMN public.ai_messages.session_id IS
  'Foreign key to the anonymous ai_leads.session_id browser session.';

COMMIT;
