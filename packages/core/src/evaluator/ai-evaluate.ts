/**
 * AI-powered vacancy evaluation using Anthropic Claude
 * Ported from career-ops auto-evaluate.mjs aiEvaluateEntry()
 *
 * Structured JSON output: score 0-5, verdict, strengths, weaknesses
 */

import type { AIEvaluation } from '@careerpilot/config'

interface AIEvaluateOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  cvText: string
  profileSummary?: string
}

export async function aiEvaluate(
  title: string,
  company: string,
  description: string,
  options: AIEvaluateOptions
): Promise<AIEvaluation> {
  const {
    apiKey,
    model = 'claude-sonnet-4-20250514',
    baseUrl = 'https://api.anthropic.com',
    cvText,
    profileSummary = '',
  } = options

  const systemPrompt = `You are an expert career advisor evaluating job vacancies for a candidate.
The candidate's CV is provided. Evaluate the vacancy fit on a scale of 0-5.

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
