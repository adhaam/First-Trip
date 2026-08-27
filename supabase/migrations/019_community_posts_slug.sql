-- 019_community_posts_slug.sql
-- Adds SEO-friendly slugs to `community_posts` for the new
-- `/community/[slug]` article route (Community SEO v2).
--
-- `community_posts` is a pre-existing, untracked table (like `experiences`
-- was before migration 018) — confirmed live in production with 30
-- published rows across 4 of the 14 `PostCategory` values (blog,
-- dahab-guide, hidden-gems, stories); no category drift found against the
-- app-side enum. `updated_at` (with an `update_community_posts_updated_at`
-- trigger) was also found already live but untracked — reconciled here
-- idempotently alongside the new `slug` column.
--
-- Purely additive and non-destructive: every column addition uses
-- ADD COLUMN IF NOT EXISTS, the backfill UPDATE only touches rows where
-- slug IS NULL, and no existing column/table/row is altered or dropped.
-- Safe to run whether `updated_at`/its trigger already exist (fresh no-op)
-- or not (created here).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Columns
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS slug       TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Unique index instead of an inline UNIQUE constraint so this statement
-- stays idempotent (IF NOT EXISTS) across re-runs.
CREATE UNIQUE INDEX IF NOT EXISTS community_posts_slug_key ON public.community_posts (slug);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Backfill deterministic slugs from title_en, only where slug is null.
--    lowercase → non-alphanumeric runs to '-' → trim leading/trailing '-',
--    with the row's short id suffix appended so collisions between two
--    posts that slugify to the same base string can never happen.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.community_posts
SET slug = trim(both '-' from regexp_replace(lower(coalesce(title_en, '')), '[^a-z0-9]+', '-', 'g'))
           || '-' || substring(id::text, 1, 8)
WHERE slug IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. updated_at trigger — recreated idempotently in case this table never
--    had it (fresh install); no-op where it already exists live.
--    Reuses the shared public.update_updated_at_column() function already
--    used by every other table's updated_at trigger in this repo.
-- ─────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_community_posts_updated_at ON public.community_posts;
CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Index for the new slug-based lookup path (getCommunityPostBySlug).
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_community_posts_slug ON public.community_posts (slug);
