/**
 * Outreach Drafter Agent — реализация.
 *
 * Получает batch людей из «outreach list» и для каждого drafts'ит
 * персональное сообщение в TG / email. Output идёт в .md файл,
 * Сергей/Яна редактируют и отправляют вручную (это и есть humanApprovalGate).
 *
 * Использование (как библиотека):
 *   import { draftOutreachBatch } from '@/lib/agents/outreach-drafter'
 *   const drafts = await draftOutreachBatch([{ name: '...', profession: '...', ... }])
 *
 * Использование (CLI):
 *   tsx scripts/draft-outreach.ts  # читает docs/outreach-list.json, пишет docs/OUTREACH-DRAFTS.md
 */

import { invokeAgent } from './runtime'

export interface OutreachTarget {
  /** Имя адресата (как обращаются друзья) */
  name: string
  /** Профессия / стадия карьеры. Используется чтобы агент понимал ICP fit */
  profession: string
  /** Контекст знакомства: «друг универа», «коллега из X», «знакомый по Y» */
  relationship: string
  /** TG handle или email — для финальной .md ссылки */
  handle: string
  /** Канал — определяет word budget + tone */
  channel: 'tg' | 'email'
}

export interface OutreachDraft {
  recipient: string
  channel: 'tg' | 'email'
  subject: string | null
  body: string
  /** Почему агент выбрал такой hook — для founder review */
  reasoning: string
}

/**
 * Draft одно сообщение. Используется внутри batch + опционально из API.
 */
export async function draftOutreachOne(
  target: OutreachTarget,
): Promise<OutreachDraft | { error: string }> {
  const result = await invokeAgent<OutreachDraft>(
    'outreach-drafter-agent',
    target,
    {
      trigger: 'manual',
      userId: null,
      unsafeInput: false,
      startedAt: new Date().toISOString(),
    },
    { expectJson: true, maxTokens: 1024 },
  )

  if (!result.ok || !result.output) {
    return { error: result.errorMessage ?? 'unknown' }
  }
  return result.output
}

/**
 * Draft batch — sequentially чтобы не упереться в Anthropic rate limit
 * на free/low-tier ключах. Если > 10 targets — переключиться на parallel
 * с concurrency 3 (TODO Sprint A).
 *
 * Возвращает: для каждого target — либо OutreachDraft, либо {error: string}.
 * Не throw'ит — позволяет частичный успех (29 из 30 written).
 */
export async function draftOutreachBatch(
  targets: OutreachTarget[],
): Promise<Array<OutreachDraft | { error: string; recipient: string }>> {
  const results: Array<OutreachDraft | { error: string; recipient: string }> = []
  for (const target of targets) {
    const draft = await draftOutreachOne(target)
    if ('error' in draft) {
      results.push({ error: draft.error, recipient: target.name })
    } else {
      results.push(draft)
    }
  }
  return results
}
