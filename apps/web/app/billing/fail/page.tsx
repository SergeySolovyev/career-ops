import Link from 'next/link'

export const metadata = {
  title: 'Платёж не прошёл · VibeOffer',
}

// Next.js 15: searchParams is async (Promise<>). Must await it.
export default async function BillingFailPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order: orderId } = await searchParams
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[640px] flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">
        Платёж не прошёл
      </h1>
      <p className="mt-3 max-w-[460px] text-[15px] text-slate-500">
        Деньги не списаны. Попробуйте другую карту или повторите попытку через несколько минут. Если проблема повторяется — напишите нам, разберёмся.
      </p>
      {orderId && (
        <div className="mt-4 font-mono text-[11px] text-slate-400">
          Заказ: {orderId}
        </div>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/#pricing" className="btn-primary h-11 px-6">
          Попробовать ещё раз
        </Link>
        <a
          href="mailto:support@vibeoffer.today"
          className="btn-secondary h-11 px-6"
        >
          Написать в поддержку
        </a>
      </div>
    </main>
  )
}
