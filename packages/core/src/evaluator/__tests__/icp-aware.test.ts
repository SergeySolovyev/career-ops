import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiEvaluate } from '../ai-evaluate'

// Mock the Anthropic API call to capture the prompt
const mockFetch = vi.fn()
;(global as any).fetch = mockFetch

describe('aiEvaluate ICP-aware prompt', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            text: '{"score":3.5,"verdict":"maybe","summary":"...","strengths":[],"weaknesses":[]}',
          },
        ],
      }),
    })
  })

  it('junior segment includes "JUNIOR" guidance + penalizes 5+ years requirement', async () => {
    await aiEvaluate('Senior Backend', 'BigCorp', 'Требуется 5+ лет опыта Python', {
      apiKey: 'test',
      cvText: 'My CV',
      profileSummary: '',
      model: 'claude-haiku-4-5',
      icpSegment: 'junior',
      experienceYears: 1,
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.system).toContain('JUNIOR')
    expect(body.system).toContain('5+ лет')
  })

  it('middle segment is default + balanced guidance', async () => {
    await aiEvaluate('Developer', 'Co', 'desc', {
      apiKey: 'test',
      cvText: '',
      profileSummary: '',
      model: 'x',
      icpSegment: 'middle',
      experienceYears: 3,
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.system).toContain('MIDDLE')
    expect(body.system).toContain('Penalize junior-only')
  })

  it('senior segment penalizes junior roles', async () => {
    await aiEvaluate('Junior Dev', 'StartupX', 'Молодой spec', {
      apiKey: 'test',
      cvText: '',
      profileSummary: '',
      model: 'x',
      icpSegment: 'senior',
      experienceYears: 10,
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.system).toContain('SENIOR')
    expect(body.system).toContain('Penalize junior')
  })

  it('skills list included in prompt', async () => {
    await aiEvaluate('X', 'Y', 'Z', {
      apiKey: 'test',
      cvText: '',
      profileSummary: '',
      model: 'x',
      skills: ['React', 'TypeScript'],
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.system).toContain('React')
    expect(body.system).toContain('TypeScript')
  })

  it('default behavior (no icpSegment) uses middle guidance', async () => {
    await aiEvaluate('X', 'Y', 'Z', {
      apiKey: 'test',
      cvText: '',
      profileSummary: '',
      model: 'x',
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.system).toContain('MIDDLE')
  })
})
