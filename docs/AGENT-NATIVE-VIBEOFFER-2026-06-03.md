# Agent-native VibeOffer — стратегический фрейм

**Дата:** 2026-06-03
**Цель документа:** перевести VibeOffer из «AI SaaS» в **agent-native operation** —
систему, где LLM это мозг, agent runtime это руки, founder это CEO,
а конечная единица продаваемой ценности — **unit of work**, не seat.

---

## Источники фрейма (для ссылок и аудита решений)

| Источник | Ключевая мысль | Ссылка |
|---|---|---|
| OpenClaw | «AI that actually does things» — multi-channel персональный агент с control plane | https://openclaw.ai/ · https://github.com/openclaw/openclaw |
| OpenAI Agents SDK | Агент = приложение которое планирует, вызывает tools, поддерживает state | https://developers.openai.com/api/docs/guides/agents |
| OpenAI Computer-use | Best practices: sandbox/VM, human-in-the-loop для destructive actions | https://developers.openai.com/api/docs/guides/tools-computer-use |
| OpenAI ChatGPT Agent | Prompt injection как класс рисков; permission-controls обязательны | https://openai.com/index/introducing-chatgpt-agent/ |
| Bessemer — AI Pricing Playbook | AI = productive teammate, decouple output from headcount | https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook |
| Bessemer — Vertical AI Playbook | Vertical AI охотится за **labor budget**, не software budget | https://www.bvp.com/atlas/building-vertical-ai-an-early-stage-playbook-for-founders |
| YC — The AI Agent Economy Is Here | Make something **agents** want, не только people want | https://www.ycombinator.com/library/NK-the-ai-agent-economy-is-here |
| Menlo — AI Agents Architecture | 4 блока агента: reasoning · memory · execution · planning | https://menlovc.com/perspective/ai-agents-a-new-architecture-for-enterprise-automation/ |
| Sequoia — Bret Taylor | Outcome-based pricing, applied AI, vertical specialization | https://sequoiacap.com/podcast/training-data-bret-taylor/ |

---

## TL;DR — где мы сейчас и куда идём

| Уровень автономии | Описание | Где VibeOffer |
|---|---|---|
| L1 — assistant | помогает человеку, не действует автономно | `/api/chat` (CV Coach) |
| L2 — workflow executor | 60-80% повторяемой работы | `/api/scan-now`, `/api/tg/scan-all`, `notify-waitlist.ts` |
| L3 — role compression | один человек + агенты = работа отдела | **Sprint A-B цель** для Match + CV-Tailor |
| L4 — digital employee | inbox/backlog/KPI/escalations | Sprint D+ для Ops Watch Agent |
| L5 — agent-native company | компания построена вокруг агентов | долгосрочно, после первых 500 paid |

**Сейчас (2026-06-03):** мы L2 в продукте, L0 в operations. Этот коммит добавляет
**Agent OS scaffolding** (registry + runtime) + **первый sales-agent** (Outreach Drafter)
чтобы поднять operations с L0 до L2 без новых наймов.

---

## Часть 1 — Agent OS: что добавлено в этом коммите

### 1.1. Registry (`apps/web/lib/agents/registry.ts`)

Single source of truth по всем агентам VibeOffer. Каждый агент описан
6 структурными полями (по Menlo + OpenAI Agents SDK):

| Поле | Назначение | Аналог в Menlo framework |
|---|---|---|
| `sop` | system prompt — что делает, чего НЕ | planning |
| `tools` | whitelist разрешённых tool-вызовов | execution |
| `outputSchema` | контракт structured output | reasoning bound |
| `humanApprovalGate` | действия которые **НЕ** делает сам | guardrails |
| `qualityBar` | критерии «хорошего» вывода | evals |
| `evalStrategy` | где описан eval-dataset | observability |

**Что добавлено в registry:**
- `match-agent` (L2) — рефлексия существующего `ai-evaluate.ts` как агента
- `cv-coach-agent` (L1) — рефлексия существующего `/api/chat`
- `discovery-agent` (L2) — рефлексия `/api/scan-now`
- `outreach-drafter-agent` (L2) — **новый, реализован**
- `cv-tailor-agent` (L3) — **зарегистрирован, реализация Sprint A**
- `ops-watch-agent` (L4) — **зарегистрирован, реализация Sprint B**

### 1.2. Runtime (`apps/web/lib/agents/runtime.ts`)

Единая точка вызова: `invokeAgent(id, input, context, options)`. Делает:

1. Загружает AgentDefinition
2. Применяет SOP как `system` prompt в Anthropic Messages API
3. Если `unsafeInput=true` (по OpenAI prompt-injection guidance) — оборачивает
   input в `<untrusted_data>` delimiter с явным предупреждением модели
4. Захватывает `inputTokens/outputTokens/latencyMs/model` для cost accounting
5. Парсит JSON если `expectJson: true` (со снятием markdown fences)

**Что НЕ делает (намеренно, по принципу YC «build for the now»):**
- Не пишет audit log в БД → TODO Sprint A: `agent_invocations` таблица
- Не делает retry на 5xx → TODO Sprint B: exponential backoff
- Не использует Anthropic prompt caching → TODO Sprint A: `cache_control`
  на system prompts (90% экономии токенов на повторяющихся SOP)
- Не sandbox'ит tools → подходит для текущих read-only/draft-only агентов;
  для destructive (`email_send`, `tg_send_dm`) нужен per-tool sandbox →
  Sprint C, после первого OpenClaw-style channel agent'а

### 1.3. Outreach Drafter Agent (`apps/web/lib/agents/outreach-drafter.ts`)

**Зачем именно этот первым:** возвращает к YC-принципу «do things that don't scale»
(personal outreach к первым 50). Узкое место — Яна не может написать 30 personal
сообщений за 30 минут. Агент сжимает до 30 минут review.

**Workflow:**

```
Сергей создаёт docs/outreach-list.json (30 имён + контекст)
        ↓
tsx scripts/draft-outreach.ts
        ↓
docs/OUTREACH-DRAFTS.md (30 готовых черновиков)
        ↓
Яна 30 минут редактирует, Telegram-отправляет каждый
        ↓
Через 7 дней — лучшие/худшие черновики → eval dataset
```

**Это L2 workflow executor** по Bessemer framework: агент делает 80% (draft),
человек делает 20% (review + send). Outcome = персональный outreach pipeline,
unit of work = drafted message.

---

## Часть 2 — Применение фрейма к коду VibeOffer

### 2.1. Что мы переименовываем (registry-rebrand)

Эти куски кода **уже агенты в смысле Menlo**, просто мы их так не называли:

| Раньше называлось | Теперь registered как | Что меняется в коде |
|---|---|---|
| `aiEvaluate()` function | Match Agent | Ничего — функция остаётся, но registry — SSOT для SOP/quality |
| `/api/chat` route | CV Coach Agent | Ничего — endpoint остаётся, но SOP документирован |
| `/api/scan-now` route | Discovery Agent | Ничего |
| `notify-waitlist.ts` | Outreach Notifier Agent | Ничего |

**Почему это важно:** мы НЕ переписываем работающий код. Мы добавляем
**мета-слой описания**, который позволяет:
- Аудитировать SOP агента отдельно от его кода
- Менять `qualityBar` без релиза
- Видеть в /admin (Sprint B) все агенты одним списком
- Подключать evals (Sprint C) без рефакторинга агентов

### 2.2. Что мы НЕ строим (анти-паттерны)

По OpenAI computer-use guidelines + Menlo + YC playbook — следующие
направления **намеренно отложены**, чтобы не плодить tech debt:

| Не строим | Почему | Когда вернёмся |
|---|---|---|
| OpenClaw-style multi-channel inbox для founder'а | Premature optimization до 50 paid users | Sprint D |
| computer-use агент для подачи откликов на hh.ru | ToS нарушение + legal risk | Никогда (или только с hh.ru partnership) |
| Vector store memory layer для агентов | Overkill для current scale | Sprint C+ если первые evals покажут drift |
| MCP-style agent marketplace | YC говорит «make something agents want» — но нашему ICP это не нужно | Sprint E (если pivot на B2B/services) |
| Полная sandbox-изоляция per-tool | Текущие агенты read-only/draft-only | Когда добавим первый destructive tool |

### 2.3. Application к pricing (Bessemer + Sequoia)

Это самое мощное применение фрейма. Bessemer AI Pricing Playbook прямо
говорит: **decouple output from headcount → price per unit of work**.

Для VibeOffer перевод:

| Текущая модель (SaaS) | Agent-native модель |
|---|---|
| ₽490/мес доступ к интерфейсу | ₽490/мес ИЛИ ₽199 за tailored CV ИЛИ ₽9990 за оффер |
| 1 user = 1 seat | 1 user = unit of work counter (CV-tailorings, offers, interviews) |
| Cost basis: per-month | Cost basis: per-agent-invocation |
| Margin model: unknown per scan | Margin model: ₽5 cost / ₽199 price на CV-tailor = 97.5% |

**Sprint A решение** (после waitlist research signal) — добавить второй tier
`per-unit` со ставкой `₽199 за tailored CV`. Это даёт пользователю выбор
**SaaS vs outcome**, мы измеряем какая модель конвертит лучше.

---

## Часть 3 — Roadmap L2 → L3

### Sprint A (1-2 недели после CP-одобрения)

1. **CV-Tailor Agent live** — реализация в `lib/agents/cv-tailor.ts`,
   wire to `/onboarding` Step 3 как «Готовый CV под топ-матч»
2. **agent_invocations таблица** — Supabase migration, runtime пишет туда
3. **Anthropic prompt caching** — добавить `cache_control` для SOP'ов
4. **Pricing experiment** — добавить `per_unit` tier рядом с subscription

### Sprint B (3-4 недели)

5. **Ops Watch Agent live** — cron каждый час, шлёт TG founder'у
6. **Salary-Anchor Agent** — новый, daily-scrape market salary by ICP
7. **`/admin/agents` dashboard** — список всех агентов с метриками
   (invocations/day, success rate, avg latency, cost/invocation)

### Sprint C (5-8 недель)

8. **Eval datasets** — для Match, CV-Tailor, Outreach: golden-set с
   reference outputs, regression tests перед deploy
9. **Recruiter-Reply Agent** — drafts ответ на incoming recruiter DM
   (humanApprovalGate: пользователь нажимает send)
10. **Interview-Prep Agent** — генерит likely questions + STAR-answers
    под конкретную вакансию

### Sprint D+ (post-первые 50 paid)

11. **Inbox/backlog для агентов** (L4 digital employee paradigm)
12. **OpenClaw-style multi-channel** — Telegram бот VibeOffer для пользователей,
    через который агенты взаимодействуют с ними по своим backlog'ам
13. **Pricing pivot** — если waitlist research показал ≥60% success_fee
    preference + CV-Tailor unit-economics работают — переходим на dominant
    outcome-based pricing

---

## Часть 4 — Безопасность (по OpenAI ChatGPT Agent + OpenClaw README)

**Принцип:** агентам — задачи, инструменты и ограниченные права;
человеку — ответственность, контроль и финальные решения в высокорисковых местах.

### 4.1. Текущие защиты (этот коммит)

- **`humanApprovalGate`** в каждом AgentDefinition перечисляет что агент НЕ делает сам
- **`unsafeInput=true`** в runtime context оборачивает input в `<untrusted_data>`
  delimiter (mitigation prompt injection)
- **Read-only/draft-only**: ни один зарегистрированный агент не имеет
  `tg_send_dm` / `email_send` без human approval gate

### 4.2. Что добавим перед destructive tools (Sprint C)

- Per-tool sandbox: tg-send только из worker'а с whitelist'ом каналов
- Audit log с before/after diff для каждого write-tool вызова
- Rate limit per-agent (не только per-user) — на случай runaway loop
- Cost cap per-day per-agent — kill switch если bill > ₽X

---

## Часть 5 — Decisions list (что осталось за вами)

| # | Решение | Когда | Default если не ответили |
|---|---|---|---|
| 1 | После 50 waitlist-ответов — кто читает `waitlist_pricing_signal`? | После CP | Я мониторю, шлю summary |
| 2 | Готовы построить CV-Tailor Agent в Sprint A? | После CP | Да — самое high-leverage улучшение продукта |
| 3 | OpenClaw-style канал в TG для пользователей — нужен или нет? | Sprint D | По умолчанию — нет, поднимаем когда waitlist > 200 |
| 4 | Расширяем ли product scope в B2B services (agent-run reconciliation для банков)? | Sprint E | По умолчанию — нет, остаёмся в junior job-search vertical |

---

## Часть 6 — Самая жёсткая формулировка (для напоминания)

Из меморандума:

> **«Не AI заменит сотрудника, а фаундер, умеющий управлять агентами, заменит маленький отдел.»**

Применительно к VibeOffer:

> **Я не junior job-search SaaS. Я agent-run career operations для junior IT/design/marketing.**
> **Каждая регистрация — это onboarding нового клиента к команде из 6 цифровых сотрудников
> (Match, CV Coach, Discovery, CV-Tailor, Salary-Anchor, Interview-Prep), каждый из которых
> делает работу одного middle-уровня специалиста. Цена ₽490/мес — это 1/200 от стоимости
> найма такой команды живых людей. Возврат если за 14 дней не зашло.**

Это и есть позиционирование которое продают junior'у в 2026 году. Не «AI оценивает
вакансии», а **«у тебя теперь карьерный отдел, и это стоит как кофе».**
