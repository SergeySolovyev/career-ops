/**
 * Company-aware cover letter generator
 * Ported from career-ops scripts/generate-cover-letter.mjs
 *
 * Structure: COMPANY -> NEED -> RESONANCE -> ACTION
 * NOT the candidate-first pattern.
 */

import type { CoverLetterRequest, CoverLetterResult } from '@careerpilot/config'

const SYSTEM_PROMPT_RU = `Ты — эксперт по написанию сопроводительных писем для кандидатов на Director/C-level позиции.

СТРУКТУРА (строго в этом порядке):
1. КОМПАНИЯ (1-2 предложения): Что делает компания. Почему это интересно. Конкретика из JD, не "динамично развивающаяся".
2. ПОТРЕБНОСТЬ (2-3 предложения): Что компании нужно. Ключевые задачи и challenges из JD. "Вам нужен человек, который..."
3. РЕЗОНАНС (3-4 пункта): Конкретные точки CV x JD. Каждый пункт: {задача из JD} -> {опыт кандидата с цифрой}.
4. ДЕЙСТВИЕ (1 предложение): Предложение следующего шага.

ОГРАНИЧЕНИЯ:
- Максимум 1800 символов (лимит hh.ru ~2000)
- НЕ начинать с "Уважаемый" или "Здравствуйте"
- НЕ использовать: "с большим интересом", "динамично развивающаяся"
- ТОЛЬКО факты из CV, НИКОГДА не выдумывать
- Используй strengths и keywords из AI-оценки как подсказки для фокуса`

const SYSTEM_PROMPT_EN = `You are an expert cover letter writer for Director/C-level positions.

STRUCTURE (strictly in this order):
1. COMPANY (1-2 sentences): What the company does. Why it's interesting. Specifics from JD.
2. NEED (2-3 sentences): What the company needs. Key challenges from JD.
3. RESONANCE (3-4 bullets): Specific CV x JD intersections. Each: {JD requirement} -> {candidate experience with numbers}.
4. ACTION (1 sentence): Propose next step.

CONSTRAINTS:
- Maximum 1800 characters
- Do NOT start with "Dear" or generic openings
- ONLY facts from CV, NEVER fabricate
- Use strengths and keywords from AI evaluation as focus hints`

function buildUserPrompt(req: CoverLetterRequest): string {
  return `## CV кандидата
${req.cvText.slice(0, 3000)}

## Вакансия
**Компания:** ${req.company}
**Роль:** ${req.role}
**Описание:**
${req.jdText.slice(0, 4000)}

${req.strengths?.length ? `## AI-оценка: сильные стороны\n${req.strengths.join('\n')}\n` : ''}
${req.keywords?.length ? `## Ключевые слова\n${req.keywords.join(', ')}\n` : ''}

Напиши сопроводительное письмо. Только текст письма, без заголовков и пояснений.`
}

function buildFallbackLetter(req: CoverLetterRequest): string {
  const strengths = req.strengths?.slice(0, 3) || []
  const keywords = req.keywords?.slice(0, 5) || []

  let letter = `${req.company} — ${req.jdText.slice(0, 100).replace(/\n/g, ' ').trim()}...\n\n`
  letter += `Ваши задачи (${keywords.join(', ')}) совпадают с моим опытом:\n\n`

  for (const s of strengths) {
    letter += `• ${s}\n`
  }

  letter += `\nГотов обсудить детали. Резюме в приложении.`
  return letter
}

export async function generateCoverLetter(
  req: CoverLetterRequest,
  apiOptions?: { apiKey: string; model?: string; baseUrl?: string }
): Promise<CoverLetterResult> {
  // Try LLM generation first
  if (apiOptions?.apiKey) {
    try {
      const systemPrompt = req.lang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_RU
      const userPrompt = buildUserPrompt(req)

      const response = await fetch(`${apiOptions.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiOptions.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: apiOptions.model || 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const text = data.content?.[0]?.text || ''

        return {
          text: text.slice(0, 1800),
          provider: apiOptions.model || 'claude',
          cached: false,
        }
      }
    } catch (err) {
      console.error('[cover-letter] LLM failed, using fallback:', err)
    }
  }

  // Fallback: keyword-enriched template
  return {
    text: buildFallbackLetter(req),
    provider: 'template',
    cached: false,
  }
}
