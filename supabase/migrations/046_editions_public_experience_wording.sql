-- 046_editions_public_experience_wording.sql
--
-- Public naming correction: the product is presented to customers as
-- "WEEMAP Experiences" / "تجارب WEEMAP المميزة". The internal domain stays
-- `editions` (tables, routes, types, APIs are unchanged).
--
-- This rewrites only the customer-visible "Edition" / "إصدار" phrases inside
-- the six concept records seeded by 044. Each statement replaces an exact
-- original phrase, so it is deterministic, a no-op on re-run, and cannot
-- touch copy an admin has since rewritten.

-- deep-blue
UPDATE public.editions SET
  full_description_en = replace(full_description_en, 'The Edition is shaped around', 'The experience is shaped around'),
  full_description_ar = replace(full_description_ar, 'الإصدار معمول حوالين', 'التجربة معمولة حوالين')
WHERE slug = 'deep-blue';

-- windbound
UPDATE public.editions SET
  short_description_en = replace(short_description_en, 'A Dahab kitesurf Edition', 'A Dahab kitesurf experience'),
  full_description_en = replace(full_description_en, 'The final Edition will combine', 'The final experience will combine'),
  short_description_ar = replace(short_description_ar, 'إصدار كايت سيرف في دهب', 'تجربة كايت سيرف في دهب'),
  full_description_ar = replace(full_description_ar, 'الإصدار النهائي هيجمع', 'التجربة النهائية هتجمع')
WHERE slug = 'windbound';

-- one-breath
UPDATE public.editions SET
  short_description_en = replace(short_description_en, 'A freediving-focused Edition', 'A freediving-focused experience'),
  short_description_ar = replace(short_description_ar, 'إصدار فري دايفينج معمول', 'تجربة فري دايفينج معمولة')
WHERE slug = 'one-breath';

-- reset-sinai
UPDATE public.editions SET
  full_description_en = replace(full_description_en, 'a small-group Edition where', 'a small-group experience where'),
  full_description_ar = replace(
    replace(full_description_ar, 'إصدار لمجموعة صغيرة ممكن يجمع', 'تجربة لمجموعة صغيرة ممكن تجمع'),
    'كل إصدار ممكن يكون له', 'كل تجربة ممكن يكون ليها')
WHERE slug = 'reset-sinai';

-- sinai-traverse
UPDATE public.editions SET
  short_description_en = replace(short_description_en, 'A physical WEEMAP Edition', 'A physical WEEMAP experience'),
  full_description_en = replace(full_description_en, 'for every Edition before', 'for every departure before'),
  short_description_ar = replace(short_description_ar, 'إصدار WEEMAP للمغامرين', 'تجربة WEEMAP للمغامرين'),
  full_description_ar = replace(
    replace(full_description_ar, 'كل إصدار ممكن يمشي', 'كل رحلة ممكن تمشي'),
    'لكل إصدار قبل', 'لكل رحلة قبل')
WHERE slug = 'sinai-traverse';

-- after-hours
UPDATE public.editions SET
  short_description_en = replace(short_description_en, 'A WEEMAP Edition built', 'A WEEMAP experience built'),
  short_description_ar = replace(short_description_ar, 'إصدار WEEMAP معمول', 'تجربة WEEMAP معمولة'),
  full_description_ar = replace(full_description_ar, 'حسب كل إصدار', 'حسب كل رحلة')
WHERE slug = 'after-hours';
