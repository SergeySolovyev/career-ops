-- 2026-06-03: Agent invocation audit log.
-- Каждый вызов агента (Match, CV Coach, Discovery, Outreach Drafter,
-- CV-Tailor, Ops Watch) пишет сюда строку. Используется для:
--   1. cost accounting (input/output tokens × pricing)
--   2. quality monitoring (manual review случайной выборки)
--   3. SOP drift detection (если success_rate упал — расследуем)
--   4. evals замеры в Sprint C (latency p50/p95/p99)
--
-- Безопасно применять на prod — additive change.

create table if not exists public.agent_invocations (
  id              uuid primary key default gen_random_uuid(),
  agent_id        text not null,                            -- match agent registry.id
  user_id         uuid references auth.users(id) on delete set null,
  trigger         text not null check (trigger in ('api','cron','manual','webhook','subagent')),
  ok              boolean not null,
  error_message   text,
  -- Cost accounting
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  cost_usd        numeric(10,6),                            -- посчитать на стороне sql после вставки, или async batch
  -- Performance
  latency_ms      integer not null default 0,
  model           text,
  -- Metadata (без самого input/output — иначе таблица станет огромной).
  -- Сохраняем хеш input'а чтобы делать batch-evals по уникальным запросам.
  input_hash      text,
  -- Для quality review: процент случайной выборки = 5%
  sampled_for_qa  boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Индексы под основные query patterns
create index if not exists agent_invocations_agent_idx
  on public.agent_invocations (agent_id, created_at desc);

create index if not exists agent_invocations_user_idx
  on public.agent_invocations (user_id, created_at desc)
  where user_id is not null;

create index if not exists agent_invocations_qa_idx
  on public.agent_invocations (sampled_for_qa, agent_id, created_at desc)
  where sampled_for_qa = true;

-- RLS — пишем service-role, читаем admin-only. Пользователи не видят логи.
alter table public.agent_invocations enable row level security;

-- Aggregation views — для будущего /admin/agents дашборда
create or replace view public.agent_health_24h as
select
  agent_id,
  count(*)::int                                        as invocations,
  sum(case when ok then 1 else 0 end)::int             as ok_count,
  sum(case when not ok then 1 else 0 end)::int         as error_count,
  round(avg(latency_ms)::numeric, 0)                   as avg_latency_ms,
  percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms,
  sum(input_tokens)::bigint                            as total_input_tokens,
  sum(output_tokens)::bigint                           as total_output_tokens,
  round(sum(cost_usd)::numeric, 4)                     as total_cost_usd
from public.agent_invocations
where created_at > now() - interval '24 hours'
group by agent_id
order by invocations desc;

create or replace view public.agent_cost_7d as
select
  date_trunc('day', created_at) as day,
  agent_id,
  count(*)::int as invocations,
  round(sum(cost_usd)::numeric, 4) as cost_usd
from public.agent_invocations
where created_at > now() - interval '7 days'
group by 1, 2
order by 1 desc, 4 desc;

comment on table public.agent_invocations is
  'Audit log per agent invocation. Owner: platform. PII: input_hash only (не сам input). Retention: 90 дней, дальше aggregate.';

comment on view public.agent_health_24h is
  'Operational health за 24ч: invocations/errors/latency/cost per agent. Используется Ops Watch Agent для алертов.';
