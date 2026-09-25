-- Public search invariants (migration 038). Run by scripts/db-bootstrap-check.sh
-- against a disposable local database — never production. Rolled back.
--
--   1. weemap_search_normalize() folds the same Arabic variants as
--      normalizeSearchText() in src/lib/discovery/search-normalize.ts.
--   2. public_search_documents contains public rows only.
\set ON_ERROR_STOP 1

BEGIN;

DO $$
DECLARE
  visible_id UUID;
  hidden_id  UUID;
  n          INTEGER;
BEGIN
  IF weemap_search_normalize('رحلة رأس أبو جلوم البدويّة') <> 'رحله راس ابو جلوم البدويه' THEN
    RAISE EXCEPTION 'normaliser drifted: %', weemap_search_normalize('رحلة رأس أبو جلوم البدويّة');
  END IF;
  IF weemap_search_normalize('Blue HOLE') <> 'blue hole' THEN
    RAISE EXCEPTION 'normaliser does not lower-case';
  END IF;
  IF weemap_search_normalize('مـــصر إلى') <> 'مصر الي' THEN
    RAISE EXCEPTION 'normaliser keeps tatweel or alef variants';
  END IF;

  INSERT INTO sinai_trips (name_ar, name_en, price, is_active) VALUES ('رحلة إختبار', 'Search Visible', 10, true)
    RETURNING id INTO visible_id;
  INSERT INTO sinai_trips (name_ar, name_en, price, is_active) VALUES ('رحلة مخفية', 'Search Hidden', 10, false)
    RETURNING id INTO hidden_id;

  SELECT count(*) INTO n FROM public_search_documents WHERE id = visible_id AND search_text LIKE '%اختبار%';
  IF n <> 1 THEN RAISE EXCEPTION 'active trip missing from search (hamza-free query)'; END IF;
  SELECT count(*) INTO n FROM public_search_documents WHERE id = hidden_id;
  IF n <> 0 THEN RAISE EXCEPTION 'inactive trip exposed in public search'; END IF;
END $$;

ROLLBACK;
