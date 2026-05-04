import { describe, expect, it } from 'vitest'
import { preScreen } from '../pre-screen'

const positive = ['frontend', 'react', 'typescript']
const negative = ['1с', 'sap', 'php']

describe('preScreen — negative keywords (hard reject)', () => {
  it('rejects vacancy with any negative keyword regardless of positives', () => {
    const r = preScreen(
      'Senior Frontend Developer',
      'Работа с PHP, MySQL и React',
      'Acme',
      positive,
      negative,
    )
    expect(r.passed).toBe(false)
    expect(r.score).toBe(0)
    expect(r.matchedNegative).toContain('php')
  })

  it('passes when no negative keywords matched', () => {
    const r = preScreen(
      'Frontend Developer',
      'React + TypeScript stack, удалёнка',
      'Acme',
      positive,
      negative,
    )
    expect(r.matchedNegative).toEqual([])
  })
})

describe('preScreen — junior ICP', () => {
  it('boosts junior vacancies', () => {
    const r = preScreen(
      'Junior Frontend в Mokka',
      'Стек: React, TS. Менторство, обучение, удалёнка из РФ.',
      'Mokka',
      positive,
      negative,
      { icp: 'junior' },
    )
    // Base: 'frontend' + 'react' + 'typescript' (text)... wait, 'TS' won't match 'typescript'.
    // 'frontend' matches in title (positive) → 1
    // 'react' matches in description → 1
    // 'TS' won't match 'typescript' (lowercase substring); test will see how many match
    // Junior bonuses:
    //   JUNIOR_BOOST_PATTERNS matches 'Junior' → +0.5
    //   GROWTH_PATTERNS matches 'обучение' or 'менторство' → +0.4
    //   REMOTE_PATTERNS matches 'удалёнка' → +0.3
    // Min expected: 2 (positive) + 0.5 + 0.4 + 0.3 = 3.2
    expect(r.passed).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(2.5)
  })

  it('penalizes senior vacancies (overqualified for junior)', () => {
    const r = preScreen(
      'Senior Frontend Developer (опыт от 5 лет)',
      'React, TypeScript expert',
      'Yandex',
      positive,
      negative,
      { icp: 'junior' },
    )
    // Base: 'frontend' (title) + 'react' (desc) + 'typescript' (desc) → 3
    // Penalties: SENIOR_PATTERNS in title? "Senior Frontend Developer" — no senior pattern matches
    //   wait, SENIOR_PATTERNS doesn't include 'senior' alone — it has director/head of/lead etc.
    //   So no -0.3 from SENIOR_PATTERNS.
    // OVERQUAL_PATTERNS matches 'senior' in title → -0.5
    // OVERQUAL_PATTERNS matches 'опыт от 5' in title → +another match? regex is OR — already counted once
    // Net: 3 - 0.5 = 2.5
    // The senior penalty makes it less attractive than its raw positive count
    expect(r.score).toBeLessThan(3) // capped by penalty
  })

  it('boosts remote vacancies for junior', () => {
    const r = preScreen(
      'Frontend Developer',
      'Стек: React. Удалёнка по РФ.',
      'Acme',
      positive,
      negative,
      { icp: 'junior' },
    )
    // 'frontend' + 'react' = 2
    // REMOTE_PATTERNS → +0.3
    // No junior pattern, no senior pattern, no growth pattern
    expect(r.score).toBeGreaterThanOrEqual(2.3)
  })
})

describe('preScreen — middle ICP (default)', () => {
  it('mild bonus for middle keywords + remote', () => {
    const r = preScreen(
      'Middle Backend Engineer',
      'Python, удалёнка из РФ',
      'Acme',
      ['python', 'backend'],
      negative,
      { icp: 'middle' },
    )
    // 'python' + 'backend' = 2
    // MIDDLE_BOOST_PATTERNS matches 'Middle' or 'engineer' in title → +0.3
    // REMOTE_PATTERNS matches 'удалёнка' → +0.2
    expect(r.score).toBeGreaterThanOrEqual(2.5)
  })

  it('mild penalty for senior in title', () => {
    const r = preScreen(
      'Head of Engineering',
      'Backend python team management',
      'Acme',
      ['python', 'backend'],
      negative,
      { icp: 'middle' },
    )
    // 'python' + 'backend' = 2
    // SENIOR_PATTERNS matches 'Head of' → -0.2
    // No middle/remote bonuses
    expect(r.score).toBeLessThan(2)
  })
})

describe('preScreen — senior ICP (Sprint 0 Director compat)', () => {
  it('boosts senior keywords (legacy behavior)', () => {
    const r = preScreen(
      'Director of Engineering',
      'Lead a team of 50 engineers',
      'Bigtech',
      ['engineering'],
      negative,
      { icp: 'senior' },
    )
    // 'engineering' = 1
    // SENIOR_PATTERNS matches 'Director' → +0.5
    expect(r.score).toBeGreaterThanOrEqual(1.5)
  })

  it('VP / Head of get the seniority boost', () => {
    const r = preScreen(
      'VP Product, FinTech',
      'Lead product strategy',
      'Bank',
      ['product'],
      [],
      { icp: 'senior' },
    )
    // 'product' = 1
    // SENIOR_PATTERNS matches 'VP ' → +0.5
    expect(r.score).toBeGreaterThanOrEqual(1.5)
  })
})

describe('preScreen — default ICP fallback', () => {
  it('uses middle ICP when no options.icp passed', () => {
    const r1 = preScreen('Middle DevOps', 'Docker, k8s', 'X', ['devops'], [])
    const r2 = preScreen('Middle DevOps', 'Docker, k8s', 'X', ['devops'], [], {
      icp: 'middle',
    })
    expect(r1.score).toBe(r2.score)
  })
})

describe('preScreen — overall threshold', () => {
  it('passed=true when score >= 2.0', () => {
    const r = preScreen(
      'Frontend Developer',
      'React + TypeScript',
      'Acme',
      ['frontend', 'react'],
      [],
      { icp: 'middle' },
    )
    // 2 positive matches → score=2 → passed=true
    expect(r.passed).toBe(true)
  })

  it('passed=false when score < 2.0', () => {
    const r = preScreen(
      'Java Backend',
      'Spring Boot, Hibernate',
      'Acme',
      ['frontend', 'react'],
      [],
      { icp: 'middle' },
    )
    // 0 positive matches, no boost → passed=false
    expect(r.passed).toBe(false)
  })
})
