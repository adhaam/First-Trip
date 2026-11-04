-- Hotel description field correction — PRODUCTION (ugekpmogiecfsmydyjxr), owner-authorized only.
--
-- FINDING (production read-only audit, 2026-11-04): 19 active hotels have an EMPTY description_ar and a
-- bilingual description_en: the Arabic description, then (usually) an "English Description" heading,
-- then the English description. The site therefore shows both languages in the English field and falls
-- back to the same bilingual block on Arabic pages.
--
-- WHAT THIS DOES: for each REVIEWED row in the allowlist below, it splits that existing text in two —
-- the Arabic part goes into the empty description_ar, the English part stays in description_en.
-- Nothing is translated, invented, reworded or deleted: the only text dropped is the heading labels
-- ("English Description", "الوصف العربي" / "الوصف العربي المقترح") and blank lines, and that is proven
-- per row (whole text with whitespace and those labels removed must be identical before and after).
--   * Split at the single "English Description" heading line, or — for a row without a heading — at
--     the first paragraph that contains no Arabic letter (every later paragraph must have none).
--   * A row is refused (and the whole run aborts) unless the Arabic part is clearly Arabic, the English
--     part has no Arabic letter at all, the row is the reviewed one (id prefix + md5 of its current
--     description_en) and its description_ar is still empty.
--   * NOT in the allowlist, left untouched and reported to the owner: "Torino camp dahab" (811ec693…) —
--     its text describes a different hotel (Dahab Hills), so it needs the owner's own text.
--
-- ONE atomic DO statement:
--   * apply_changes = false (default) → dry run: raises 'RESULT DRY …' with the plan; nothing is kept.
--   * apply_changes = true            → backs the rows up into maintenance.desc_fix_20261104_accommodations,
--     updates only description_ar / description_en, and rolls back unless every other column of every
--     accommodation is byte-identical before and after, exactly the planned rows changed, and each row
--     now holds exactly the planned text.
-- Rollback: UPDATE public.accommodations a SET description_ar = b.row_before->>'description_ar',
--   description_en = b.row_before->>'description_en' FROM maintenance.desc_fix_20261104_accommodations b
--   WHERE b.id = a.id;
DO $descfix$
DECLARE
  apply_changes CONSTANT BOOLEAN := false;  -- set to true only for the authorized apply run
  expected_rows CONSTANT INTEGER := 18;
  labels CONSTANT TEXT := '\s|English Description\s*:?|الوصف العربي( المقترح)?\s*:?';
  r RECORD;
  parts TEXT[];
  paras TEXT[];
  n_paras INTEGER;
  k INTEGER;
  ar_txt TEXT;
  en_txt TEXT;
  split_how TEXT;
  fp_before TEXT;
  fp_after TEXT;
  planned INTEGER;
  changed INTEGER;
  report TEXT;
BEGIN
  IF current_database() <> 'postgres' THEN RAISE EXCEPTION 'desc fix: unexpected database %', current_database(); END IF;

  CREATE TEMP TABLE desc_fix_allow (id_prefix TEXT PRIMARY KEY, en_md5_prefix TEXT NOT NULL, label TEXT NOT NULL) ON COMMIT DROP;
  INSERT INTO desc_fix_allow (id_prefix, en_md5_prefix, label) VALUES
    ('a6b57434', '0ccba1a557', '4s hotel'),
    ('21ea47b0', '068ccffc87', 'ayana studios'),
    ('e0015379', 'ac4d6d8811', 'coral reef hotel'),
    ('d12e4317', 'e108663661', 'dahab beach lodge'),
    ('5d90bdd5', '84d9783254', 'Dahab hills'),
    ('2eaafe16', '31ba7132b3', 'golden star camp'),
    ('7b8760d7', '8b5b47dfcf', 'happy life resort'),
    ('3e5138e9', 'f40983c104', 'havana house'),
    ('44a4ea50', '7f809e1d2c', 'Miamy hotel'),
    ('88200822', 'ae87053d58', 'monica hotel'),
    ('ff9024e4', '521fc2d297', 'noya house'),
    ('d7ce0183', '705e81f374', 'Oricana hotel'),
    ('7002d0ff', 'caeba1c26e', 'Remal camp'),
    ('23078861', '1b9e651245', 'Roketa hotel'),
    ('226a7936', 'bf1f2fa891', 'Roots'),
    ('87f0ae04', 'd2890c1bd5', 'Safir Dahab Resort'),
    ('846ab5c5', 'c49b89714c', 'Tarakhan hotel'),
    ('6625c9fb', 'e8d88effeb', 'tropital dahab');

  CREATE TEMP TABLE desc_fix_plan (id UUID PRIMARY KEY, label TEXT, how TEXT, new_ar TEXT, new_en TEXT) ON COMMIT DROP;

  FOR r IN
    SELECT w.label, w.id_prefix, w.en_md5_prefix,
      (SELECT count(*) FROM public.accommodations x WHERE x.id::text LIKE w.id_prefix || '%') AS hits,
      a.id, a.description_ar, a.description_en
    FROM desc_fix_allow w
    LEFT JOIN public.accommodations a ON a.id::text LIKE w.id_prefix || '%'
    ORDER BY w.label
  LOOP
    IF r.hits <> 1 THEN RAISE EXCEPTION 'desc fix: % (%) matches % rows', r.label, r.id_prefix, r.hits; END IF;
    IF coalesce(btrim(r.description_ar), '') <> '' THEN
      RAISE EXCEPTION 'desc fix: % already has an Arabic description — refusing to overwrite', r.label;
    END IF;
    IF left(md5(coalesce(r.description_en, '')), 10) <> r.en_md5_prefix THEN
      RAISE EXCEPTION 'desc fix: % text changed since it was reviewed — re-review first', r.label;
    END IF;

    parts := regexp_split_to_array(r.description_en, '\r?\n[ \t]*English Description[ \t]*:?[ \t]*(\r?\n|$)', 'i');
    IF array_length(parts, 1) = 2 THEN
      ar_txt := btrim(regexp_replace(parts[1], '^\s*الوصف العربي( المقترح)?\s*:?\s*\r?\n', ''), E' \t\r\n');
      en_txt := btrim(parts[2], E' \t\r\n');
      split_how := 'heading';
    ELSIF array_length(parts, 1) = 1 THEN
      paras := regexp_split_to_array(btrim(r.description_en, E' \t\r\n'), '\r?\n[ \t]*(\r?\n[ \t]*)+');
      n_paras := array_length(paras, 1);
      k := 0;
      FOR i IN 1..n_paras LOOP
        EXIT WHEN length(regexp_replace(paras[i], '[^؀-ۿ]', '', 'g')) = 0;
        k := i;
      END LOOP;
      IF k = 0 OR k = n_paras THEN RAISE EXCEPTION 'desc fix: % has no clean Arabic/English paragraph boundary', r.label; END IF;
      ar_txt := array_to_string(paras[1:k], E'\n\n');
      en_txt := array_to_string(paras[k + 1:n_paras], E'\n\n');
      split_how := 'paragraphs';
    ELSE
      RAISE EXCEPTION 'desc fix: % has % "English Description" headings', r.label, array_length(parts, 1) - 1;
    END IF;

    IF length(regexp_replace(ar_txt, '[^؀-ۿ]', '', 'g')) < 20
       OR length(regexp_replace(ar_txt, '[^؀-ۿ]', '', 'g')) <= 4 * length(regexp_replace(ar_txt, '[^A-Za-z]', '', 'g')) THEN
      RAISE EXCEPTION 'desc fix: % Arabic part is not clearly Arabic', r.label;
    END IF;
    IF length(regexp_replace(en_txt, '[^؀-ۿ]', '', 'g')) <> 0 OR length(regexp_replace(en_txt, '[^A-Za-z]', '', 'g')) < 20 THEN
      RAISE EXCEPTION 'desc fix: % English part is not clean English', r.label;
    END IF;
    IF regexp_replace(r.description_en, labels, '', 'gi') <> regexp_replace(ar_txt || en_txt, labels, '', 'gi') THEN
      RAISE EXCEPTION 'desc fix: % split would lose or add text', r.label;
    END IF;

    INSERT INTO desc_fix_plan (id, label, how, new_ar, new_en) VALUES (r.id, r.label, split_how, ar_txt, en_txt);
  END LOOP;

  SELECT count(*) INTO planned FROM desc_fix_plan;
  IF planned <> expected_rows THEN RAISE EXCEPTION 'desc fix: planned % rows, expected %', planned, expected_rows; END IF;
  SELECT string_agg(p.label || ' [' || p.how || ', ar ' || length(p.new_ar) || ' / en ' || length(p.new_en) || ']', '; ' ORDER BY p.label)
    INTO report FROM desc_fix_plan p;

  IF NOT apply_changes THEN
    RAISE EXCEPTION 'RESULT DRY: would split % row(s): %', planned, report;
  END IF;

  SELECT md5(string_agg((to_jsonb(a) - 'description_ar' - 'description_en' - 'updated_at')::text, '|' ORDER BY a.id))
    INTO fp_before FROM public.accommodations a;

  CREATE SCHEMA IF NOT EXISTS maintenance;
  CREATE TABLE IF NOT EXISTS maintenance.desc_fix_20261104_accommodations (
    id UUID PRIMARY KEY, row_before JSONB NOT NULL, backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now());
  INSERT INTO maintenance.desc_fix_20261104_accommodations (id, row_before)
  SELECT a.id, to_jsonb(a) FROM public.accommodations a JOIN desc_fix_plan p ON p.id = a.id;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> expected_rows THEN RAISE EXCEPTION 'desc fix: backed up % rows, expected %', changed, expected_rows; END IF;

  UPDATE public.accommodations a
     SET description_ar = p.new_ar, description_en = p.new_en
    FROM desc_fix_plan p
   WHERE p.id = a.id AND coalesce(btrim(a.description_ar), '') = '';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> expected_rows THEN RAISE EXCEPTION 'desc fix: updated % rows, expected %', changed, expected_rows; END IF;

  SELECT md5(string_agg((to_jsonb(a) - 'description_ar' - 'description_en' - 'updated_at')::text, '|' ORDER BY a.id))
    INTO fp_after FROM public.accommodations a;
  IF fp_after IS DISTINCT FROM fp_before THEN
    RAISE EXCEPTION 'desc fix: a non-description column changed — rolled back';
  END IF;
  IF EXISTS (
    SELECT 1 FROM desc_fix_plan p JOIN public.accommodations a ON a.id = p.id
     WHERE a.description_ar IS DISTINCT FROM p.new_ar OR a.description_en IS DISTINCT FROM p.new_en
  ) THEN
    RAISE EXCEPTION 'desc fix: a row does not hold its planned text — rolled back';
  END IF;

  RAISE NOTICE 'RESULT APPLIED: split % row(s): %; fingerprint %', changed, report, fp_after;
END
$descfix$;
