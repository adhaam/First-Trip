-- 042_newsletter_subscribers.sql
-- Restores the newsletter capability production never received (WEEMAP M4).
--
-- WHY
--   The M4 read-only preflight found that production has no
--   public.newsletter_subscribers: migration 001 (and the pre-migration
--   schema.sql / migration_v4.sql that also created it) never ran there. The
--   website's signup (POST /api/newsletter) and the Operations Center's
--   Newsletter screen (GET/PATCH /api/admin/newsletter) have been failing
--   against it. Historical 001 cannot simply be replayed: it grants an
--   anonymous INSERT policy, which the M4 architecture no longer allows.
--
-- CONTRACT (the current application, nothing more)
--   * Columns: id, email (unique; the server lower-cases and upserts on it),
--     locale ('ar' | 'en'), source (≤ 60 chars, e.g. 'homepage-footer'),
--     unsubscribed, created_at (admin list order), updated_at.
--   * Every read and write goes through the server with the service role:
--     RLS on, one service-role policy, no privilege at all for anon /
--     authenticated — no anonymous insert, unlike 001.
--   * Works on both shapes: creates the table where it is missing
--     (production), and on databases that already have it from 001 /
--     schema.sql / migration_v4.sql it only adds what is missing and removes
--     the public policies. New CHECKs are added NOT VALID so existing rows are
--     never rejected; they bind every new write.
--
-- Additive. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  locale       TEXT NOT NULL DEFAULT 'ar',
  source       TEXT NOT NULL DEFAULT 'homepage-footer',
  unsubscribed BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Older shapes (migration_v4.sql had no updated_at).
ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- The server upserts ON CONFLICT (email): exactly one unique index on email.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
    WHERE i.indrelid = 'public.newsletter_subscribers'::regclass
      AND i.indisunique AND i.indnatts = 1 AND a.attname = 'email'
  ) THEN
    CREATE UNIQUE INDEX newsletter_subscribers_email_key ON public.newsletter_subscribers (email);
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_newsletter_created ON public.newsletter_subscribers (created_at DESC);

-- Shape of new writes (existing rows are left as they are).
DO $$
DECLARE
  c TEXT[];
BEGIN
  FOREACH c SLICE 1 IN ARRAY ARRAY[
    ARRAY['newsletter_subscribers_locale_check', 'CHECK (locale IN (''ar'', ''en''))'],
    ARRAY['newsletter_subscribers_email_shape', 'CHECK (email = btrim(email) AND char_length(email) BETWEEN 3 AND 254)'],
    ARRAY['newsletter_subscribers_source_length', 'CHECK (source IS NULL OR char_length(source) <= 60)']
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public.newsletter_subscribers'::regclass AND conname = c[1]) THEN
      EXECUTE format('ALTER TABLE public.newsletter_subscribers ADD CONSTRAINT %I %s NOT VALID', c[1], c[2]);
    END IF;
  END LOOP;
END
$$;

-- updated_at maintenance: one trigger (older databases carry two names).
DROP TRIGGER IF EXISTS set_updated_at ON public.newsletter_subscribers;
DROP TRIGGER IF EXISTS update_newsletter_subscribers_updated_at ON public.newsletter_subscribers;
CREATE TRIGGER update_newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Server-only access.
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'newsletter_subscribers' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.newsletter_subscribers', p.policyname);
  END LOOP;
END
$$;
CREATE POLICY "newsletter_subscribers_service_role_all" ON public.newsletter_subscribers
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.newsletter_subscribers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

NOTIFY pgrst, 'reload schema';
