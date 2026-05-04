/**
 * Pass 1: Batch-classify Telegram messages as vacancy / non-vacancy.
 *
 * Uses Claude Haiku 4.5 to process up to ~50 messages in a single API call.
 * Cost target: ~$0.0001 per message.
 *
 * Input: array of raw TG messages + candidate's CV summary (for role-match scoring)
 * Output: per-message classification + token usage for cost tracking
 */

import type {
  TgMessage,
  ClassificationResult,
  TokenUsage,
} from './types'

interface ClassifyOptions {
  apiKey: string
  /** Default: claude-haiku-4-5 (or override via ANTHROPIC_HAIKU_MODEL env when called from Vercel) */
  model?: string
  baseUrl?: string
  /** Compressed CV summary used for role-match scoring */
  candidateSummary: string
  /** User's positive keywords (jobs they want); reinforces role-match */
  candidateKeywords?: string[]
  /** Max messages per API call. Default 50, hard cap 100. */
  batchSize?: number
}

const DEFAULT_MODEL = 'claude-haiku-4-5'
// Node-only env fallback — packages/core is consumed in Vercel serverless context.
function envModel(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.ANTHROPIC_HAIKU_MODEL || undefined
  }
  return undefined
}
const DEFAULT_BATCH_SIZE = 50
const MAX_BATCH_SIZE = 100
const MAX_MESSAGE_CHARS = 1500 // truncate runaway messages

const SYSTEM_PROMPT = `You are a fast classifier for Russian-language Telegram messages from IT/digital job channels.

For EACH message, decide:
1. is_vacancy: true if the message describes a SPECIFIC OPEN POSITION (with role + company or contact). False for: ads, news, polls, promo, links to courses, recruiter intros, "looking for" from candidate side, archived/closed positions.
2. role_match: 0-3 score for fit with the candidate's profile.
   - 0: no signal at all
   - 1: same domain (IT/digital) but different role
   - 2: matches one of candidate's target roles or keywords
   - 3: matches role AND seniority AND tech stack

Reply with a SINGLE JSON object: {"results": [{"i": <index>, "v": <true|false>, "r": <0-3>}, ...]}
Use indices from input order. Do NOT include reasoning. Be conservative on role_match.`

const USER_PROMPT = (
  candidateSummary: string,
  keywords: string[],
  messages: { i: number; text: string }[],
) => `# Candidate
${candidateSummary.slice(0, 1500)}

# Target keywords
${keywords.slice(0, 30).join(', ') || '(none)'}

# Messages to classify (${messages.length})
${messages.map((m) => `## i=${m.i}\n${m.text.slice(0, MAX_MESSAGE_CHARS)}`).join('\n\n')}

Return JSON.`

interface BatchResponse {
  results: ClassificationResult[]
  usage: TokenUsage
}

/**
 * Classify a batch of Telegram messages. Splits into chunks if larger than batchSize.
 */
export async function classifyBatch(
  messages: TgMessage[],
  options: ClassifyOptions,
): Promise<BatchResponse> {
  const {
    apiKey,
    model = envModel() || DEFAULT_MODEL,
    baseUrl = 'https://api.anthropic.com',
    candidateSummary,
    candidateKeywords = [],
    batchSize = DEFAULT_BATCH_SIZE,
  } = options

  if (messages.length === 0) {
    return { results: [], usage: { inputTokens: 0, outputTokens: 0 } }
  }

  const effectiveBatch = Math.min(Math.max(1, batchSize), MAX_BATCH_SIZE)
  const chunks: TgMessage[][] = []
  for (let i = 0; i < messages.length; i += effectiveBatch) {
    chunks.push(messages.slice(i, i + effectiveBatch))
  }

  const allResults: ClassificationResult[] = []
  let totalInput = 0
  let totalOutput = 0

  for (const chunk of chunks) {
    const indexed = chunk.map((m, idx) => ({ i: idx, text: m.text }))
    const userPrompt = USER_PROMPT(candidateSummary, candidateKeywords, indexed)

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`Classifier API ${response.status}: ${errBody.slice(0, 300)}`)
    }

    const data = await response.json()
    totalInput += data.usage?.input_tokens || 0
    totalOutput += data.usage?.output_tokens || 0

    const text = data.content?.[0]?.text || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Classifier returned non-JSON response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as { results: { i: number; v: boolean; r: 0|1|2|3 }[] }

    for (const r of parsed.results || []) {
      const original = chunk[r.i]
      if (!original) continue
      allResults.push({
        messageId: original.messageId,
        isVacancy: !!r.v,
        roleMatch: r.r,
      })
    }
  }

  return {
    results: allResults,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
  }
}
