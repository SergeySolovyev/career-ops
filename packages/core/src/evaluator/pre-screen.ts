/**
 * Keyword-based pre-screening
 * Ported from career-ops auto-evaluate.mjs preScreenEntry()
 *
 * Free (no API calls). Filters out ~60% of vacancies.
 */

import type { PreScreenResult } from '@careerpilot/config'

const SENIORITY_PATTERNS = /(?:director|head of|vp |chief|cto|cdo|cfo|cio|директор|руководитель|начальник управления|лидер направления|team\s*lead|ai\s*lead|владелец продукта|product\s*owner|заместитель\s+председателя|зампред)/i

const PRE_SCREEN_THRESHOLD = 2.0

export function preScreen(
  title: string,
  description: string,
  company: string,
  positiveKeywords: string[],
  negativeKeywords: string[]
): PreScreenResult {
  const text = `${title} ${description} ${company}`.toLowerCase()
  const matchedPositive: string[] = []
  const matchedNegative: string[] = []

  // Check negative keywords first (instant reject)
  for (const kw of negativeKeywords) {
    if (text.includes(kw.toLowerCase())) {
      matchedNegative.push(kw)
    }
  }

  if (matchedNegative.length > 0) {
    return {
      score: 0,
      matchedPositive: [],
      matchedNegative,
      passed: false,
    }
  }

  // Score positive keywords
  let score = 0
  for (const kw of positiveKeywords) {
    if (text.includes(kw.toLowerCase())) {
      matchedPositive.push(kw)
      score += 1
    }
  }

  // Seniority bonus
  if (SENIORITY_PATTERNS.test(title)) {
    score += 0.5
  }

  return {
    score,
    matchedPositive,
    matchedNegative: [],
    passed: score >= PRE_SCREEN_THRESHOLD,
  }
}
