-- 2026-06-03: Research-уровень столбцы на waitlist для проверки гипотезы
-- outcome-based vs subscription pricing (Sequoia / Emergence / NFX framing).
--
-- Идея: до запуска CP мы УЖЕ можем померить — что предпочитают подписчики.
-- 50 ответов «success_fee» при 30 «subscription» → сильный сигнал к pivot
-- на Sprint A. Затраты на сбор сигнала = одно поле в форме.
--
-- Безопасно применять на prod в любой момент — additive change.

alter table public.waitlist
  add column if not exists pricing_preference text
    check (pricing_preference in ('subscription', 'success_fee', 'unsure')),
  add column if not exists wants_founder_call boolean default false;

-- Индекс под analytics: сколько подписчиков просят founder-call по дням
create index if not exists waitlist_founder_call_idx
  on public.waitlist (wants_founder_call, created_at desc)
  where wants_founder_call = true;

-- Аналитический view: разбивка preference по source/intent
create or replace view public.waitlist_pricing_signal as
select
  pricing_preference,
  intent,
  source,
  count(*)::int as n,
  count(*) filter (where wants_founder_call) as wants_calls
from public.waitlist
where pricing_preference is not null
group by 1, 2, 3
order by 1, 4 desc;

comment on column public.waitlist.pricing_preference is
  'Сигнал предпочтения модели монетизации: subscription (₽490/мес), success_fee (плата только за оффер), unsure. NULL = не отвечал.';

comment on column public.waitlist.wants_founder_call is
  'Подписчик нажал «хочу 15-мин звонок с фаундерами». Founder-led sales по YC/Blomfield.';
