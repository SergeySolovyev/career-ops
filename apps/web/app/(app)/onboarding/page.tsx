'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [cv, setCv] = useState('')

  // Step 2
  const [fullName, setFullName] = useState('')
  const [targetRoles, setTargetRoles] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')

  // Step 3
  const [firstMessage, setFirstMessage] = useState<string | null>(null)

  async function saveProfile(partial: Record<string, unknown>) {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || `HTTP ${res.status}`)
    }
  }

  async function handleNextStep1() {
    if (cv.trim().length < 100) {
      setError('CV слишком короткое — вставьте хотя бы 100 символов')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await saveProfile({ cv_text: cv })
      setStep(2)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleNextStep2() {
    setError(null)
    setLoading(true)
    try {
      await saveProfile({
        full_name: fullName || null,
        target_roles: targetRoles.split(',').map((s) => s.trim()).filter(Boolean),
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
      })
      setStep(3)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/first-response', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      const { message } = await res.json()
      setFirstMessage(message)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex-1">
            <div
              className={`h-2 rounded-full transition-colors ${
                step >= n ? 'bg-primary' : 'bg-secondary'
              }`}
            />
            <div className={`mt-2 text-xs ${step >= n ? 'font-semibold' : 'text-muted-foreground'}`}>
              Шаг {n} из 3
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <section>
          <h1 className="text-2xl font-bold">Давайте познакомимся 👋</h1>
          <p className="mt-2 text-muted-foreground">
            Вставьте ваше CV — AI-советник будет использовать его для персональных рекомендаций.
            Подойдёт текст, markdown, или структурированный список опыта.
          </p>
          <textarea
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            rows={14}
            placeholder="# Иван Иванов&#10;## Опыт&#10;- 2020–2026: Senior Data Scientist в Компании X&#10;  • Построил ML-модель, снижение дефолтов на 15%&#10;..."
            className="mt-4 w-full rounded-lg border border-border bg-background p-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="mt-2 text-xs text-muted-foreground">{cv.length} символов</div>
          {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleNextStep1}
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Сохраняем...' : 'Далее →'}
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 className="text-2xl font-bold">Что ищем?</h1>
          <p className="mt-2 text-muted-foreground">
            Целевые роли и зарплатные ожидания — AI будет отсеивать всё не по профилю.
          </p>
          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold">Ваше имя</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Целевые роли</span>
              <p className="mt-1 text-xs text-muted-foreground">Через запятую</p>
              <input
                type="text"
                value={targetRoles}
                onChange={(e) => setTargetRoles(e.target.value)}
                placeholder="Senior Data Scientist, ML Engineer, AI Product Manager"
                className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-semibold">Зарплата от, ₽</span>
                <input
                  type="number"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="300000"
                  className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">до, ₽</span>
                <input
                  type="number"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="800000"
                  className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            </div>
          </div>
          {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary"
            >
              ← Назад
            </button>
            <button
              onClick={handleNextStep2}
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Сохраняем...' : 'Далее →'}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1 className="text-2xl font-bold">Первый совет от AI 🎯</h1>
          <p className="mt-2 text-muted-foreground">
            AI-советник прочитает ваше CV и цели и предложит первый шаг на этой неделе.
          </p>

          {!firstMessage && !loading && (
            <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
              <div className="text-4xl">🤖</div>
              <p className="mt-3 text-sm text-muted-foreground">
                Нажмите, чтобы AI проанализировал ваш профиль и дал первую рекомендацию.
              </p>
              <button
                onClick={handleGenerate}
                className="mt-5 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Сгенерировать первый совет
              </button>
            </div>
          )}

          {loading && (
            <div className="mt-8 rounded-xl border border-border p-8 text-center">
              <div className="text-4xl animate-pulse">🧠</div>
              <p className="mt-3 text-sm text-muted-foreground">AI анализирует ваш профиль...</p>
              <p className="mt-1 text-xs text-muted-foreground">Обычно занимает 5–8 секунд</p>
            </div>
          )}

          {firstMessage && (
            <div className="mt-6 rounded-xl border border-border bg-secondary/20 p-6">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                💬 AI карьерный консультант
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{firstMessage}</div>
            </div>
          )}

          {error && <div className="mt-3 text-sm text-destructive">{error}</div>}

          {firstMessage && (
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                В кабинет →
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
