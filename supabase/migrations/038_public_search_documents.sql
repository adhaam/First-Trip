-- 038_public_search_documents.sql
-- Normalised, database-backed public search (WEEMAP V2 · M3 Discovery).
--
-- WHY
--   Public search matched raw columns with ILIKE, so Arabic spelling variants
--   failed: "ابو جلوم" did not find "أبو جلوم", and "بلو هول" did not find
--   "البلوهول". People type Arabic without hamza, taa marbuta or diacritics
--   as a matter of course. External search infrastructure is not warranted at
--   WEEMAP's catalogue size; one normalised view is.
--
-- CONTRACT
--   * weemap_search_normalize(text): lower-case; strips Arabic diacritics
--     (U+064B–U+065F, U+0670) and tatweel (U+0640); folds أ إ آ ٱ → ا,
--     ى → ي, ة → ه. It MUST stay identical to normalizeSearchText() in
--     src/lib/discovery/search-normalize.ts (supabase/tests checks samples).
--   * public_search_documents: one row per PUBLIC catalogue item. The
--     visibility rules are the public site's own: active stays, trips and
--     Sinai trip packages; active, non-archived shop/rent products;
--     published community posts that have a slug. Nothing internal (requests,
--     bookings, customers, staff) is ever in it. search_text is the
--     normalised Arabic + English title, category and description.
--   * The API requires EVERY normalised query token to appear in search_text
--     (AND of ILIKEs), then loads the matched rows from their own tables.
--   * Read by the server (service_role) only.
--
-- Additive only. Safe to re-run.

CREATE OR REPLACE FUNCTION public.weemap_search_normalize(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    regexp_replace(lower(COALESCE(value, '')), '[ً-ٰٟـ]', '', 'g'),
    'أإآٱىة',
    'اااايه')
$$;

CREATE OR REPLACE VIEW public.public_search_documents
WITH (security_invoker = true) AS
SELECT 'accommodation'::text AS doc_type, a.id, a.sort_order,
       public.weemap_search_normalize(concat_ws(' ', a.name_ar, a.name_en, a.type,
         a.description_ar, a.description_en)) AS search_text
  FROM public.accommodations a
 WHERE a.is_active
UNION ALL
SELECT 'trip', t.id, t.sort_order,
       public.weemap_search_normalize(concat_ws(' ', t.name_ar, t.name_en, t.category_ar, t.category_en,
         t.description_ar, t.description_en))
  FROM public.sinai_trips t
 WHERE t.is_active
UNION ALL
SELECT 'trip_package', p.id, p.sort_order,
       public.weemap_search_normalize(concat_ws(' ', p.name_ar, p.name_en,
         p.short_description_ar, p.short_description_en))
  FROM public.trip_packages p
 WHERE p.is_active
UNION ALL
SELECT 'product', c.id, c.sort_order,
       public.weemap_search_normalize(concat_ws(' ', c.name_ar, c.name_en, c.description_ar, c.description_en))
  FROM public.commerce_products c
 WHERE c.is_active AND c.archived_at IS NULL
UNION ALL
SELECT 'community_post', cp.id, cp.sort_order,
       public.weemap_search_normalize(concat_ws(' ', cp.title_ar, cp.title_en, cp.content_ar, cp.content_en))
  FROM public.community_posts cp
 WHERE cp.is_published AND cp.slug IS NOT NULL;

COMMENT ON VIEW public.public_search_documents IS
  'Public catalogue search documents (normalised text). Public rows only; server-side reads.';

REVOKE ALL ON public.public_search_documents FROM anon, authenticated;
GRANT SELECT ON public.public_search_documents TO service_role;
