/**
 * Canonical key generator for cross-source deduplication.
 *
 * Same vacancy may appear on hh.ru AND in Telegram channels.
 * We don't merge — we keep both rows but link them via canonical_key
 * so UI can show "Найдено в N местах".
 *
 * Key = lowercased slug of (company + title), with stop-word stripping
 * and basic transliteration (Cyrillic stays as Cyrillic — we only
 * normalize whitespace + punctuation).
 */

const STOP_WORDS = new Set([
  // English
  'a', 'an', 'the', 'to', 'in', 'at', 'on', 'for', 'with', 'and', 'or',
  // Russian
  'в', 'на', 'по', 'и', 'или', 'для', 'от', 'до', 'с', 'из',
  // Common job-title noise
  'job', 'position', 'role', 'opening', 'вакансия', 'вакансии', 'требуется',
  'работа', 'team', 'г', 'москва', 'спб', 'удаленно', 'удалённо', 'remote',
  // Seniority — collapses "Senior Frontend" / "Middle Frontend" to same key
  'senior', 'middle', 'junior', 'lead', 'sr', 'jr',
])

/**
 * Slugify a string: lowercase, strip punctuation, collapse whitespace,
 * drop stop-words, join with single dash.
 */
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      // Strip punctuation + symbols, keep word chars (Latin + Cyrillic) and spaces.
      // NOTE: deliberately NOT using NFKD — it decomposes `й`/`ё` into combining
      // marks that then get stripped, mangling Russian words ("Йота" → "ота").
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0 && !STOP_WORDS.has(w))
      .join('-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  )
}

/**
 * Build canonical key from company + title.
 *
 * Examples:
 *   ('Mokka', 'Senior Frontend Developer') → 'mokka|senior-frontend-developer'
 *   ('ООО "Грин"', 'Java-разработчик в Москву') → 'грин|java-разработчик-москву'
 *   ('—', 'Без названия') → 'unknown|без-названия'
 */
export function canonicalKey(company: string, title: string): string {
  const c = slugify(company || 'unknown') || 'unknown'
  const t = slugify(title || 'untitled') || 'untitled'
  // Truncate each side to keep keys query-friendly
  return `${c.slice(0, 60)}|${t.slice(0, 80)}`
}

/**
 * Detect if a Telegram message text contains an hh.ru vacancy URL.
 * If yes, returns the canonical hh.ru URL — caller can lookup
 * existing user_evaluations row and set duplicate_of.
 *
 * Examples:
 *   'Senior frontend в Mokka https://hh.ru/vacancy/12345 удалёнка'
 *     → 'https://hh.ru/vacancy/12345'
 *   'плохой текст без ссылки'
 *     → null
 */
export function extractHhUrl(text: string): string | null {
  const match = text.match(/https?:\/\/(?:[a-z0-9-]+\.)?hh\.(?:ru|kz|by|uz)\/vacancy\/(\d+)/i)
  if (!match) return null
  // Normalize to https://hh.ru/vacancy/<id>
  return `https://hh.ru/vacancy/${match[1]}`
}
