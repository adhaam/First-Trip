-- WEEMAP SINAI · Migration 010 · Structured Ask WEEMAP qualification context
-- Additive only. Review and apply separately; this file is intentionally not
-- executed by the engineering audit.

BEGIN;

ALTER TABLE public.ai_leads
  ADD COLUMN IF NOT EXISTS qualification_context JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.ai_leads.qualification_context IS
  'Server-maintained, non-PII Ask WEEMAP qualification state. Values are user-provided context and safe quote summaries only; never raw pricing internals.';

CREATE INDEX IF NOT EXISTS ai_leads_qualification_context_gin_idx
  ON public.ai_leads USING GIN (qualification_context);

COMMIT;
