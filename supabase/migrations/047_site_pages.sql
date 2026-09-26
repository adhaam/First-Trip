-- 047_site_pages.sql
--
-- site_pages: an explicit, owner-controlled source of truth for landing-page
-- heroes and copy, replacing catalogue[0] cascades that picked whichever
-- accommodation/trip/package/post happened to sort first as the public hero
-- image (see docs/m2/BRIEF.md audit — book-dahab, sinai-trips, packages,
-- explore, community). Every page-content override is nullable: NULL means
-- "use the designed i18n copy / static fallback image", never an empty string
-- shown to guests. Written only from the Website admin workspace
-- (src/components/admin/website/WebsiteManager.tsx via
-- src/app/api/admin/site-pages/route.ts); read publicly by every landing
-- page through src/lib/site-pages.ts.
--
-- RLS follows migration 041's rule (every table has an explicit policy or no
-- anon/authenticated grant): this table's content IS the public page, so
-- anon/authenticated SELECT is allowed outright — unlike editions (044/045),
-- there are no internal cost/worksheet columns here. Writes are service-role
-- only, matching every other admin-managed table.
--
-- Seed rows select a hero per page. stay uses the first active accommodation by
-- sort_order, created_at: NULLIF(image_url), then NULLIF(images[1]), else
-- '/media/heroposter.webp'. sinai_trips uses NULLIF(images[1]) from the first
-- active trip by sort_order, created_at (NULL if empty). packages uses active
-- packages ordered featured DESC, sort_order ASC; the packages page stable-sorts
-- the loader's sort_order output featured-first, and the loader's invalid-totals
-- filter is not replicated. explore uses the first non-empty candidate from the
-- first active trip image, first active package image by sort_order (no featured
-- sort), then first published community post image by is_pinned DESC, sort_order.
-- community uses the first published post with a non-empty image_url by
-- is_pinned DESC, sort_order. home/experiences/shop/rent use NULL.

CREATE TABLE IF NOT EXISTS public.site_pages (
  page_key          TEXT PRIMARY KEY CHECK (page_key IN (
    'home', 'stay', 'explore', 'sinai_trips', 'packages',
    'experiences', 'shop', 'rent', 'community'
  )),
  hero_image_url    TEXT,
  hero_image_alt_en TEXT,
  hero_image_alt_ar TEXT,
  eyebrow_en        TEXT,
  eyebrow_ar        TEXT,
  title_en          TEXT,
  title_ar          TEXT,
  body_en           TEXT,
  body_ar           TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        TEXT
);

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_pages_public_read" ON public.site_pages;
CREATE POLICY "site_pages_public_read" ON public.site_pages
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated — writes go through
-- the service-role client only (src/app/api/admin/site-pages/route.ts).

DROP TRIGGER IF EXISTS set_updated_at ON public.site_pages;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Seed page hero images ───

-- stay: first active accommodation by sort_order, created_at; use non-empty
-- image_url, then non-empty images[1], else '/media/heroposter.webp'.
INSERT INTO public.site_pages (page_key, hero_image_url)
SELECT 'stay', COALESCE(
  NULLIF(a.image_url, ''),
  NULLIF(a.images[1], ''),
  NULLIF('/media/heroposter.webp', '')
)
FROM public.accommodations a
WHERE a.is_active = true
ORDER BY a.sort_order ASC, a.created_at ASC
LIMIT 1
ON CONFLICT (page_key) DO NOTHING;

-- sinai_trips: first active trip by sort_order, created_at; use images[1], or
-- NULL when it is empty.
INSERT INTO public.site_pages (page_key, hero_image_url)
SELECT 'sinai_trips', NULLIF(t.images[1], '')
FROM public.sinai_trips t
WHERE t.is_active = true
ORDER BY t.sort_order ASC, t.created_at ASC
LIMIT 1
ON CONFLICT (page_key) DO NOTHING;

-- packages: first active package by featured DESC, sort_order ASC; use its
-- non-empty image, then the first bundled trip's non-empty images[1].
INSERT INTO public.site_pages (page_key, hero_image_url)
-- The packages page stable-sorts the loader's sort_order output featured-first;
-- the loader's invalid-totals filter is not replicated here.
SELECT 'packages', COALESCE(
  NULLIF(p.image, ''),
  (
    SELECT NULLIF(t.images[1], '')
    FROM public.trip_package_items i
    JOIN public.sinai_trips t ON t.id = i.trip_id
    WHERE i.package_id = p.id
    ORDER BY i.sort_order ASC
    LIMIT 1
  )
)
FROM public.trip_packages p
WHERE p.is_active = true
ORDER BY p.featured DESC, p.sort_order ASC
LIMIT 1
ON CONFLICT (page_key) DO NOTHING;

-- explore: use the first non-empty result from the trip, package, and community
-- post candidates below, in that order.
INSERT INTO public.site_pages (page_key, hero_image_url)
-- Candidates are the first active trip image by sort_order, created_at; the first
-- active package image by sort_order without a featured sort; and the first
-- published post image by is_pinned DESC, sort_order.
SELECT 'explore', COALESCE(
  (SELECT NULLIF(t.images[1], '') FROM public.sinai_trips t
   WHERE t.is_active = true
   ORDER BY t.sort_order ASC, t.created_at ASC LIMIT 1),
  (SELECT NULLIF(p.image, '') FROM public.trip_packages p
   WHERE p.is_active = true
   ORDER BY p.sort_order ASC LIMIT 1),
  (SELECT NULLIF(c.image_url, '') FROM public.community_posts c
   WHERE c.is_published = true
   ORDER BY c.is_pinned DESC, c.sort_order ASC LIMIT 1)
)
ON CONFLICT (page_key) DO NOTHING;

-- community: first published post with a non-empty image_url by is_pinned DESC,
-- sort_order.
INSERT INTO public.site_pages (page_key, hero_image_url)
SELECT 'community', NULLIF(c.image_url, '')
FROM public.community_posts c
WHERE c.is_published = true
  AND NULLIF(c.image_url, '') IS NOT NULL
ORDER BY c.is_pinned DESC, c.sort_order ASC
LIMIT 1
ON CONFLICT (page_key) DO NOTHING;

-- home/experiences/shop/rent: insert each page with hero_image_url left NULL.
INSERT INTO public.site_pages (page_key)
VALUES ('home'), ('experiences'), ('shop'), ('rent')
ON CONFLICT (page_key) DO NOTHING;
