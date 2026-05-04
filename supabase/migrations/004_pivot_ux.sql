-- =============================================================================
-- Sprint 2: Pivot UX — масс-маркет ICP fields on user_profiles
-- Adds segmentation + skills + city + remote preferences for junior/middle audience.
-- Idempotent (uses IF NOT EXISTS) — safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ICP segment — drives pre-screen pattern weights + AI prompt tuning
-- ---------------------------------------------------------------------------
alter table public.user_profiles add column if not exists icp_segment text default 'middle';

-- CHECK constraint via DO block (idempotent ADD CONSTRAINT)
do $$ begin
  alter table public.user_profiles
    add constraint user_profiles_icp_segment_chk
    check (icp_segment in ('junior', 'middle', 'senior'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Skills array — alternative to CV upload for junior users
-- ---------------------------------------------------------------------------
alter table public.user_profiles add column if not exists skills text[] default array[]::text[];

-- ---------------------------------------------------------------------------
-- 3. Location — affects scoring (remote vs in-person)
-- ---------------------------------------------------------------------------
alter table public.user_profiles add column if not exists city text;
alter table public.user_profiles add column if not exists remote_ok boolean default true;

-- ---------------------------------------------------------------------------
-- 4. Years of experience — used by buildPseudoCV() in skills-catalog.ts
-- ---------------------------------------------------------------------------
alter table public.user_profiles add column if not exists experience_years int default 0;

-- ---------------------------------------------------------------------------
-- 5. Indexes for query patterns (analytics, segmentation reports)
-- ---------------------------------------------------------------------------
create index if not exists user_profiles_icp_idx on public.user_profiles(icp_segment);
create index if not exists user_profiles_city_idx on public.user_profiles(city) where city is not null;

-- ---------------------------------------------------------------------------
-- 6. Backfill existing users
--    All existing users default to 'middle' (broadest pattern).
--    Sergey's demo account stays 'senior' to preserve Director demo behavior.
-- ---------------------------------------------------------------------------
update public.user_profiles
set icp_segment = 'senior'
where (candidate->>'first_name') ilike 'сергей' or (candidate->>'first_name') ilike 'sergey'
  and icp_segment = 'middle'; -- only update if still default
