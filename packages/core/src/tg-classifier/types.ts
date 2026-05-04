/**
 * Shared types for Telegram message classification + vacancy extraction.
 */

/** Raw Telegram message as received from MTProto worker. */
export interface TgMessage {
  /** Telegram message id within the channel (monotonically increasing) */
  messageId: number
  /** Channel username without @ (lowercase) */
  channelUsername: string
  /** Plain text content (entities stripped) */
  text: string
  /** Unix timestamp seconds */
  date: number
  /** Optional: t.me/<channel>/<messageId> deep-link */
  url?: string
}

/** Output of pass-1 batch classifier. */
export interface ClassificationResult {
  messageId: number
  /** True if message looks like a job vacancy */
  isVacancy: boolean
  /**
   * 0 = no signal, 1 = weak (mention only), 2 = clear vacancy,
   * 3 = vacancy + clear role match for candidate
   */
  roleMatch: 0 | 1 | 2 | 3
  /** Optional short reason from classifier (debug) */
  reason?: string
}

/** Token usage tracking for cost analytics. */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

/** Output of pass-2 single-message vacancy extractor. */
export interface ExtractedVacancy {
  title: string
  company: string
  /** Raw description (the original message text, cleaned) */
  description: string
  /** ISO-3166 city or null */
  location: string | null
  /** "120000-180000 RUB" or null */
  salaryRange: string | null
  /** External URL parsed from text (apply form, hh.ru link, etc.) */
  externalUrl: string | null
  /** Tags like "remote", "frontend", "junior" — for UI badges */
  tags: string[]
}
