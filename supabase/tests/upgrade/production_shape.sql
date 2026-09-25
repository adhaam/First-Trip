-- Turns a database built from the repository chain up to 028 into the shape
-- the M4 read-only preflight measured on WEEMAP SINAI production
-- (project ugekpmogiecfsmydyjxr, 2026-09-25). Used by
-- scripts/db-upgrade-check.sh (UPGRADE_PROFILE=production). LOCAL ONLY.
--
-- Differences found (catalog inventory, local 028 vs production):
--   * public.newsletter_subscribers does not exist (001 never ran there).
--   * ai_leads: no qualification_context (+ its GIN index, migration 010);
--     instead assigned_to, bot_enabled, handoff_status (+ CHECK),
--     qualification_state. site_settings has ai_bot_enabled.
--   * ai_messages.role also allows 'human'.
--   * bookings transfer_direction / transfer_type CHECKs allow NULL
--     explicitly; idx_bookings_accommodation_id / _status / _trip_date absent.
--   * experience_bookings FKs cascade on delete; experiences.category FK
--     cascades on update.
-- The script's own check compares the resulting catalog hash with the
-- production inventory (supabase/tests/upgrade/production_inventory.txt).
\set ON_ERROR_STOP 1

DROP TABLE IF EXISTS public.newsletter_subscribers;

DROP INDEX IF EXISTS public.ai_leads_qualification_context_gin_idx;
ALTER TABLE public.ai_leads DROP COLUMN IF EXISTS qualification_context;
ALTER TABLE public.ai_leads
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS handoff_status TEXT NOT NULL DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS qualification_state JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ai_leads DROP CONSTRAINT IF EXISTS ai_leads_handoff_status_check;
ALTER TABLE public.ai_leads ADD CONSTRAINT ai_leads_handoff_status_check
  CHECK (handoff_status = ANY (ARRAY['ai'::text, 'requested'::text, 'human'::text]));
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ai_bot_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.ai_messages DROP CONSTRAINT IF EXISTS ai_messages_role_check;
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'human'::text]));

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_transfer_direction_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_transfer_direction_check
  CHECK (((transfer_direction IS NULL) OR (transfer_direction = ANY (ARRAY['to_dahab'::text, 'from_dahab'::text, 'round_trip'::text]))));
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_transfer_type_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_transfer_type_check
  CHECK (((transfer_type IS NULL) OR (transfer_type = ANY (ARRAY['package_bus'::text, 'hiace'::text]))));
DROP INDEX IF EXISTS public.idx_bookings_accommodation_id;
DROP INDEX IF EXISTS public.idx_bookings_status;
DROP INDEX IF EXISTS public.idx_bookings_trip_date;

ALTER TABLE public.experience_bookings DROP CONSTRAINT IF EXISTS experience_bookings_experience_date_id_fkey;
ALTER TABLE public.experience_bookings ADD CONSTRAINT experience_bookings_experience_date_id_fkey
  FOREIGN KEY (experience_date_id) REFERENCES public.experience_dates(id) ON DELETE CASCADE;
ALTER TABLE public.experience_bookings DROP CONSTRAINT IF EXISTS experience_bookings_experience_id_fkey;
ALTER TABLE public.experience_bookings ADD CONSTRAINT experience_bookings_experience_id_fkey
  FOREIGN KEY (experience_id) REFERENCES public.experiences(id) ON DELETE CASCADE;
ALTER TABLE public.experiences DROP CONSTRAINT IF EXISTS experiences_category_fkey;
ALTER TABLE public.experiences ADD CONSTRAINT experiences_category_fkey
  FOREIGN KEY (category) REFERENCES public.experience_categories(slug) ON UPDATE CASCADE;

