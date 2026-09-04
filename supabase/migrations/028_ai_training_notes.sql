-- 028_ai_training_notes.sql
--
-- RECOVERED FROM PRODUCTION. `public.ai_training_notes` exists in the live
-- database but no file in this repo — neither a migration nor schema.sql /
-- migration_v*.sql — ever created it, so a database built from this folder
-- was missing the table entirely.
--
-- It predates the supabase_migrations ledger too (it has no entry there),
-- which is why it went unnoticed from both directions. Reconstructed from
-- the live catalog: columns, constraints, indexes and RLS state, all
-- verified against production rather than rewritten from memory.
--
-- The table is currently empty, so this is purely a schema-parity fix.
--
-- Notes the owner writes to steer the Ask WEEMAP assistant, optionally
-- anchored to the AI message or lead session that prompted them.

CREATE TABLE IF NOT EXISTS public.ai_training_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note                TEXT NOT NULL
                        CHECK (char_length(note) >= 1 AND char_length(note) <= 2000),
  title               TEXT,
  category            TEXT,
  active              BOOLEAN NOT NULL DEFAULT true,
  related_message_id  UUID REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  related_session_id  UUID REFERENCES public.ai_leads(session_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Both indexes are partial on `active` — the read path only ever wants live
-- notes, and the table is written far more often than it is pruned.
CREATE INDEX IF NOT EXISTS ai_training_notes_session_idx
  ON public.ai_training_notes (related_session_id) WHERE (active = true);
CREATE INDEX IF NOT EXISTS ai_training_notes_active_idx
  ON public.ai_training_notes (active, created_at DESC) WHERE (active = true);

-- RLS on with no policy: reachable only through the service role, matching
-- production. Supabase's linter reports this as INFO (rls_enabled_no_policy)
-- rather than an error — it is the intended deny-by-default for an
-- admin-only table, not an oversight.
ALTER TABLE public.ai_training_notes ENABLE ROW LEVEL SECURITY;

-- No updated_at trigger, deliberately: production has none on this table,
-- unlike most others here. Adding one would make this folder diverge from
-- the live database in the opposite direction. If the column should
-- self-maintain, that is a real change to make on purpose, not a silent
-- side effect of writing this file.
