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
-- 6. Backfill Sergey's demo account → 'senior' (preserves Director demo).
--    Schema-agnostic: works whether user_profiles uses `candidate jsonb`
--    (some envs) or `full_name text` (current prod). Skips silently if neither.
--    Original SQL had operator-precedence bug: `A OR B AND C` parses as
--    `A OR (B AND C)`, so `icp_segment='middle'` guard didn't apply to A.
--    Fixed with explicit parentheses.
-- ---------------------------------------------------------------------------
do $$
declare
  has_candidate boolean;
  has_full_name boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_profiles' and column_name='candidate'
  ) into has_candidate;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_profiles' and column_name='full_name'
  ) into has_full_name;

  if has_candidate then
    update public.user_profiles
    set icp_segment = 'senior'
    where ((candidate->>'first_name') ilike 'сергей' or (candidate->>'first_name') ilike 'sergey')
      and icp_segment = 'middle';
  elsif has_full_name then
    update public.user_profiles
    set icp_segment = 'senior'
    where (full_name ilike '%сергей%' or full_name ilike '%sergey%')
      and icp_segment = 'middle';
  end if;
end $$;
