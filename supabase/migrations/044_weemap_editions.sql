-- 044_weemap_editions.sql
-- WEEMAP Editions V1 — limited, scheduled journeys built around one reason to
-- travel. Public name "WEEMAP Editions" / "إصدارات WEEMAP"; this is the
-- public entry point that will replace the "Signature" landing. Additive
-- only — no Signature/experiences table is touched, altered or dropped.
--
-- Column-level privacy note: Postgres RLS is row-level, not column-level, so
-- the "public_read" policy below (like experiences_public_read in 018) only
-- gates which ROWS an anon/authenticated session could see if it ever read
-- this table directly. The app never does that — every fetch goes through
-- the service-role client (see src/lib/supabase.ts, mirrored by
-- getTripPackages/getExperiences) — so the real, load-bearing guarantee that
-- internal columns (cost_variable_per_guest_egp, cost_fixed_egp,
-- contingency_pct, partner_id, min_group_size) never reach a browser is an
-- explicit public column list in src/lib/editions-data.ts, never `select *`.
-- The RLS policy exists for defense in depth and parity with 041's rule that
-- every table must have an explicit policy or no anon/authenticated grant.

CREATE TABLE IF NOT EXISTS public.editions (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                            TEXT NOT NULL UNIQUE,
  title_en                       TEXT NOT NULL,
  title_ar                       TEXT NOT NULL,
  short_description_en           TEXT NOT NULL DEFAULT '',
  short_description_ar           TEXT NOT NULL DEFAULT '',
  full_description_en            TEXT NOT NULL DEFAULT '',
  full_description_ar            TEXT NOT NULL DEFAULT '',
  category                       TEXT NOT NULL
    CHECK (category IN ('LEARN', 'RETREAT', 'ADVENTURE', 'MUSIC_EVENT', 'SPECIAL')),
  status                         TEXT NOT NULL DEFAULT 'COMING_SOON'
    CHECK (status IN (
      'COMING_SOON', 'OPEN', 'GUARANTEED', 'FEW_SPOTS', 'SOLD_OUT',
      'WAITLIST', 'COMPLETED', 'HIDDEN'
    )),
  featured                        BOOLEAN NOT NULL DEFAULT false,
  published                       BOOLEAN NOT NULL DEFAULT false,
  sort_order                      INTEGER NOT NULL DEFAULT 0,
  hero_image_url                  TEXT,
  start_date                      DATE,
  end_date                        DATE,
  location_en                     TEXT,
  location_ar                     TEXT,
  price_per_person_egp            NUMERIC CHECK (price_per_person_egp IS NULL OR price_per_person_egp >= 0),
  payment_mode                    TEXT
    CHECK (payment_mode IS NULL OR payment_mode IN ('PAY_IN_FULL', 'PERCENT_DEPOSIT', 'FIXED_DEPOSIT')),
  deposit_value                   NUMERIC,
  balance_due_days_before_start   INTEGER,
  min_group_size                  INTEGER,
  max_group_size                  INTEGER,
  level_en                        TEXT,
  level_ar                        TEXT,
  who_for_en                      TEXT,
  who_for_ar                      TEXT,
  stay_en                         TEXT,
  stay_ar                         TEXT,
  good_to_know_en                 TEXT,
  good_to_know_ar                 TEXT,
  includes                        JSONB NOT NULL DEFAULT '[]'::jsonb,
  excludes                        JSONB NOT NULL DEFAULT '[]'::jsonb,
  program                         JSONB NOT NULL DEFAULT '[]'::jsonb,
  partner_id                      UUID REFERENCES public.experience_partners(id) ON DELETE SET NULL,
  partner_name                    TEXT,
  partner_logo_url                 TEXT,
  partner_role_en                 TEXT,
  partner_role_ar                 TEXT,
  partner_url                     TEXT,
  cost_variable_per_guest_egp      NUMERIC,
  cost_fixed_egp                   NUMERIC,
  contingency_pct                  NUMERIC,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT editions_end_after_start CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

COMMENT ON COLUMN public.editions.partner_id IS 'INTERNAL ONLY — never returned from a public API/page.';
COMMENT ON COLUMN public.editions.min_group_size IS 'INTERNAL ONLY — internal worksheet input, never returned publicly.';
COMMENT ON COLUMN public.editions.cost_variable_per_guest_egp IS 'INTERNAL ONLY — internal pricing worksheet, never returned publicly.';
COMMENT ON COLUMN public.editions.cost_fixed_egp IS 'INTERNAL ONLY — internal pricing worksheet, never returned publicly.';
COMMENT ON COLUMN public.editions.contingency_pct IS 'INTERNAL ONLY — internal pricing worksheet, never returned publicly.';

CREATE INDEX IF NOT EXISTS editions_published_status_idx ON public.editions (published, status);
CREATE INDEX IF NOT EXISTS editions_sort_order_idx ON public.editions (sort_order);

DROP TRIGGER IF EXISTS update_editions_updated_at ON public.editions;
CREATE TRIGGER update_editions_updated_at
  BEFORE UPDATE ON public.editions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editions_service_role_all" ON public.editions;
CREATE POLICY "editions_service_role_all" ON public.editions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "editions_public_read" ON public.editions;
CREATE POLICY "editions_public_read" ON public.editions
  FOR SELECT TO anon, authenticated
  USING (published = true AND status <> 'HIDDEN');

-- ─── edition_requests ───
-- One record per "Join / Ask / Notify" submission from an Edition landing,
-- detail, or the Custom Edition flow. Writes go through the server
-- (service-role client) only — matching the anon-INSERT removal 041 applied
-- to bookings/customers/Signature requests/partner inquiries/newsletter —
-- never a direct anon INSERT policy.

CREATE TABLE IF NOT EXISTS public.edition_requests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id               UUID NOT NULL REFERENCES public.editions(id) ON DELETE RESTRICT,
  edition_slug             TEXT NOT NULL,
  edition_title_snapshot    TEXT NOT NULL,
  intent                   TEXT NOT NULL CHECK (intent IN ('JOIN', 'ASK', 'NOTIFY')),
  requested_start_date      DATE,
  customer_name            TEXT NOT NULL,
  phone                    TEXT NOT NULL,
  email                    TEXT,
  travelers                INTEGER,
  message                  TEXT,
  locale                   TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  source                   TEXT NOT NULL DEFAULT 'edition',
  status                   TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'confirmed', 'closed')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS edition_requests_edition_id_idx ON public.edition_requests (edition_id);
CREATE INDEX IF NOT EXISTS edition_requests_status_idx ON public.edition_requests (status);

ALTER TABLE public.edition_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "edition_requests_service_role_all" ON public.edition_requests;
CREATE POLICY "edition_requests_service_role_all" ON public.edition_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Seed: the six announced concepts ───
-- Deterministic, idempotent (ON CONFLICT DO NOTHING keyed on slug). Every
-- commercial/partner/date/level/inclusion field is left NULL/empty per the
-- product brief — nothing here is invented. Copy is the exact bilingual text
-- approved for this pass (see editions-copy.md); do not paraphrase it.

INSERT INTO public.editions (
  slug, title_en, title_ar, short_description_en, short_description_ar,
  full_description_en, full_description_ar, category, status, published, sort_order
) VALUES
  (
    'deep-blue', 'Deep Blue', 'ديب بلو',
    'A small-group dive camp built around learning properly, getting comfortable in the Red Sea, and spending focused time in Dahab with people here for the same reason.',
    'معسكر غوص لمجموعة صغيرة، معمول حوالين إنك تتعلم صح، تاخد ثقة في البحر الأحمر، وتقضي وقت مركز في دهب وسط ناس جايين لنفس السبب.',
    'Deep Blue is for people who want more than a one-off dive. The Edition is shaped around learning, practice, time in the water and the rhythm of Dahab between sessions. When dates open, the final program, level, inclusions and training partner will be published clearly before booking.',
    'ديب بلو للي عايز أكتر من تجربة غطس لمرة واحدة. الإصدار معمول حوالين التعلّم، والتدريب، والوقت في البحر، وروح دهب بين السيشنز. لما المواعيد تفتح، هننشر البرنامج النهائي والمستوى والمشمول والجهة التدريبية بوضوح قبل الحجز.',
    'LEARN', 'COMING_SOON', true, 1
  ),
  (
    'windbound', 'Windbound', 'ويند باوند',
    'A Dahab kitesurf Edition for people who want to spend real time learning, practicing and living around the wind — not squeezing one lesson into a normal holiday.',
    'إصدار كايت سيرف في دهب للي عايز يدي نفسه وقت حقيقي للتعلّم والتدريب والعيش حوالين الهوا، مش يحشر درس واحد وسط رحلة عادية.',
    'Windbound is built around the reason many people come to Dahab in the first place: wind, water and progression. The final Edition will combine structured kitesurf time with a WEEMAP journey around it. Dates, level, training partner and exact inclusions will be published before booking opens.',
    'ويند باوند معمول حوالين واحد من أهم أسباب السفر لدهب: الهوا، والمياه، والتطور في الكايت سيرف. الإصدار النهائي هيجمع وقت تدريب منظم مع رحلة WEEMAP حواليه. المواعيد والمستوى والجهة التدريبية والمشمول هيتعلنوا بوضوح قبل فتح الحجز.',
    'LEARN', 'COMING_SOON', true, 2
  ),
  (
    'one-breath', 'One Breath', 'نَفَس واحد',
    'A freediving-focused Edition built around breath, technique, water confidence and a slower way of experiencing Dahab.',
    'إصدار فري دايفينج معمول حوالين النفس، والتكنيك، والثقة في المياه، وطريقة أهدى تعيش بيها دهب.',
    'One Breath is designed for people drawn to freediving as a skill and an experience, not simply another activity to tick off. The final program will be shaped around the appropriate training level, water sessions and recovery time, with all qualifications and inclusions confirmed before booking.',
    'نَفَس واحد للي شايف الفري دايفينج مهارة وتجربة كاملة، مش مجرد نشاط يعمل عليه علامة صح. البرنامج النهائي هيتبني على المستوى المناسب، وسيشنز المياه، ووقت الاستشفاء، وكل تفاصيل التدريب والمشمول هتتأكد قبل فتح الحجز.',
    'LEARN', 'COMING_SOON', true, 3
  ),
  (
    'reset-sinai', 'Reset Sinai', 'ريست سيناء',
    'A few intentional days in Sinai built around slowing down, moving, breathing and getting some distance from normal routine.',
    'كام يوم في سيناء معمولين عشان تهدى، تتحرك، تتنفس، وتبعد شوية عن دوشة الروتين.',
    'Reset Sinai is WEEMAP''s retreat direction: a small-group Edition where the program may bring together movement, breathwork, nature, quiet time and selected Sinai experiences. Each release can have its own coach or facilitator, and the exact program will always be published before booking.',
    'ريست سيناء هو اتجاه الـretreats عند WEEMAP: إصدار لمجموعة صغيرة ممكن يجمع بين الحركة، وتمارين النفس، والطبيعة، ووقت هادي، وتجارب مختارة في سيناء. كل إصدار ممكن يكون له كوتش أو facilitator مختلف، والبرنامج النهائي هيتنشر بالكامل قبل الحجز.',
    'RETREAT', 'COMING_SOON', true, 4
  ),
  (
    'sinai-traverse', 'Sinai Traverse', 'عبور سيناء',
    'A physical WEEMAP Edition for people who would rather spend the trip moving through mountains, trails and wild Sinai than watching it from a car window.',
    'إصدار WEEMAP للمغامرين اللي عايزين يقضوا الرحلة وسط الجبال والمسارات وسيناء البرّية، مش يتفرجوا عليها من شباك العربية.',
    'Sinai Traverse is built for movement. Each release can follow a different route, but the idea stays the same: hiking, changing terrain, long days outside and a small group traveling for the adventure itself. Route, difficulty, guides, equipment requirements and exact logistics must be confirmed for every Edition before booking opens.',
    'عبور سيناء معمول للحركة. كل إصدار ممكن يمشي في مسار مختلف، لكن الفكرة ثابتة: هايكينج، تضاريس بتتغير، وقت طويل برا، ومجموعة صغيرة مسافرة عشان المغامرة نفسها. المسار والصعوبة والجايـد والمعدات واللوجستكس لازم يتأكدوا لكل إصدار قبل فتح الحجز.',
    'ADVENTURE', 'COMING_SOON', true, 5
  ),
  (
    'after-hours', 'After Hours', 'بعد الساعات',
    'A WEEMAP Edition built around a selected Sinai music night — with the trip around the event treated as part of the experience, not an afterthought.',
    'إصدار WEEMAP معمول حوالين ليلة موسيقى مختارة في سيناء، والرحلة اللي حواليها جزء من التجربة نفسها، مش مجرد حجز حفلة وخلاص.',
    'After Hours starts with the event date and builds outward. Depending on the release, WEEMAP may shape arrival, daytime experiences, the event night and what comes after into one coherent journey. Event brand, partner, dates and exact inclusions must only appear once they are confirmed.',
    'بعد الساعات بيبدأ من ميعاد الإيفنت وبنبني الرحلة حواليه. حسب كل إصدار، WEEMAP ممكن ترتب الوصول، وتجارب اليوم، وليلة الإيفنت، واللي بعدها كرحلة واحدة متماسكة. اسم الإيفنت أو البارتنر أو المواعيد أو المشمول ما يظهرش غير لما يكون متأكد فعلاً.',
    'MUSIC_EVENT', 'COMING_SOON', true, 6
  )
ON CONFLICT (slug) DO NOTHING;
