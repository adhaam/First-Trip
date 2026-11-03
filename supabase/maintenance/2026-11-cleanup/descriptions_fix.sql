-- Hotel description field correction — PRODUCTION (ugekpmogiecfsmydyjxr), owner-authorized only.
-- Moves Arabic text that was saved into accommodations.description_en (the old single admin field)
-- into the empty description_ar. ONE atomic DO statement:
--   * :apply = false (default) → dry run: always raises 'RESULT DRY …' listing what WOULD move; nothing kept.
--   * :apply = true            → backs the affected rows up into maintenance.desc_fix_20261104_accommodations,
--     updates only description_ar / description_en, and refuses (rolls back) unless every other column of
--     every accommodation is byte-identical before and after and each moved text is exactly preserved.
-- A row moves ONLY when description_ar is empty AND description_en is clearly Arabic (≥ 20 Arabic
-- letters and more than 4× as many Arabic as Latin letters). Mixed or ambiguous rows are reported,
-- never changed. Nothing is invented, translated or deleted: the English field becomes empty only
-- because its content was not English.
DO $descfix$
DECLARE
  apply_changes CONSTANT BOOLEAN := false;  -- set to true only for the authorized apply run
  fp_before TEXT;
  fp_after TEXT;
  moved INTEGER;
  movable TEXT;
  ambiguous TEXT;
BEGIN
  IF current_database() <> 'postgres' THEN RAISE EXCEPTION 'desc fix: unexpected database %', current_database(); END IF;

  CREATE TEMP TABLE desc_fix_candidates ON COMMIT DROP AS
  SELECT a.id, a.name_en, btrim(a.description_en) AS arabic_text,
    length(regexp_replace(coalesce(a.description_en, ''), '[^؀-ۿ]', '', 'g')) AS ar_letters,
    length(regexp_replace(coalesce(a.description_en, ''), '[^A-Za-z]', '', 'g')) AS latin_letters
  FROM public.accommodations a
  WHERE coalesce(btrim(a.description_ar), '') = '';

  SELECT string_agg(name_en, ', ' ORDER BY name_en) INTO movable FROM desc_fix_candidates
   WHERE ar_letters >= 20 AND ar_letters > latin_letters * 4;
  SELECT string_agg(name_en || ' (ar ' || ar_letters || ' / latin ' || latin_letters || ')', ', ' ORDER BY name_en) INTO ambiguous
    FROM desc_fix_candidates
   WHERE ar_letters > 0 AND NOT (ar_letters >= 20 AND ar_letters > latin_letters * 4);

  IF NOT apply_changes THEN
    RAISE EXCEPTION 'RESULT DRY: would move % row(s): [%]; ambiguous, left alone: [%]',
      (SELECT count(*) FROM desc_fix_candidates WHERE ar_letters >= 20 AND ar_letters > latin_letters * 4),
      coalesce(movable, ''), coalesce(ambiguous, '');
  END IF;

  SELECT md5(string_agg((to_jsonb(a) - 'description_ar' - 'description_en' - 'updated_at')::text, '|' ORDER BY a.id))
    INTO fp_before FROM public.accommodations a;

  CREATE SCHEMA IF NOT EXISTS maintenance;
  CREATE TABLE IF NOT EXISTS maintenance.desc_fix_20261104_accommodations (
    id UUID PRIMARY KEY, row_before JSONB NOT NULL, backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now());
  INSERT INTO maintenance.desc_fix_20261104_accommodations (id, row_before)
  SELECT a.id, to_jsonb(a) FROM public.accommodations a
    JOIN desc_fix_candidates c ON c.id = a.id
   WHERE c.ar_letters >= 20 AND c.ar_letters > c.latin_letters * 4
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.accommodations a
     SET description_ar = c.arabic_text, description_en = ''
    FROM desc_fix_candidates c
   WHERE c.id = a.id AND c.ar_letters >= 20 AND c.ar_letters > c.latin_letters * 4;
  GET DIAGNOSTICS moved = ROW_COUNT;

  SELECT md5(string_agg((to_jsonb(a) - 'description_ar' - 'description_en' - 'updated_at')::text, '|' ORDER BY a.id))
    INTO fp_after FROM public.accommodations a;
  IF fp_after IS DISTINCT FROM fp_before THEN
    RAISE EXCEPTION 'desc fix: a non-description column changed — rolled back';
  END IF;
  IF EXISTS (
    SELECT 1 FROM maintenance.desc_fix_20261104_accommodations b JOIN public.accommodations a ON a.id = b.id
     WHERE a.description_ar IS DISTINCT FROM btrim(b.row_before ->> 'description_en')
  ) THEN
    RAISE EXCEPTION 'desc fix: a moved text does not match its original — rolled back';
  END IF;

  RAISE NOTICE 'RESULT APPLIED: moved % row(s): [%]; ambiguous, left alone: [%]; fingerprint %',
    moved, coalesce(movable, ''), coalesce(ambiguous, ''), fp_after;
END
$descfix$;
