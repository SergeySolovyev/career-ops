import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { initPayment } from '@/lib/tinkoff-billing'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export const runtime = 'nodejs'

type CheckoutBody = {
  tier: 'pro' | 'premium'
  promo?: string  // 'BETA99' = ₽99 first month for Pro
}

// Pricing in kopecks. First month may be discounted via promo.
const PRICES = {
  pro:     { regular: 29900, promo_beta99: 9900 },
  premium: { regular: 69900, promo_beta99: 69900 },  // Premium not discounted
} as const

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await checkRateLimit(req, RATE_LIMITS.apply, user.id)  // reuse apply limit
  if (limited) return limited

  const body = (await req.json()) as CheckoutBody
  if (body.tier !== 'pro' && body.tier !== 'premium') {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const isPromo = body.promo === 'BETA99'
  const amount = isPromo ? PRICES[body.tier].promo_beta99 : PRICES[body.tier].regular

  const orderId = `${user.id.slice(0, 8)}-${Date.now()}-${randomUUID().slice(0, 8)}`
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://careerpilot-umber.vercel.app'

  try {
    const result = await initPayment({
      amount,
      orderId,
      customerKey: user.id,
      recurrent: true,  // capture card for future recurring charges
      description: `CareerPilot ${body.tier === 'pro' ? 'Pro' : 'Premium'}${isPromo ? ' (промо BETA99)' : ''}`,
      email: user.email!,
      successUrl: `${baseUrl}/billing/success?order=${orderId}`,
      failUrl: `${baseUrl}/billing/fail?order=${orderId}`,
      notificationUrl: `${baseUrl}/api/billing/webhook`,
    })

    if (!result.Success || !result.PaymentURL) {
      return NextResponse.json({ error: result.Message || 'Payment init failed', details: result.Details }, { status: 502 })
    }

    // Pre-create subscription row in 'pending' state (webhook will flip to 'active' on success)
    await supabase.from('subscriptions').upsert({
      user_id: user.id,
      tier: body.tier,
      status: 'pending',
      tinkoff_order_id: orderId,
      tinkoff_payment_id: result.PaymentId,
    }, { onConflict: 'user_id' })

    return NextResponse.json({ paymentUrl: result.PaymentURL, orderId })
  } catch (e: any) {
    console.error('[billing/checkout] error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
