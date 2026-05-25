-- Subscriptions table tracks paid plan state per user.
-- Created/updated via Tinkoff Касса webhook events.
create table if not exists public.subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('free', 'pro', 'premium')) default 'free',
  status text not null check (status in ('active', 'past_due', 'canceled', 'pending')) default 'pending',
  -- Tinkoff Касса state
  tinkoff_order_id text,
  tinkoff_rebill_id text,         -- saved on first successful payment, used for recurring charges
  tinkoff_payment_id text,
  -- Billing cycle
  current_period_start timestamptz,
  current_period_end timestamptz,
  -- Lifecycle
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)  -- one active subscription per user
);

alter table public.subscriptions enable row level security;

drop policy if exists "own sub read" on public.subscriptions;
create policy "own sub read" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Inserts/updates only through service-role (webhook handler)
-- Users cannot directly modify their subscription tier
-- (admin client bypasses RLS by design)

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

-- Helper RPC: get current tier for a user (used by frontend)
create or replace function public.get_user_tier(p_user_id uuid)
returns text
language sql
stable
security definer
as $$
  select coalesce(
    (select tier from public.subscriptions
      where user_id = p_user_id and status = 'active'
      order by current_period_end desc nulls last
      limit 1),
    'free'
  );
$$;
grant execute on function public.get_user_tier(uuid) to authenticated;
