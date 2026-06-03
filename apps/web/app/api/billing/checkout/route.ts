import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { createOrder } from '@/lib/cloudpayments'
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

  const limited = await checkRateLimit(req, RATE_LIMITS.apply, user.id)
  if (limited) return limited

  const body = (await req.json()) as CheckoutBody
  if (body.tier !== 'pro' && body.tier !== 'premium') {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const isPromo = body.promo === 'BETA99'
  const amountKopecks = isPromo ? PRICES[body.tier].promo_beta99 : PRICES[body.tier].regular

  // OrderId format: <userId-prefix>-<unix-ms>-<rand>
  const orderId = `${user.id.slice(0, 8)}-${Date.now()}-${randomUUID().slice(0, 8)}`
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vibeoffer.today'

  const tierLabel = body.tier === 'pro' ? 'Pro' : 'Premium'
  const description = `VibeOffer ${tierLabel}${isPromo ? ' (промо BETA99)' : ''}`

  // Subscription auto-renewal: starts at regular price (not promo) after 30 days.
  // CloudPayments handles the schedule + emits Recurrent webhook on each charge.
  const renewalAmountKopecks = PRICES[body.tier].regular

  try {
    const result = await createOrder({
      amountKopecks,
      orderId,
      customerKey: user.id,
      description,
      email: user.email!,
      successUrl: `${baseUrl}/billing/success?order=${orderId}`,
      subscription: {
        renewalAmountKopecks,
        daysUntilFirstRenewal: 30,
      },
    })

    if (!result.Success || !result.Model?.Url) {
      return NextResponse.json(
        { error: result.Message || 'Payment init failed', code: result.ErrorCode },
        { status: 502 },
      )
    }

    // Pre-create subscription row in 'pending' state.
    // Webhook handler flips to 'active' on Pay event + captures
    // SubscriptionId (provider_recurring_token) on Recurrent registration.
    await supabase.from('subscriptions').upsert({
      user_id: user.id,
      tier: body.tier,
      status: 'pending',
      provider: 'cloudpayments',
      provider_order_id: orderId,
      provider_payment_id: result.Model.Id,
    }, { onConflict: 'user_id' })

    return NextResponse.json({
      paymentUrl: result.Model.Url,
      orderId,
      cpOrderId: result.Model.Id,
    })
  } catch (e: any) {
    console.error('[billing/checkout] error', e?.message ?? e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
