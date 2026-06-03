/**
 * Agent Registry — единый источник правды о всех агентах VibeOffer.
 *
 * Правила добавления нового агента:
 *   1. Прописать AgentDefinition здесь
 *   2. Реализовать invoke() функцию в файле lib/agents/<id>.ts
 *   3. Описать eval-стратегию в docs/AGENT-RUNBOOK.md (даже если "TODO")
 *   4. Указать humanApprovalGate для всего что меняет state у пользователя
 *   5. По Menlo guidelines — никаких destructive actions без human approval
 *
 * Уровни (по фрейму Bessemer/Menlo):
 *   L1 assistant       — отвечает на вопросы, не действует автономно
 *   L2 workflow exec   — делает 60-80% повторяемой работы, человек проверяет
 *   L3 role compression — один человек с агентом = работа отдела
 *   L4 digital employee — собственный inbox, backlog, KPI
 *   L5 agent-native co — компания построена вокруг агентов
 */

import type { AgentDefinition } from './types'

/**
 * Match Agent — оценивает вакансию против CV пользователя.
 * Уже существует как packages/core/src/evaluator/ai-evaluate.ts —
 * этот entry рефлексирует факт что это AGENT, а не просто функция.
 */
const matchAgent: AgentDefinition = {
  id: 'match-agent',
  name: 'Match Agent',
  level: 2,
  domain: 'product',
  consumer: 'user',
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
  tools: ['anthropic_chat'],
  sop: `Ты — Match Agent для junior/middle IT/design/marketing соискателей в РФ/СНГ.
Твоя задача: получить пару (CV + vacancy) и вернуть structured вердикт по 10 критериям.
Ты НЕ:
  - не пишешь cover letter (это работа Cover-Letter Agent)
  - не даёшь карьерных советов «вообще» (это работа CV Coach Agent)
  - не лжёшь чтобы понравиться пользователю — лучше честная низкая оценка чем фейковая высокая
Ты ВСЕГДА:
  - учитываешь ICP-сегмент (junior/middle/senior), реальный опыт и skill gap
  - возвращаешь honest score 0-10, не округляешь вверх
  - указываешь конкретные strengths и weaknesses со ссылкой на тексты CV и вакансии`,
  outputSchema: '{ score: 0-10, verdict: "apply"|"maybe"|"skip", summary: string, strengths: string[], weaknesses: string[] }',
  humanApprovalGate: [],
  qualityBar: [
    'Junior CV против Senior вакансии должен получать score ≤ 5',
    'Match для exact-role (frontend ↔ frontend) с overlap skills ≥ 70% → score ≥ 7',
    'weaknesses содержит конкретные пункты, не "слабый CV"',
  ],
  evalStrategy: 'packages/core/src/evaluator/__tests__/icp-aware.test.ts — синтетический dataset на 3 ICP-сегмента. TODO: расширить на 50 реальных CV-vacancy пар после первых 10 paid users.',
}

/**
 * CV Coach Agent — отвечает на вопросы пользователя про CV + матчи.
 * Существует как /api/chat (Claude с RAG context из user_profiles + evaluations).
 */
const cvCoachAgent: AgentDefinition = {
  id: 'cv-coach-agent',
  name: 'CV Coach Agent',
  level: 1,
  domain: 'product',
  consumer: 'user',
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
  tools: ['anthropic_chat', 'supabase_read'],
  sop: `Ты — CV Coach для junior/middle IT/design/marketing.
Тебя видно: CV пользователя, его target roles, последние 5 evaluations, его icp_segment.
Ты:
  - даёшь конкретные советы со ссылкой на текст CV ("замените раздел X на Y")
  - честно говоришь когда CV слабее target вакансий
  - предлагаешь skill gap fillers (курсы, pet projects, opensource)
Ты НЕ:
  - не пишешь CV за пользователя (другой агент)
  - не врёшь чтобы поддержать
  - не выходишь за рамки career-coaching (про life, политику, etc отказываешься)`,
  outputSchema: 'streaming text, Markdown-formatted, цитирующий текст CV и evaluations',
  humanApprovalGate: [],
  qualityBar: [
    'Каждый совет привязан к конкретному месту CV',
    'Тон — peer, не корпоратив',
    'Не использует жаргон HR ("компетенции", "позиционирование себя")',
  ],
  evalStrategy: 'TODO Sprint B: golden-set из 20 типичных вопросов junior/middle с reference answers',
}

/**
 * Discovery Agent — сканирует HH/TG и приносит свежие вакансии.
 * Существует как /api/scan-now + /api/tg/scan-all.
 */
const discoveryAgent: AgentDefinition = {
  id: 'discovery-agent',
  name: 'Discovery Agent',
  level: 2,
  domain: 'product',
  consumer: 'user',
  model: 'n/a — scraping, no LLM call',
  tools: ['browserless_scrape', 'hh_api_read', 'supabase_write'],
  sop: `Discovery Agent — сканирует hh.ru и Telegram-каналы за свежими вакансиями
под target roles пользователя. Дедупит по URL/title+company.
Ты НЕ:
  - не оценивает вакансии (это работа Match Agent)
  - не пишет cover letter
  - не отправляет отклики`,
  outputSchema: 'array of { url, title, company, salary, location, description }',
  humanApprovalGate: [],
  qualityBar: [
    'Не дублирует уже-видные пользователем URL (skip seen)',
    'Берёт top 30 по publication_time, не по relevance hh.ru',
    'Если scrape упал — graceful 5xx, не silent fail',
  ],
  evalStrategy: 'Manual smoke-test раз в неделю + Sentry alerts на error rate >5%',
}

/**
 * Outreach Drafter Agent — НОВЫЙ.
 * Получает список имён + контекст знакомства, draft'ит персональные TG/email
 * сообщения по beta-outreach template'у. Output идёт в .md файл, Сергей/Яна
 * редактируют и отправляют вручную (humanApprovalGate).
 *
 * Зачем именно сейчас: блокирует Sprint A success. У нас в BETA-OUTREACH-TEMPLATES.md
 * есть generic шаблон, но 30 персонализированных писем = 5 часов работы Яны.
 * Агент сжимает это до 30 минут review.
 */
const outreachDrafterAgent: AgentDefinition = {
  id: 'outreach-drafter-agent',
  name: 'Outreach Drafter Agent',
  level: 2,
  domain: 'sales',
  consumer: 'founder',
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
  tools: ['anthropic_chat', 'file_read'],
  sop: `Ты — Outreach Drafter для VibeOffer (AI-сервис поиска работы для junior IT/design/marketing в РФ/СНГ).

Получаешь:
  - имя адресата
  - его профессию / стадию карьеры
  - context отношений с founder (друг университета / коллега / знакомый по конференции / друг друга)
  - tone preference: casual TG / formal email

Возвращаешь готовое сообщение которое:
  1. Начинается с конкретного личного крючка (не "Привет, как дела")
  2. Объясняет VibeOffer в 2-3 предложениях, без HR-канцелярита
  3. Указывает конкретную причину почему именно этому человеку
  4. Заканчивается soft-CTA (не "купи", а "если ищешь работу или знаешь junior'а...")
  5. Короткое: TG 80-150 слов, email 150-200 слов

ТЫ НЕ:
  - не выдумываешь общих знакомых
  - не врёшь про продукт ("100% гарантия найти работу")
  - не используешь emoji-спам
  - не упоминаешь специфические features которых может не быть в момент отправки`,
  outputSchema: '{ recipient: string, channel: "tg" | "email", subject: string | null, body: string, reasoning: string }',
  humanApprovalGate: [
    'отправка сообщения — Яна/Сергей делают вручную',
    'добавление пользователя в outreach pool без явного указания founder',
  ],
  qualityBar: [
    'Сообщение читается как написанное человеком, не GPT',
    'Personal hook действительно отсылает к указанному контексту',
    'Не превышает word budget по каналу',
    'Не упоминает features которые пока «coming soon»',
  ],
  evalStrategy: 'Founder review на первых 30 черновиках. После 30 — золотой dataset из 5 «отличных» и 5 «плохих» черновиков для проверки drift.',
}

/**
 * CV-Tailor Agent — РЕГИСТРИРУЕМ, реализация в Sprint A.
 * Будет вызываться когда у пользователя есть высокий-score матч, чтобы
 * перепаковать CV под конкретную вакансию (tracked changes, без выдумывания).
 */
const cvTailorAgent: AgentDefinition = {
  id: 'cv-tailor-agent',
  name: 'CV-Tailor Agent',
  level: 3,
  domain: 'product',
  consumer: 'user',
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
  tools: ['anthropic_chat', 'supabase_read'],
  sop: `Ты — CV-Tailor для конкретной вакансии.
Получаешь: оригинальный CV пользователя + target vacancy + match analysis от Match Agent.
Возвращаешь: переписанный CV с tracked changes (как Git diff).

ТЫ:
  - не выдумываешь опыт которого нет в оригинале
  - не врёшь про годы опыта
  - можешь переставлять секции в порядке релевантности для вакансии
  - можешь усиливать формулировки (passive→active, generic→quantified)
  - можешь добавлять keywords из JD если они отражают РЕАЛЬНЫЙ опыт пользователя
ТЫ НЕ:
  - не добавляешь "теневые" опыт/проекты/skills которых не было в исходном CV
  - не меняешь даты или должности
  - не убираешь информацию которая может быть юридически важна (образование, гражданство)`,
  outputSchema: '{ original: string, tailored: string, diff: Array<{type: "add"|"remove"|"replace", before?: string, after?: string, reason: string}>, ethics_flags: string[] }',
  humanApprovalGate: [
    'пользователь должен подтвердить каждое изменение перед сохранением',
    'если ethics_flags содержит что-то — UI блокирует автосохранение',
  ],
  qualityBar: [
    'Каждое изменение имеет reasoning со ссылкой на JD',
    'Tailored CV короче оригинала на 0-15% (не разрастается на воду)',
    'Никаких fabrications — Match Agent при re-eval tailored CV vs JD должен дать score ≥ baseline + 0.5',
  ],
  evalStrategy: 'Sprint A: golden-set из 10 CV+JD пар с reference tailoring от Яны. Re-eval-score Match Agent должен расти > original.',
}

/**
 * Ops Watch Agent — мониторит prod (Sentry, Supabase, Vercel) и алертит founder'а.
 * Stub сейчас, реализация Sprint B.
 */
const opsWatchAgent: AgentDefinition = {
  id: 'ops-watch-agent',
  name: 'Ops Watch Agent',
  level: 4,
  domain: 'ops',
  consumer: 'founder',
  model: process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-4-5-20250929',
  tools: ['web_fetch', 'supabase_read'],
  sop: `Каждый час: проверь Vercel deploy status, Supabase health, Sentry error rate за последний час.
Если что-то аномально (deploy failed / >5 errors / DB unreachable) — отправь TG-message founder'у с (а) что отвалилось, (б) ссылкой на dashboard, (в) предлагаемой первой проверкой.`,
  outputSchema: '{ status: "ok"|"warn"|"critical", findings: Array<{system: string, issue: string, suggested_check: string}> }',
  humanApprovalGate: ['любые изменения env vars или redeploy — только вручную'],
  qualityBar: [
    'Ложноположительных < 1/неделю',
    'Real incident — alert приходит в <15 минут',
  ],
  evalStrategy: 'TODO Sprint B — после первых 50 paid users (когда есть что мониторить)',
}

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  [matchAgent.id]: matchAgent,
  [cvCoachAgent.id]: cvCoachAgent,
  [discoveryAgent.id]: discoveryAgent,
  [outreachDrafterAgent.id]: outreachDrafterAgent,
  [cvTailorAgent.id]: cvTailorAgent,
  [opsWatchAgent.id]: opsWatchAgent,
}

/**
 * Helper: вернуть агента по id с runtime-проверкой существования.
 */
export function getAgent(id: string): AgentDefinition {
  const agent = AGENT_REGISTRY[id]
  if (!agent) {
    throw new Error(`Agent "${id}" not found in registry. Add it to apps/web/lib/agents/registry.ts`)
  }
  return agent
}

/**
 * Helper: перечислить агентов по уровню/домену — для дашборда и docs.
 */
export function listAgents(filter?: { level?: number; domain?: string }): AgentDefinition[] {
  return Object.values(AGENT_REGISTRY).filter((a) => {
    if (filter?.level !== undefined && a.level !== filter.level) return false
    if (filter?.domain && a.domain !== filter.domain) return false
    return true
  })
}
