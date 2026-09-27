-- 050_stay_patterns_8d7n_and_custom.sql
-- Adds the 8 days / 7 nights stay pattern for both the shared bus and private
-- Hiace, alongside the existing 4D/3N and 5D/4N packages (see 029_transport_schedule.sql
-- for the schedule/stay-pattern contract this reads).
--
-- WHY
--   WEEMAP Bus 8D/7N and Private Hiace 8D/7N (+ "Customize") are new sellable
--   lengths. The bus is a scheduled service (out Sun/Thu, back Mon/Fri — see
--   029's weekly rules), so only outbound/return combinations that land on an
--   actual operating day can be sold as a fixed-length pattern.
--
-- SCHEDULE MATH (return_offset_days is calendar days from outbound to return,
-- matching bus_4d3n/bus_5d4n where return_offset_days == duration_days):
--   * Thursday (weekday 4) + 8 days = the following Friday (weekday 5) — a
--     valid bus return day.
--   * Sunday   (weekday 0) + 8 days = the following Monday (weekday 1) — also
--     a valid bus return day.
--   So, unlike 4D/3N (only valid from Thursday) and 5D/4N (only valid from
--   Sunday), 8D/7N is valid from BOTH Sunday and Thursday departures under the
--   current weekly rules — it is seeded with departure_weekdays = {0,4}.
--
-- PRODUCTION-CONFIG QUESTION (does not block this migration, flagging for ops):
--   Business asked whether bus 4D/3N could also depart on Sunday (in addition
--   to Thursday). Sunday + 4 days = Thursday, which is not a configured bus
--   return weekday (only Monday/Friday are) — so under today's
--   transport_weekly_rules, a Sunday-departure 4D/3N has no valid return day
--   and is NOT added here. If ops wants that combination, it requires either a
--   new Thursday return weekly rule or a different return_offset_days for a
--   Sunday-only 4D/3N variant — a deliberate product decision, not a bug fix.
--
-- Additive only, idempotent (ON CONFLICT DO NOTHING). Safe to re-run.

INSERT INTO public.stay_patterns
  (code, transfer_type, name_ar, name_en, duration_days, nights, return_offset_days, departure_weekdays, sort_order)
VALUES
  ('bus_8d7n',   'package_bus', '٨ أيام / ٧ ليالي', '8 days / 7 nights', 8, 7, 8, ARRAY[0,4]::SMALLINT[], 2),
  ('hiace_8d7n', 'hiace',       '٨ أيام / ٧ ليالي', '8 days / 7 nights', 8, 7, 8, NULL, 4)
ON CONFLICT (code) DO NOTHING;
