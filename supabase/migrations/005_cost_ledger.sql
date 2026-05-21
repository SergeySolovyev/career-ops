-- Day 5 cost ledger: atomic per-user cost tracking via SELECT ... FOR UPDATE
-- Replaces in-memory MONTHLY_COST_CAP_USD counter in tg-scan-core.ts which
-- had a race condition under concurrent scans. With per-row pessimistic
-- locking, two parallel scans can't both consume the same budget twice.

create table if not exists public.cost_ledger (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- monthly bucket — month_year as 'YYYY-MM' string to make resets trivial
  month_year text not null default to_char(now() at time zone 'utc', 'YYYY-MM'),
  -- accumulated cost in USD for current month
  cost_usd numeric(10,5) not null default 0,
  -- last update — also used to detect month rollover
  updated_at timestamptz not null default now()
);

alter table public.cost_ledger enable row level security;

drop policy if exists "own ledger read" on public.cost_ledger;
create policy "own ledger read"
  on public.cost_ledger for select using (auth.uid() = user_id);

-- INSERT/UPDATE intentionally restricted — only service_role (server-side)
-- writes via /api/scan-now. RLS prevents users from tampering with their
-- own bucket.

-- Helper: atomic increment with month rollover. Returns the new total.
-- Use this from server-side code:
--   const { data } = await supabase.rpc('cost_ledger_add', { p_user_id: uid, p_amount: 0.05 })
create or replace function public.cost_ledger_add(
  p_user_id uuid,
  p_amount numeric
) returns numeric
language plpgsql
security definer
as $$
declare
  v_current_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_new_total numeric;
begin
  insert into public.cost_ledger (user_id, month_year, cost_usd, updated_at)
  values (p_user_id, v_current_month, p_amount, now())
  on conflict (user_id) do update set
    cost_usd = case
      when cost_ledger.month_year = v_current_month
        then cost_ledger.cost_usd + excluded.cost_usd
      else excluded.cost_usd  -- month rollover: reset
    end,
    month_year = v_current_month,
    updated_at = now()
  returning cost_usd into v_new_total;
  return v_new_total;
end;
$$;

grant execute on function public.cost_ledger_add(uuid, numeric) to authenticated;

-- Helper: check current month's cost without incrementing
create or replace function public.cost_ledger_current(p_user_id uuid)
returns numeric
language plpgsql
stable
security definer
as $$
declare
  v_current_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_cost numeric;
begin
  select cost_usd into v_cost
  from public.cost_ledger
  where user_id = p_user_id and month_year = v_current_month;
  return coalesce(v_cost, 0);
end;
$$;

grant execute on function public.cost_ledger_current(uuid) to authenticated;
