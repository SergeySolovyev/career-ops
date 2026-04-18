-- HH session storage (encrypted cookies, per-user, AES-256-GCM)
create table if not exists public.hh_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  iv text not null,                       -- base64 IV (12 bytes for GCM)
  ciphertext text not null,               -- base64 ciphertext + auth tag
  hh_email text,                          -- optional: HH login id for UI
  status text not null default 'active',  -- active | expired | invalid
  last_validated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.hh_sessions enable row level security;
create policy "own session read"   on public.hh_sessions for select using (auth.uid() = user_id);
create policy "own session insert" on public.hh_sessions for insert with check (auth.uid() = user_id);
create policy "own session update" on public.hh_sessions for update using (auth.uid() = user_id);
create policy "own session delete" on public.hh_sessions for delete using (auth.uid() = user_id);

-- Application audit log (one row per attempted apply)
create table if not exists public.application_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vacancy_url text not null,
  vacancy_title text,
  vacancy_company text,
  cover_letter text,
  status text not null,                   -- queued|sent|failed|already_applied|viewed|replied|rejected
  hh_response_id text,                    -- HH negotiation id from response page
  error_msg text,
  applied_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.application_log enable row level security;
create policy "own apply read"   on public.application_log for select using (auth.uid() = user_id);
create policy "own apply insert" on public.application_log for insert with check (auth.uid() = user_id);
create policy "own apply update" on public.application_log for update using (auth.uid() = user_id);
create index if not exists application_log_user_time_idx on public.application_log(user_id, applied_at desc);
create unique index if not exists application_log_user_url_idx on public.application_log(user_id, vacancy_url);

-- Disclaimer consent (legal record before first auto-apply)
create table if not exists public.apply_consent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  agreed_at timestamptz not null default now(),
  ip text,
  user_agent text
);
alter table public.apply_consent enable row level security;
create policy "own consent read"   on public.apply_consent for select using (auth.uid() = user_id);
create policy "own consent insert" on public.apply_consent for insert with check (auth.uid() = user_id);
