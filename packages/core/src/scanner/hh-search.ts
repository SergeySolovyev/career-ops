/**
 * hh.ru vacancy scanner
 * Ported from career-ops scripts/hh-search.mjs
 *
 * Uses hh.ru public API (no auth required)
 * GET https://api.hh.ru/vacancies?text=...&area=1&per_page=100
 */

import type { ScannedVacancy } from '@careerpilot/config'

const HH_API_BASE = 'https://api.hh.ru'
const RATE_LIMIT_MS = 250 // hh.ru rate limit
const USER_AGENT = 'CareerPilot/1.0 (job-search-automation)'

// Default search queries — ported from career-ops (47 queries, 4 tiers)
const DEFAULT_QUERIES = {
  tier1: [
    'директор цифровая трансформация',
    'CDO Chief Digital Officer',
    'руководитель AI ML',
    'директор казначейство',
    'руководитель DeFi блокчейн',
    'CTO блокчейн финтех',
    'директор инновации банк',
    'руководитель FinTech цифровые финансы',
  ],
  tier2: [
    'лидер направления AI ИИ',
    'team lead AI ML банк',
    'AI lead финтех',
    'владелец продукта AI',
    'менеджер продукта финтех блокчейн',
    'заместитель председателя правления',
    'product owner AI финансы',
    'руководитель ИИ банк',
  ],
  tier3: [
    'директор ИИ искусственный интеллект',
    'криптоактивы казначейство управление',
    'крипто продукты риск-менеджмент',
    'цифровой рубль CBDC',
    'директор операционный финтех платежи',
    'стратегия ИИ решений банк',
    'руководитель AI проект банк',
  ],
}

interface HHSearchOptions {
  queries?: string[]
  area?: number // 1 = Moscow, 2 = SPb
  experience?: string // 'between3And6' | 'moreThan6'
  perPage?: number
  positiveKeywords?: string[]
  negativeKeywords?: string[]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function matchesKeywords(
  text: string,
  positive: string[],
  negative: string[]
): boolean {
  const lower = text.toLowerCase()
  const hasNegative = negative.some(kw => lower.includes(kw.toLowerCase()))
  if (hasNegative) return false
  if (positive.length === 0) return true
  return positive.some(kw => lower.includes(kw.toLowerCase()))
}

async function searchHH(
  query: string,
  options: { area: number; experience: string; perPage: number }
): Promise<any[]> {
  const params = new URLSearchParams({
    text: query,
    area: String(options.area),
    experience: options.experience,
    per_page: String(options.perPage),
    order_by: 'publication_time',
  })

  const response = await fetch(`${HH_API_BASE}/vacancies?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  })

  if (!response.ok) {
    if (response.status === 403) {
      console.warn(`[hh.ru] Rate limited on query: ${query}`)
      return []
    }
    throw new Error(`hh.ru API error: ${response.status}`)
  }

  const data = await response.json()
  return data.items || []
}

function parseVacancy(item: any): ScannedVacancy {
  return {
    externalId: String(item.id),
    source: 'hh_ru',
    url: item.alternate_url || `https://hh.ru/vacancy/${item.id}`,
    title: item.name || '',
    company: item.employer?.name || 'N/A',
    companyUrl: item.employer?.url || item.employer?.alternate_url || undefined,
    salaryFrom: item.salary?.from || undefined,
    salaryTo: item.salary?.to || undefined,
    salaryCurrency: item.salary?.currency || undefined,
    location: item.area?.name || undefined,
    experience: item.experience?.name || undefined,
    description: item.snippet?.responsibility || undefined,
  }
}

export async function scanHHRu(
  options: HHSearchOptions = {}
): Promise<ScannedVacancy[]> {
  const queries = options.queries || [
    ...DEFAULT_QUERIES.tier1,
    ...DEFAULT_QUERIES.tier2,
    ...DEFAULT_QUERIES.tier3,
  ]
  const area = options.area ?? 1
  const experience = options.experience ?? 'moreThan6'
  const perPage = options.perPage ?? 100
  const positive = options.positiveKeywords ?? []
  const negative = options.negativeKeywords ?? []

  const seen = new Set<string>()
  const results: ScannedVacancy[] = []

  for (const query of queries) {
    try {
      const items = await searchHH(query, { area, experience, perPage })

      for (const item of items) {
        const id = String(item.id)
        if (seen.has(id)) continue
        seen.add(id)

        const vacancy = parseVacancy(item)
        const searchText = `${vacancy.title} ${vacancy.company} ${vacancy.description || ''}`

        if (matchesKeywords(searchText, positive, negative)) {
          results.push(vacancy)
        }
      }

      await sleep(RATE_LIMIT_MS)
    } catch (err) {
      console.error(`[hh.ru] Error on query "${query}":`, err)
    }
  }

  return results
}
