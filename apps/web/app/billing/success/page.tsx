import Link from 'next/link'

export const metadata = {
  title: 'Подписка активирована · VibeOffer',
}

// Next.js 15: searchParams is async (Promise<>). Must await it.
export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order: orderId } = await searchParams
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[640px] flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">
        Спасибо! Подписка активирована.
      </h1>
      <p className="mt-3 max-w-[440px] text-[15px] text-slate-500">
        Чек об оплате придёт на вашу почту. Подписка продлевается автоматически — отменить можно в личном кабинете в один клик.
      </p>
      {orderId && (
        <div className="mt-4 font-mono text-[11px] text-slate-400">
          Заказ: {orderId}
        </div>
      )}
      <Link
        href="/dashboard"
        className="btn-primary mt-8 h-11 px-6"
      >
        Перейти в кабинет
      </Link>
    </main>
  )
}
