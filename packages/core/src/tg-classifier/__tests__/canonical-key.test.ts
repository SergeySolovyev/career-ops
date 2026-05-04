import { describe, expect, it } from 'vitest'
import { canonicalKey, extractHhUrl } from '../canonical-key'

describe('canonicalKey', () => {
  it('basic ASCII slug — company + title (seniority words stripped)', () => {
    // 'senior' is a stop-word — collapses "Senior Frontend" and "Middle Frontend"
    // to the same canonical key for cross-source dedup.
    expect(canonicalKey('Mokka', 'Senior Frontend Developer')).toBe(
      'mokka|frontend-developer',
    )
  })

  it('collapses Senior/Middle/Junior to same key (cross-seniority dedup)', () => {
    const a = canonicalKey('Mokka', 'Senior Frontend Developer')
    const b = canonicalKey('Mokka', 'Middle Frontend Developer')
    const c = canonicalKey('Mokka', 'Junior Frontend Developer')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('preserves Cyrillic characters in slug', () => {
    const key = canonicalKey('Гринмани', 'Java-разработчик')
    const [company, title] = key.split('|')
    expect(company).toContain('грин')
    expect(title).toContain('java')
    expect(title).toContain('разработчик')
  })

  it('strips English stop-words like "for", "team", "senior"', () => {
    const key = canonicalKey('Acme', 'Senior Developer for Team')
    const [, title] = key.split('|')
    expect(title.split('-')).not.toContain('for')
    expect(title.split('-')).not.toContain('team')
    expect(title.split('-')).not.toContain('senior') // seniority is stripped
    expect(title).toContain('developer')
  })

  it('strips Russian stop-words like "в", "для"', () => {
    const key = canonicalKey('Мокка', 'Разработчик в команду для проекта')
    const [, title] = key.split('|')
    const tokens = title.split('-')
    expect(tokens).not.toContain('в')
    expect(tokens).not.toContain('для')
    expect(title).toContain('разработчик')
  })

  it('handles unicode normalization — smart quotes do not break it', () => {
    // Curly/smart quotes “ ” and en-dash should be stripped as punctuation.
    // 'senior' is a stop-word, so only 'developer' remains in title.
    const key = canonicalKey('“Mokka”', 'Senior – Developer')
    expect(key).toBe('mokka|developer')
  })

  it('returns "unknown|untitled" for empty inputs', () => {
    expect(canonicalKey('', '')).toBe('unknown|untitled')
  })

  it('returns "unknown|untitled" for whitespace-only inputs', () => {
    expect(canonicalKey('   ', '   ')).toBe('unknown|untitled')
  })

  it('truncates very long company name to 60 chars', () => {
    const longCompany = 'a'.repeat(200)
    const key = canonicalKey(longCompany, 'role')
    const [company] = key.split('|')
    expect(company.length).toBeLessThanOrEqual(60)
  })

  it('truncates very long title to 80 chars', () => {
    const longTitle = 'b'.repeat(200)
    const key = canonicalKey('co', longTitle)
    const [, title] = key.split('|')
    expect(title.length).toBeLessThanOrEqual(80)
  })

  it('strips quotes and punctuation from organisation legal-form prefix', () => {
    const key = canonicalKey('ООО "Йота"', 'Frontend!')
    expect(key).not.toContain('"')
    expect(key).not.toContain('!')
    expect(key).not.toContain('(')
    expect(key).not.toContain(')')
    // Should still contain meaningful tokens
    const [company, title] = key.split('|')
    expect(company).toContain('йота')
    expect(title).toBe('frontend')
  })

  it('collapses consecutive dashes/spaces into single dash', () => {
    const key = canonicalKey('A   B', 'C  ---  D')
    expect(key).not.toMatch(/--/)
  })

  it('does not start or end with dash', () => {
    const key = canonicalKey('-Acme-', '-Developer-')
    const [company, title] = key.split('|')
    expect(company.startsWith('-')).toBe(false)
    expect(company.endsWith('-')).toBe(false)
    expect(title.startsWith('-')).toBe(false)
    expect(title.endsWith('-')).toBe(false)
  })
})

describe('extractHhUrl', () => {
  it('returns null for text with no URL', () => {
    expect(extractHhUrl('плохой текст без ссылки')).toBeNull()
  })

  it('extracts canonical hh.ru URL from a normal sentence', () => {
    expect(
      extractHhUrl('смотри https://hh.ru/vacancy/12345 это интересно'),
    ).toBe('https://hh.ru/vacancy/12345')
  })

  it('normalises hh.kz domain to hh.ru', () => {
    expect(extractHhUrl('Vacancy https://hh.kz/vacancy/77777')).toBe(
      'https://hh.ru/vacancy/77777',
    )
  })

  it('normalises hh.by domain to hh.ru', () => {
    expect(extractHhUrl('Job: https://hh.by/vacancy/55555 apply now')).toBe(
      'https://hh.ru/vacancy/55555',
    )
  })

  it('normalises hh.uz domain to hh.ru', () => {
    expect(extractHhUrl('https://hh.uz/vacancy/22222')).toBe(
      'https://hh.ru/vacancy/22222',
    )
  })

  it('returns the first hh.ru link when multiple URLs are present', () => {
    const text =
      'first https://hh.ru/vacancy/111 then https://example.com/x and https://hh.ru/vacancy/222'
    expect(extractHhUrl(text)).toBe('https://hh.ru/vacancy/111')
  })

  it('returns null for malformed URLs (missing vacancy id)', () => {
    expect(extractHhUrl('see https://hh.ru/vacancy/ for details')).toBeNull()
  })

  it('returns null for non-hh URLs', () => {
    expect(extractHhUrl('apply at https://example.com/jobs/123')).toBeNull()
  })

  it('returns null for hh.ru URL with non-numeric id', () => {
    expect(extractHhUrl('https://hh.ru/vacancy/abc')).toBeNull()
  })

  it('handles http (non-https) hh.ru URLs', () => {
    expect(extractHhUrl('http://hh.ru/vacancy/9999')).toBe(
      'https://hh.ru/vacancy/9999',
    )
  })

  it('handles hh.ru URL with subdomain prefix', () => {
    expect(extractHhUrl('https://novosibirsk.hh.ru/vacancy/4242')).toBe(
      'https://hh.ru/vacancy/4242',
    )
  })
})
