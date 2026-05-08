/**
 * AI-powered vacancy evaluation using Anthropic Claude
 * Ported from career-ops auto-evaluate.mjs aiEvaluateEntry()
 *
 * Structured JSON output: score 0-5, verdict, strengths, weaknesses
 *
 * ICP-aware: junior/middle/senior segments produce measurably different
 * scores by injecting segment-specific guidance into the system prompt.
 */

import type { AIEvaluation } from '@careerpilot/config'

export type IcpSegment = 'junior' | 'middle' | 'senior'

export interface AiEvaluateOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  cvText: string
  profileSummary?: string
  // ICP-aware fields (Day 2.5):
  icpSegment?: IcpSegment
  skills?: string[]
  experienceYears?: number
}

/**
 * Build segment-specific instructions injected into the system prompt.
 * Junior → penalize 5+yr asks, value mentorship/onboarding.
 * Senior → penalize junior/intern roles, expect ownership/architecture.
 * Middle → balanced; penalize both junior-only and senior-strict roles.
 */
function buildIcpGuidance(
  seg: IcpSegment | undefined,
  years: number | undefined,
): string {
  if (seg === 'junior') {
    return `КАНДИДАТ — JUNIOR (опыт ${years ?? 0} лет).
- Penalize вакансии с требованием 5+ лет опыта (score 1-2)
- Высоко цени: onboarding-программы, mentorship, "junior welcome", обучение
- Норма зарплата: 80-150K ₽
- НЕ оценивай за отсутствие управления командой / стратегического опыта`
  }
  if (seg === 'senior') {
    return `КАНДИДАТ — SENIOR (опыт ${years ?? 5}+ лет).
- Penalize junior/intern роли (score 1-2)
- Высоко цени: impact, ownership, technical leadership, architecture
- Норма зарплата: 300K-1M ₽
- Cmnd ожидает roadmap-влияние, не code monkey-задачи`
  }
  // middle (default)
  return `КАНДИДАТ — MIDDLE (опыт ${years ?? 3} лет).
- Penalize junior-only И senior-strict роли
- Высоко цени: growth path, ownership небольшой команды/feature, ясный stack
- Норма зарплата: 150-300K ₽`
}

export async function aiEvaluate(
  title: string,
  company: string,
  description: string,
  options: AiEvaluateOptions,
): Promise<AIEvaluation> {
  const {
    apiKey,
    model = 'claude-sonnet-4-20250514',
    baseUrl = 'https://api.anthropic.com',
    cvText,
    profileSummary = '',
    icpSegment,
    skills,
    experienceYears,
  } = options

  const icpGuidance = buildIcpGuidance(icpSegment, experienceYears)
  const skillsLine = (skills ?? []).join(', ') || 'не указаны'

  const systemPrompt = `You are an expert career advisor evaluating job vacancies for a candidate.
The candidate's CV is provided. Evaluate the vacancy fit on a scale of 0-5.

${icpGuidance}

Кандидатские skills: ${skillsLine}

Output JSON only:
{
  "score": 4.2,
  "summary": "Brief explanation of the score",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1"],
  "verdict": "apply|maybe|skip",
  "archetype": "detected archetype or null"
}`

  const userPrompt = `## Candidate CV
${cvText.slice(0, 3000)}

${profileSummary ? `## Profile Summary\n${profileSummary}\n` : ''}

## Vacancy
**Title:** ${title}
**Company:** ${company}
**Description:**
${description?.slice(0, 4000) || 'No description available'}

Evaluate this vacancy fit. Return JSON only.`

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
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text || '{}'

  // Parse JSON from response (may have markdown code fences)
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI evaluation response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    score: parsed.score ?? 0,
    summary: parsed.summary ?? '',
    strengths: parsed.strengths ?? [],
    weaknesses: parsed.weaknesses ?? [],
    verdict: parsed.verdict ?? 'skip',
    archetype: parsed.archetype ?? undefined,
  }
}
