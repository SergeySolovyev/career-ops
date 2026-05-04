/**
 * Telegram message classification + vacancy extraction.
 *
 * Two-pass pipeline:
 *   1. classifyBatch() — Haiku batch-classifies as vacancy/non-vacancy
 *   2. extractVacancy() — Sonnet extracts structured fields for vacancies that pass roleMatch>=2
 *
 * Then handoff to existing aiEvaluate() for the 0-5 fit score.
 */

export { classifyBatch } from './classify-batch'
export { extractVacancy } from './extract-vacancy'
export { canonicalKey, extractHhUrl } from './canonical-key'
export type {
  TgMessage,
  ClassificationResult,
  ExtractedVacancy,
  TokenUsage,
} from './types'
