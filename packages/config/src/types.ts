// ========================================
// Vacancy source types
// ========================================

export type VacancySource = 'hh_ru' | 'linkedin' | 'telegram' | 'portal' | 'greenhouse' | 'lever'

export type ApplicationStatus =
  | 'draft'
  | 'sent'
  | 'delivered'
  | 'replied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'discarded'

export type EvaluationVerdict = 'apply' | 'maybe' | 'skip'

export type ApplicationChannel = 'hh_ru' | 'email' | 'portal'

// ========================================
// Scanner types (from career-ops hh-search.mjs)
// ========================================

export interface ScannedVacancy {
  externalId: string
  source: VacancySource
  url: string
  title: string
  company: string
  companyUrl?: string
  salaryFrom?: number
  salaryTo?: number
  salaryCurrency?: string
  location?: string
  experience?: string
  description?: string
}

// ========================================
// Evaluation types (from career-ops auto-evaluate.mjs)
// ========================================

export interface PreScreenResult {
  score: number
  matchedPositive: string[]
  matchedNegative: string[]
  passed: boolean
}

export interface AIEvaluation {
  score: number // 0-5
  summary: string
  strengths: string[]
  weaknesses: string[]
  verdict: EvaluationVerdict
  archetype?: string
  reportMarkdown?: string
}

// ========================================
// Cover Letter types
// ========================================

export interface CoverLetterRequest {
  jdText: string
  company: string
  role: string
  cvText: string
  strengths?: string[]
  keywords?: string[]
  lang?: 'ru' | 'en'
}

export interface CoverLetterResult {
  text: string
  provider: string
  cached: boolean
  filePath?: string
}

// ========================================
// CV Tailoring types
// ========================================

export interface CVTailoringRequest {
  cvText: string
  jdText: string
  company: string
  role: string
  keywords: string[]
  lang?: 'ru' | 'en'
}

export interface CVTailoringResult {
  html: string
  pdfUrl?: string
  atsScore?: number
  missingKeywords?: string[]
}
