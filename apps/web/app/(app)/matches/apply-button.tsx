'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DISCLAIMER_TEXT = `⚠️ Внимание: автоматический отклик через CareerPilot

CareerPilot отправит отклик на вакансию от вашего имени, используя сохранённую сессию hh.ru. AI-сгенерированное cover letter будет отправлено в HH.

Это нарушает Условия использования hh.ru. HH может:
• заблокировать ваш аккаунт за автоматизированную активность
• отклонить ваши отклики массово
• попросить пройти капчу при следующем входе

Используя эту функцию, вы принимаете эти риски на себя.

Рекомендации:
✓ Используйте отдельный «рабочий» HH-аккаунт, не основной
✓ Не более 30 откликов в день
✓ Регулярно проверяйте «Мои отклики» в HH вручную`

export default function ApplyButton({ vacancyUrl, score }: { vacancyUrl: string; score: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function handleConfirm() {
    setError(null)
    setLoading(true)
    try {
      // 1) Record consent if not already
      const consentRes = await fetch('/api/apply-consent', { method: 'POST' })
      if (!consentRes.ok) throw new Error('Не удалось зафиксировать согласие')

      // 2) Trigger apply
      const r = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacancy_url: vacancyUrl }),
      })
      const j = await r.json()
      if (!r.ok) {
        if (j.error === 'hh_session_missing') {
          throw new Error('Сначала подключите HH-аккаунт в /onboarding')
        }
        throw new Error(j.message || j.error || `HTTP ${r.status}`)
      }

      const statusText: Record<string, string> = {
        sent: '✓ Отклик отправлен!',
        already_applied: '⚠️ Вы уже откликались на эту вакансию',
        failed: '✗ Ошибка отправки: ' + (j.error || ''),
      }
      setDone(statusText[j.status] || j.status)
      setAgreed(false)
      router.refresh()
      setTimeout(() => setOpen(false), 2500)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={score < 3}
        title={score < 3 ? 'Слишком низкий AI-скор' : 'Отправить AI-отклик'}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 shrink-0"
      >
        Откликнуться
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {!done ? (
              <>
                <h2 className="text-lg font-bold">Подтвердите авто-отклик</h2>
                <pre className="mt-4 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-secondary/40 p-4 text-xs leading-relaxed">{DISCLAIMER_TEXT}</pre>

                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Я понимаю риски и принимаю их на себя. Использую CareerPilot на свой страх и риск.
                  </span>
                </label>

                {error && <div className="mt-3 text-sm text-destructive">Ошибка: {error}</div>}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    className="rounded-lg border border-border px-5 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-40"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!agreed || loading}
                    className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                  >
                    {loading ? 'Отправка...' : 'Согласен, отправить'}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <div className="text-4xl">{done.startsWith('✓') ? '🎉' : done.startsWith('⚠️') ? '⚠️' : '❌'}</div>
                <p className="mt-3 text-base font-semibold">{done}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
