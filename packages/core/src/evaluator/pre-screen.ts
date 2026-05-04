/**
 * Keyword-based pre-screening
 * Filters out ~60% of vacancies before AI evaluation (free, no API calls).
 *
 * Sprint 2 update: ICP-aware patterns. Score boosts and penalties depend on
 * candidate's segment (junior / middle / senior).
 *
 * Default ICP: 'middle' — works for both Sprint 0 (Director) and Sprint 2 (junior/middle).
 */

import type { PreScreenResult } from '@careerpilot/config'

export type ICP = 'junior' | 'middle' | 'senior'

const SENIOR_PATTERNS = /(?:director|head of|vp |chief|cto|cdo|cfo|cio|директор|руководитель|начальник управления|лидер направления|team\s*lead|ai\s*lead|владелец продукта|product\s*owner|заместитель\s+председателя|зампред|principal|staff engineer)/i

// Sprint 2: junior/middle bonuses (reverse seniority)
const JUNIOR_BOOST_PATTERNS = /(?:junior|стажер|стажёр|младший|trainee|без опыта|первая работа|внутренний резерв)/i
const MIDDLE_BOOST_PATTERNS = /(?:middle|средний|2-4 года|3-5 лет|engineer\b)/i

// Growth / mentorship signals — relevant for junior/middle ICP
const GROWTH_PATTERNS = /(?:обучение|менторство|mentor|курс|стажировка|kindly|onboarding|first job|career growth|карьерный рост|развитие|adaptation|погружение)/i

// Remote / hybrid — heavier weight for non-MSK candidates.
// Includes both adverb forms (удалённо/удаленно) and noun forms (удалёнка/удаленка).
const REMOTE_PATTERNS = /(?:удалённо|удаленно|удалёнка|удаленка|remote|релокация|relocation|hybrid|гибрид|wfh|work from home)/i

// Overqualification penalties for junior ICP
const OVERQUAL_PATTERNS = /(?:опыт от 5|опыт 5\+|5\+ years|7\+ лет|senior|tech lead|architect|principal|staff engineer)/i

const PRE_SCREEN_THRESHOLD = 2.0

export interface PreScreenOptions {
  /** Candidate's ICP — affects pattern weights. Default 'middle'. */
  icp?: ICP
}

export function preScreen(
  title: string,
  description: string,
  company: string,
  positiveKeywords: string[],
  negativeKeywords: string[],
  options: PreScreenOptions = {},
): PreScreenResult {
  const { icp = 'middle' } = options
  const text = `${title} ${description} ${company}`.toLowerCase()
  const matchedPositive: string[] = []
  const matchedNegative: string[] = []

  // ---- Hard reject: negative keywords ----
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

  // ---- Positive keyword scoring ----
  let score = 0
  for (const kw of positiveKeywords) {
    if (text.includes(kw.toLowerCase())) {
      matchedPositive.push(kw)
      score += 1
    }
  }

  // ---- ICP-aware bonuses/penalties ----
  if (icp === 'senior') {
    // Sprint 0 / Director ICP: boost senior keywords
    if (SENIOR_PATTERNS.test(title)) score += 0.5
  } else if (icp === 'junior') {
    // Sprint 2 / junior ICP: boost junior keywords, penalize senior
    if (JUNIOR_BOOST_PATTERNS.test(title)) score += 0.5
    if (GROWTH_PATTERNS.test(text)) score += 0.4
    if (REMOTE_PATTERNS.test(text)) score += 0.3
    if (OVERQUAL_PATTERNS.test(title)) score -= 0.5 // penalty for overqualification
    if (SENIOR_PATTERNS.test(title)) score -= 0.3
  } else {
    // 'middle' (default): mild bonus for middle keywords + remote
    if (MIDDLE_BOOST_PATTERNS.test(title)) score += 0.3
    if (REMOTE_PATTERNS.test(text)) score += 0.2
    // Mild senior penalty (assume middle doesn't want full senior load)
    if (SENIOR_PATTERNS.test(title)) score -= 0.2
  }

  return {
    score,
    matchedPositive,
    matchedNegative: [],
    passed: score >= PRE_SCREEN_THRESHOLD,
  }
}
