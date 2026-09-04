-- 027_experience_availability_view.sql
--
-- RECOVERED FROM PRODUCTION. The `experience_date_availability` view exists
-- in the live database but NO file in this folder created it — the version
-- of the Signature Experiences migration that defined it
-- (`016_signature_experiences`, applied 2026-08-24) was superseded here by
-- 018_signature_experiences.sql, which creates all the tables but not the
-- view. A fresh database built from this folder was therefore missing it,
-- and every availability read would have failed.
--
-- Recovered from the live definition (pg_get_viewdef) rather than the old
-- migration text, so this matches what production actually runs.
--
-- security_invoker is not optional. Postgres defaults views to SECURITY
-- DEFINER, which would let anon read aggregated spot counts straight past
-- RLS. Supabase's linter flags that as an ERROR; it was fixed in production
-- on 2026-08-24 as `016a_experience_availability_view_security_invoker`
-- (version 20260824174027), also never committed. Both are folded together
-- here so the view can never exist without the setting.

CREATE OR REPLACE VIEW public.experience_date_availability
WITH (security_invoker = true) AS
  SELECT d.id AS experience_date_id,
    d.experience_id,
    d.start_date,
    d.end_date,
    d.total_spots,
    d.status,
    d.is_open,
    d.price_override,
    COALESCE(b.spots_taken, 0::bigint)::integer AS spots_taken,
    GREATEST(d.total_spots - COALESCE(b.spots_taken, 0::bigint), 0::bigint)::integer AS spots_remaining
   FROM experience_dates d
     LEFT JOIN ( SELECT experience_bookings.experience_date_id,
            sum(experience_bookings.spots_requested) AS spots_taken
           FROM experience_bookings
          WHERE experience_bookings.status <> 'cancelled'::text
          GROUP BY experience_bookings.experience_date_id) b ON b.experience_date_id = d.id;

-- Belt and braces: CREATE OR REPLACE keeps the existing options on an
-- existing view, so set it explicitly for databases where the view already
-- exists without it.
ALTER VIEW public.experience_date_availability SET (security_invoker = true);
