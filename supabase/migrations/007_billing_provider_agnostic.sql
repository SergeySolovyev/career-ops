-- 2026-05-29: Switch billing model from Tinkoff Касса → CloudPayments.
-- The subscriptions table grew tinkoff_* columns in migration 006; this migration
-- adds provider-agnostic columns alongside (kept the old ones nullable for
-- backwards compat in case of in-flight Tinkoff transactions during cutover).
--
-- Schema change is additive — safe to apply on prod with active users.

alter table public.subscriptions
  add column if not exists provider text default 'cloudpayments' check (provider in ('tinkoff', 'yookassa', 'cloudpayments')),
  add column if not exists provider_order_id text,
  add column if not exists provider_payment_id text,
  -- For CloudPayments: SubscriptionId (used for cancel API).
  -- For ЮKassa would be: payment_method.id (saved card token).
  -- For Tinkoff was: RebillId.
  add column if not exists provider_recurring_token text;

-- Backfill: any historical Tinkoff rows get their data mirrored into the new columns
-- so the webhook handler's UPDATE WHERE provider_order_id = ? finds them.
-- No-op on a fresh prod (current state: zero subscriptions rows since Maria's cleanup).
update public.subscriptions
   set provider = coalesce(provider, 'tinkoff'),
       provider_order_id = coalesce(provider_order_id, tinkoff_order_id),
       provider_payment_id = coalesce(provider_payment_id, tinkoff_payment_id),
       provider_recurring_token = coalesce(provider_recurring_token, tinkoff_rebill_id)
 where tinkoff_order_id is not null
    or tinkoff_payment_id is not null
    or tinkoff_rebill_id is not null;

-- Index on provider_order_id — webhook lookup is in the hot path
create index if not exists subscriptions_provider_order_idx
  on public.subscriptions(provider_order_id)
  where provider_order_id is not null;

create index if not exists subscriptions_provider_recurring_idx
  on public.subscriptions(provider_recurring_token)
  where provider_recurring_token is not null;

-- Note: legacy tinkoff_* columns kept for now. Drop in a future migration
-- after confirming zero rows reference them for >30 days.
