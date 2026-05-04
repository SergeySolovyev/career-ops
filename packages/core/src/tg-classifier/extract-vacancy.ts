/**
 * Pass 2: Extract structured vacancy data from a single Telegram message.
 *
 * Only called for messages where pass-1 returned isVacancy=true && roleMatch>=2.
 * Uses Claude Sonnet 4.5 (same as HH evaluation) for accurate field extraction.
 *
 * Output is then fed into existing aiEvaluate() to get the 0-5 score.
 */

import type { ExtractedVacancy, TgMessage, TokenUsage } from './types'

interface ExtractOptions {
  apiKey: string
  /** Default: claude-sonnet-4-5-20250929 */
  model?: string
  baseUrl?: string
}

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const MAX_MESSAGE_CHARS = 4000

const SYSTEM_PROMPT = `You extract structured fields from Russian-language Telegram job posts.

Output JSON ONLY in this exact schema:
{
  "title": "Job role title (e.g. 'Senior Frontend Developer')",
  "company": "Company name (e.g. 'Mokka' or 'Без названия' if absent)",
  "description": "Cleaned full description without contact details",
  "location": "City (Moscow / Remote / null)",
  "salaryRange": "120000-180000 RUB or null",
  "externalUrl": "Apply URL — hh.ru, company site, form, t.me/contact_bot or null",
  "tags": ["array of 1-5 short tags: tech stack, seniority, work mode"]
}

Rules:
- "title" SHOULD include seniority if mentioned (Junior/Middle/Senior/Lead)
- "company" — strip leading 'ООО', '"' quotes
- "location" — single value: "Москва", "Remote", "Hybrid (Moscow)", or null
- "salaryRange" — preserve original currency notation (RUB/$ /€)
- "externalUrl" — pick the MOST application-relevant link
- "tags" — lowercase, no #, e.g. ["react", "remote", "middle", "frontend"]
- If field is unknown, use null (not empty string), except "title"/"company"/"description" which are required`

interface ExtractResponse {
  vacancy: ExtractedVacancy
  usage: TokenUsage
}

export async function extractVacancy(
  message: TgMessage,
  options: ExtractOptions,
): Promise<ExtractResponse> {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    baseUrl = 'https://api.anthropic.com',
  } = options

  const userPrompt = `## Telegram message (channel @${message.channelUsername})
${message.text.slice(0, MAX_MESSAGE_CHARS)}

Extract structured vacancy. Return JSON only.`

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`Extract API ${response.status}: ${errBody.slice(0, 300)}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Extractor returned non-JSON')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    vacancy: {
      title: String(parsed.title || 'Без названия').slice(0, 200),
      company: String(parsed.company || 'Без названия').slice(0, 200),
      description: String(parsed.description || message.text).slice(0, 5000),
      location: parsed.location ? String(parsed.location).slice(0, 100) : null,
      salaryRange: parsed.salaryRange ? String(parsed.salaryRange).slice(0, 100) : null,
      externalUrl: parsed.externalUrl ? String(parsed.externalUrl).slice(0, 500) : null,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.slice(0, 8).map((t: unknown) => String(t).toLowerCase().slice(0, 40))
        : [],
    },
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    },
  }
}
