-- =============================================================================
-- Sprint 1: Telegram channels parser
-- Per-user channel subscriptions + cost log + dedup metadata on user_evaluations
-- Idempotent (uses IF NOT EXISTS) — safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-user Telegram channel subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.tg_channels (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_username text not null,         -- without @, lowercase
  is_default boolean default false,       -- system-seeded vs user-added
  status text default 'active',           -- active | paused | invalid | not_found
  last_message_id bigint,                 -- for incremental polling
  last_parsed_at timestamptz,
  validation_error text,                  -- last validation failure reason
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, channel_username)
);

alter table public.tg_channels enable row level security;

-- Drop+recreate policies to ensure latest version (idempotent)
drop policy if exists "own channels read"   on public.tg_channels;
drop policy if exists "own channels insert" on public.tg_channels;
drop policy if exists "own channels update" on public.tg_channels;
drop policy if exists "own channels delete" on public.tg_channels;
create policy "own channels read"   on public.tg_channels for select using (auth.uid() = user_id);
create policy "own channels insert" on public.tg_channels for insert with check (auth.uid() = user_id);
create policy "own channels update" on public.tg_channels for update using (auth.uid() = user_id);
create policy "own channels delete" on public.tg_channels for delete using (auth.uid() = user_id);

create index if not exists tg_channels_status_idx on public.tg_channels(status, last_parsed_at);

-- ---------------------------------------------------------------------------
-- 2. Per-user cost + activity log (one row per scan run)
-- ---------------------------------------------------------------------------
create table if not exists public.tg_scan_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ran_at timestamptz default now(),
  channels_scanned int default 0,
  messages_fetched int default 0,
  messages_classified int default 0,
  vacancies_found int default 0,
  haiku_input_tokens int default 0,
  haiku_output_tokens int default 0,
  sonnet_input_tokens int default 0,
  sonnet_output_tokens int default 0,
  cost_usd numeric(10,5) default 0,
  error text                              -- null on success, message on failure
);

alter table public.tg_scan_log enable row level security;

drop policy if exists "own scan log read" on public.tg_scan_log;
create policy "own scan log read" on public.tg_scan_log for select using (auth.uid() = user_id);
-- No insert/update/delete via RLS — only service_role writes (worker / cron).

create index if not exists tg_scan_log_user_time_idx on public.tg_scan_log(user_id, ran_at desc);

-- ---------------------------------------------------------------------------
-- 3. Extend user_evaluations for TG metadata + cross-source dedup
--
-- Note: 'source' column already exists as text — values become 'hh_ru' | 'tg'.
-- We do NOT add 'id' here even if missing; legacy rows are keyed by (user_id,url).
-- duplicate_of references the unique constraint on (user_id,url) via canonical_key
-- joins (cheaper than adding a surrogate id retroactively).
-- ---------------------------------------------------------------------------
alter table public.user_evaluations add column if not exists tg_channel text;
alter table public.user_evaluations add column if not exists tg_message_id bigint;
alter table public.user_evaluations add column if not exists canonical_key text;

-- duplicate_of: stores the canonical_key of the "primary" row this duplicates.
-- We use canonical_key as the link (not a row id) to stay schema-agnostic to
-- whether user_evaluations has a surrogate id column.
alter table public.user_evaluations add column if not exists duplicate_of_key text;

create index if not exists user_evaluations_canonical_idx
  on public.user_evaluations(user_id, canonical_key);

create index if not exists user_evaluations_tg_channel_idx
  on public.user_evaluations(user_id, tg_channel)
  where tg_channel is not null;

-- ---------------------------------------------------------------------------
-- 3b. Track one-time TG default-channels seeding per user (avoid re-seed
--     on every API GET if user deleted their seeded channels intentionally)
-- ---------------------------------------------------------------------------
alter table public.user_profiles add column if not exists tg_seeded_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Helper: trigger to keep updated_at fresh on tg_channels
-- ---------------------------------------------------------------------------
create or replace function public.tg_channels_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_channels_updated_at on public.tg_channels;
create trigger tg_channels_updated_at
  before update on public.tg_channels
  for each row execute function public.tg_channels_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Default channel seed function (called from app on user signup or backfill)
-- ---------------------------------------------------------------------------
create or replace function public.tg_seed_default_channels(p_user_id uuid)
returns void as $$
declare
  default_channels text[] := array[
    'g_jobbot',
    'forfrontend',
    'hh_devjobs',
    'itmozg',
    'itjobsrussia',
    'qajobs',
    'devops_jobs',
    'datasciencejobs_ru',
    'designhuntersjobs',
    'product_management_jobs'
  ];
  ch text;
begin
  foreach ch in array default_channels loop
    insert into public.tg_channels (user_id, channel_username, is_default, status)
    values (p_user_id, ch, true, 'active')
    on conflict (user_id, channel_username) do nothing;
  end loop;
end;
$$ language plpgsql security definer;
