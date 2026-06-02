-- 2026-06-02: Pre-launch waitlist table.
-- Captures email + UTM + интент пользователя пока CloudPayments не одобрил.
-- В день одобрения — bulk email "merchant активирован, оформите Pro за ₽99".
--
-- Безопасно применять на prod в любой момент — это новая таблица.

create table if not exists public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  source          text,                    -- 'landing_hero' / 'landing_pricing' / 'checkout_blocked' / 'blog'
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  intent          text check (intent in ('pro', 'premium', 'free')),
  promo           text,                    -- 'BETA99' для тех кто кликнул pricing-CTA
  referrer        text,
  user_agent      text,
  ip_hash         text,                    -- sha256(ip + daily-salt) — для антиспама без хранения IP
  notified_at     timestamptz,             -- когда отправлено письмо об активации платежей
  converted_at    timestamptz,             -- когда конвертировался в платящего юзера
  created_at      timestamptz not null default now()
);

-- Уникальность по email — повторные подписки не плодят дубли
create unique index if not exists waitlist_email_uniq on public.waitlist (lower(email));

-- Индексы под основные запросы (выборка не уведомлённых, аналитика по source/utm)
create index if not exists waitlist_notified_idx on public.waitlist (notified_at) where notified_at is null;
create index if not exists waitlist_created_idx on public.waitlist (created_at desc);
create index if not exists waitlist_source_idx on public.waitlist (source) where source is not null;

-- RLS — waitlist пишется только через Server Action (server-side service-role).
-- Anon-key INSERT запрещён — иначе бот наполнит таблицу с публичной страницы.
-- SELECT для anon — тоже нет (это бизнес-данные).
alter table public.waitlist enable row level security;

-- Опциональная политика "владелец сам видит свою запись по email"
-- НЕ создаём — это не нужно для MVP и упростит миграцию позже.

-- Аналитический view для дашборда (counts по source/intent/день)
create or replace view public.waitlist_daily as
select
  date_trunc('day', created_at) as day,
  source,
  intent,
  count(*)::int as signups
from public.waitlist
group by 1, 2, 3
order by 1 desc;

comment on table public.waitlist is
  'Pre-launch email waitlist. Owner: marketing. PII: email. Retention: до 2 лет после converted_at.';
