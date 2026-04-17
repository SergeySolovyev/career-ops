export type PlanName = 'free' | 'pro' | 'premium'

export interface PlanConfig {
  name: PlanName
  displayName: string
  priceMonthly: number // USD cents
  evaluationsLimit: number
  features: string[]
  stripePriceId?: string // set from env at runtime
}

export const PLANS: Record<PlanName, PlanConfig> = {
  free: {
    name: 'free',
    displayName: 'Free',
    priceMonthly: 0,
    evaluationsLimit: 3,
    features: [
      '3 AI-оценки / месяц',
      'Просмотр вакансий',
      'Базовый трекер',
    ],
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    priceMonthly: 1900, // $19
    evaluationsLimit: 30,
    features: [
      '30 AI-оценок',
      'Tailored CV (PDF)',
      'Авто-отклик',
      'Email-уведомления',
      'Cover letter генерация',
    ],
  },
  premium: {
    name: 'premium',
    displayName: 'Premium',
    priceMonthly: 3900, // $39
    evaluationsLimit: 999,
    features: [
      'Безлимит оценок',
      'Interview prep + STAR',
      'Company research',
      'Telegram-бот',
      'Приоритетное сканирование',
    ],
  },
}

export function getPlanByName(name: string): PlanConfig | undefined {
  return PLANS[name as PlanName]
}

export function canEvaluate(plan: PlanName, used: number): boolean {
  return used < PLANS[plan].evaluationsLimit
}
