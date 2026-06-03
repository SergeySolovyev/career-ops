/**
 * Agent OS — типы для агентной операционной системы VibeOffer.
 *
 * Концептуально (по фрейму YC/Bessemer/Menlo/Sequoia 2025-2026):
 *   - агент = роль + модель + инструменты + SOP + критерии качества
 *   - агент производит unit of work (а не «доступ к UI»)
 *   - агент имеет уровень автономии: assistant (L1) → workflow executor (L2)
 *     → role compression (L3) → digital employee (L4) → agent-native company (L5)
 *
 * VibeOffer текущее позиционирование:
 *   - Existing agents (Match, Discovery, CV Coach, Outreach) уже на L2
 *   - Цель Sprint A-B: довести Match + CV Coach до L3 (60-80% работы AI делает)
 *   - L4 (digital employee с собственным inbox) — Sprint D-E, после первых 50 paid
 *
 * Безопасность (по Menlo / OpenAI computer-use guidelines):
 *   - inputSchema валидируется ДО передачи в модель
 *   - humanApprovalGate описывает что НЕ может агент делать сам
 *   - prompt injection guard: untrusted inputs помечаются как unsafe
 */

export type AgentLevel = 1 | 2 | 3 | 4 | 5

export type AgentDomain =
  | 'product'       // работает с CV/вакансиями/откликами для пользователя
  | 'sales'         // выходит на лиды, drafts личные сообщения
  | 'ops'           // мониторит prod, healthcheck, alerts
  | 'research'      // конкурентка, рынок, тренды
  | 'support'       // отвечает на тикеты, drafts emails
  | 'internal'      // внутренний tooling для founder'а

/**
 * Тулзы — то, что агент может вызывать.
 * Whitelist чтобы агент НЕ мог случайно вызвать destructive endpoint.
 */
export type AgentTool =
  | 'anthropic_chat'        // базовый LLM call (всегда есть)
  | 'supabase_read'         // SELECT-only, не INSERT/UPDATE/DELETE
  | 'supabase_write'        // INSERT/UPDATE — требует humanApprovalGate
  | 'browserless_scrape'    // headless browser для scraping
  | 'hh_api_read'           // публичный HH API (без auth)
  | 'tg_send_dm'            // отправка в TG от worker'а — требует approval
  | 'email_send'            // отправка email через Resend — требует approval
  | 'web_fetch'             // GET на любой URL (safe)
  | 'file_read'             // чтение локальных файлов (data/)

/**
 * Описание агента — single source of truth.
 * Регистрируется в registry.ts.
 */
export interface AgentDefinition {
  /** Уникальный ID агента — kebab-case, используется в логах */
  id: string

  /** Человекочитаемое имя — для документации и Sentry */
  name: string

  /** Текущий уровень автономии */
  level: AgentLevel

  /** Бизнес-домен */
  domain: AgentDomain

  /** Кто конечный потребитель работы агента */
  consumer: 'user' | 'founder' | 'internal_system'

  /** Какую модель использует. Default: claude-sonnet-4-5 */
  model: string

  /** Разрешённые тулзы */
  tools: AgentTool[]

  /** System prompt — SOP агента. Что он делает, чего НЕ делает. */
  sop: string

  /** Описание ожидаемого output'а — для downstream validation */
  outputSchema: string

  /**
   * humanApprovalGate — список действий, которые агент НЕ выполняет
   * автономно. Каждое требует ручного approval ($ или send).
   * Пусто для read-only/draft-only агентов.
   */
  humanApprovalGate: string[]

  /**
   * Quality bar — критерии что считать «хорошим» выводом.
   * Используется при ручном QA и при будущих evals.
   */
  qualityBar: string[]

  /** Где описана eval-стратегия. Может быть TODO для новых агентов. */
  evalStrategy: string
}

/**
 * Контекст вызова агента — то, что приходит с триггером (cron, API, manual).
 * Не путать с input — input это user-data, context это metadata.
 */
export interface AgentInvocationContext {
  /** Откуда вызвали — для audit log */
  trigger: 'api' | 'cron' | 'manual' | 'webhook' | 'subagent'

  /** user_id если работаем за пользователя; null для internal/ops агентов */
  userId: string | null

  /**
   * unsafeInput=true если input пришёл из untrusted source
   * (e.g. tg message, веб-страница). Агент должен относиться к
   * содержимому как к данным, не как к инструкциям (по OpenAI prompt
   * injection guidelines).
   */
  unsafeInput: boolean

  /** Timestamp вызова */
  startedAt: string
}

/**
 * Результат вызова — захватываем для audit + cost tracking + evals.
 */
export interface AgentInvocationResult<T = unknown> {
  agentId: string
  ok: boolean
  output: T | null
  errorMessage: string | null
  /** Tokens spent — для cost accounting */
  inputTokens: number
  outputTokens: number
  /** Latency в миллисекундах */
  latencyMs: number
  /** Какая модель ответила (для будущего routing) */
  model: string
  /** ISO-8601 timestamp окончания */
  finishedAt: string
}
