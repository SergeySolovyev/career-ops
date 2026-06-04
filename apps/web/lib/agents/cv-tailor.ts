/**
 * CV-Tailor Agent — реализация (L3 role compression).
 *
 * Получает: оригинальный CV + target vacancy + match analysis от Match Agent.
 * Возвращает: переписанный CV с tracked changes (diff) + ethics_flags.
 *
 * Ethics rules — что агенту ЗАПРЕЩЕНО (защита от fabrication):
 *   - выдумывать опыт / годы / должности / компании которых нет в оригинале
 *   - менять даты или образование
 *   - убирать юридически важную инфу (гражданство, образование)
 *
 * Что разрешено:
 *   - переставлять секции в порядке релевантности для JD
 *   - усиливать формулировки (passive→active, generic→quantified)
 *   - добавлять keywords из JD которые отражают РЕАЛЬНЫЙ опыт
 *
 * Workflow:
 *   1. Match Agent вернул score ≥ 6 для (CV, JD) пары
 *   2. /api/agents/cv-tailor вызывается с этой парой
 *   3. CV-Tailor возвращает tailored + diff + ethics_flags
 *   4. UI показывает diff пользователю
 *   5. Пользователь подтверждает каждое изменение → сохраняем в user_profiles.cv_text
 *      (или создаём новый record в `tailored_cvs` для конкретной вакансии)
 *
 * Quality bar (см. registry.ts):
 *   - Tailored CV короче оригинала на 0-15%
 *   - Каждый diff имеет reasoning со ссылкой на JD
 *   - re-eval Match Agent на tailored CV → score ≥ baseline + 0.5
 *   - ethics_flags пустой если всё ok; иначе UI блокирует автосохранение
 */

import { invokeAgent } from './runtime'
import type { AgentInvocationResult } from './types'

export interface CvTailorInput {
  /** Оригинальный CV markdown/plain text */
  originalCv: string
  /** Target vacancy — title + company + description + requirements */
  vacancy: {
    title: string
    company: string
    description: string
    location?: string | null
    salary?: string | null
  }
  /** Match analysis от Match Agent (по которому решили tailor'ить) */
  matchAnalysis?: {
    score: number
    strengths: string[]
    weaknesses: string[]
  }
}

export interface CvTailorDiffEntry {
  type: 'add' | 'remove' | 'replace'
  /** Что было — для replace/remove */
  before?: string
  /** Что стало — для add/replace */
  after?: string
  /** Почему это изменение, со ссылкой на JD */
  reason: string
}

export interface CvTailorOutput {
  original: string
  tailored: string
  diff: CvTailorDiffEntry[]
  /**
   * Если агент чувствует что близок к fabrication (e.g. JD требует Kafka,
   * пользователь не упомянул Kafka, но user когда-то писал «event streaming»)
   * — записывает сюда warning. UI должен показать это как «требует подтверждения».
   */
  ethics_flags: string[]
}

/**
 * Tailor CV под конкретную вакансию.
 *
 * Returns AgentInvocationResult чтобы caller получил cost/latency для UI feedback.
 * `result.output` будет CvTailorOutput если ok=true.
 */
export async function tailorCv(
  input: CvTailorInput,
  userId: string | null,
): Promise<AgentInvocationResult<CvTailorOutput>> {
  return invokeAgent<CvTailorOutput>(
    'cv-tailor-agent',
    input,
    {
      trigger: 'api',
      userId,
      // CV — это data от пользователя, JD — data из веба. Оба unsafe в смысле
      // prompt-injection. Хотя в нашем случае мы хорошо контролируем sources
      // (HH scraped + user-typed CV), всё равно best practice по OpenAI.
      unsafeInput: true,
      startedAt: new Date().toISOString(),
    },
    { expectJson: true, maxTokens: 4096 },
  )
}
