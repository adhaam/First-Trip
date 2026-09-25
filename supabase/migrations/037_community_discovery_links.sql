-- 037_community_discovery_links.sql
-- Community posts as a discovery engine (WEEMAP V2 · M3 Discovery).
--
-- WHY
--   Community guides (dahab-guide, hidden-gems, stories, blog, ...) mention
--   real stays, trips, trip packages and Signature experiences by name, but
--   nothing on the public site turns that mention into a link. A reader of
--   "Ras Abu Galum: Sinai's Untouched Coastline" has no way to jump to the
--   actual Ras Abu Galum trip or book it. Conversely a stay/trip/package
--   detail page has no way to show "local guides that cover this place".
--
--   Any such relationship must be curated by an operator who has read the
--   post and confirmed the target is what the post is actually about — it
--   is never inferred automatically (no keyword matching, no shared
--   category guess). This table is the curated link.
--
-- CONTRACT
--   * community_post_links: one row per (post, target). `target_type` is a
--     small closed vocabulary of the public product lines this app can
--     currently deep-link into; `target_id` is that target's row id in its
--     own table (stays -> accommodations, trip -> sinai_trips,
--     trip_package -> trip_packages, signature_experience -> experiences).
--     There is deliberately NO FK on target_id: the four target tables are
--     different tables, and Postgres has no cross-table polymorphic FK.
--     Existence + active/published state is validated in the admin API
--     (src/app/api/admin/community-posts/[id]/links/route.ts) before a row
--     is written, and public readers (src/lib/community.ts) always re-join
--     against the live target table and skip a link if the target is gone
--     or inactive — so a stale target_id degrades to "not shown", never to
--     showing a dead or wrong link.
--   * post_id cascades: deleting a community post deletes its links.
--   * sort_order controls display order per post; created_at is audit only.
--   * unique(post_id, target_type, target_id) — a post can't link the same
--     target twice.
--   * RLS: public (anon/authenticated) can SELECT; only service_role can
--     write. The public site reads through the service-role server client
--     today (see src/lib/supabase.ts) like every other table here, but the
--     public-read policy is the same defense-in-depth already used for
--     sinai_trip_category_tags (migration 033).
--
-- Additive only. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.community_post_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('stay', 'trip', 'trip_package', 'signature_experience')),
  target_id   UUID NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_community_post_links_post ON public.community_post_links (post_id, sort_order);
-- Reverse lookup: "which posts link to this stay/trip/package/experience?"
-- (stay/trip detail pages' "Local guides" block).
CREATE INDEX IF NOT EXISTS idx_community_post_links_target ON public.community_post_links (target_type, target_id);

ALTER TABLE public.community_post_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_post_links_public_read" ON public.community_post_links;
CREATE POLICY "community_post_links_public_read" ON public.community_post_links
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "community_post_links_service_role_all" ON public.community_post_links;
CREATE POLICY "community_post_links_service_role_all" ON public.community_post_links
  FOR ALL USING (auth.role() = 'service_role');
