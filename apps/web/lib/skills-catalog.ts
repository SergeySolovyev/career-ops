/**
 * Skills catalog — used by Sprint 2 onboarding skills-checklist
 * (alternative to CV upload for junior users without formal CV).
 *
 * Structure: 6 domains × 8-12 skills each. User checks relevant skills,
 * we synthesize a pseudo-CV string for AI evaluation.
 */

export interface SkillDomain {
  id: string
  label: string
  emoji: string
  skills: string[]
}

export const SKILLS_CATALOG: readonly SkillDomain[] = [
  {
    id: 'frontend',
    label: 'Frontend',
    emoji: '🎨',
    skills: [
      'HTML/CSS', 'JavaScript', 'TypeScript',
      'React', 'Vue', 'Next.js', 'Tailwind',
      'Webpack/Vite', 'Mobile responsive',
      'A11y (доступность)',
    ],
  },
  {
    id: 'backend',
    label: 'Backend',
    emoji: '⚙️',
    skills: [
      'Node.js', 'Python', 'Go', 'Java',
      'PostgreSQL', 'Redis', 'gRPC/REST',
      'Microservices', 'Event-driven',
      'Authentication (OAuth/JWT)',
    ],
  },
  {
    id: 'devops',
    label: 'DevOps',
    emoji: '🛠',
    skills: [
      'Docker', 'Kubernetes', 'Terraform',
      'CI/CD (GitLab/GitHub Actions)',
      'AWS', 'Cloud.ru / Yandex Cloud',
      'Observability (Grafana/Prometheus)',
      'Linux administration',
    ],
  },
  {
    id: 'data',
    label: 'Data & ML',
    emoji: '📊',
    skills: [
      'SQL', 'Python (pandas)', 'Tableau / Power BI',
      'A/B-тесты', 'Статистика',
      'ML (sklearn/PyTorch)', 'LLM / prompt engineering',
      'Airflow / dbt', 'Spark',
    ],
  },
  {
    id: 'design',
    label: 'Design / UX',
    emoji: '✏️',
    skills: [
      'Figma', 'Прототипирование',
      'Design systems', 'User research',
      'UX writing', 'Mobile-first design',
      'Анимации (After Effects/Lottie)',
      'Веб-вёрстка (HTML/CSS basics)',
    ],
  },
  {
    id: 'product',
    label: 'Product / Marketing',
    emoji: '📈',
    skills: [
      'Product discovery', 'JTBD / user interviews',
      'Аналитика (Amplitude/Mixpanel)',
      'Performance marketing (Yandex Direct)',
      'SEO', 'Email-маркетинг',
      'B2B sales / cold outreach',
      'Контент-маркетинг',
    ],
  },
] as const

/**
 * Synthesize a pseudo-CV string from selected skills + city.
 * Used as `cv_text` for AI evaluation when user picks skills checklist
 * over uploading a real CV.
 */
export function buildPseudoCV(opts: {
  selectedSkills: string[]
  city?: string | null
  remoteOk?: boolean
  experienceYears?: number
  targetRoles?: string[]
}): string {
  const { selectedSkills, city, remoteOk, experienceYears, targetRoles = [] } = opts

  // Group selected skills by domain for readable output
  const byDomain = new Map<string, string[]>()
  for (const domain of SKILLS_CATALOG) {
    const matched = domain.skills.filter((s) => selectedSkills.includes(s))
    if (matched.length > 0) {
      byDomain.set(domain.label, matched)
    }
  }

  const lines: string[] = []
  lines.push(`## Кандидат`)
  if (city) lines.push(`- Город: ${city}${remoteOk ? ' (готов к удалёнке)' : ''}`)
  if (experienceYears !== undefined) {
    lines.push(`- Опыт: ${experienceYears} ${pluralYears(experienceYears)}`)
  }
  if (targetRoles.length > 0) {
    lines.push(`- Целевые роли: ${targetRoles.join(', ')}`)
  }

  lines.push('')
  lines.push('## Скиллы')
  for (const [domain, skills] of byDomain) {
    lines.push(`### ${domain}`)
    lines.push(skills.map((s) => `- ${s}`).join('\n'))
    lines.push('')
  }

  if (byDomain.size === 0) {
    lines.push('(скиллы не выбраны)')
  }

  return lines.join('\n')
}

function pluralYears(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'год'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'года'
  return 'лет'
}

/** All skill names flattened — for validation/autocomplete. */
export const ALL_SKILLS: readonly string[] = SKILLS_CATALOG.flatMap((d) => d.skills)
