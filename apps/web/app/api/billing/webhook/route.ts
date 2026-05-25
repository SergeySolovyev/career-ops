import { NextResponse } from 'next/server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/tinkoff-billing'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await req.json()

  if (!verifyWebhookSignature(payload)) {
    console.warn('[billing/webhook] signature mismatch — possible spoofing')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdminConfigured()) {
    console.error('[billing/webhook] admin client not configured — cannot update subscription')
    return NextResponse.json({ ok: true })  // ack to Tinkoff anyway; retry won't help
  }

  const admin = createAdminClient()
  const orderId = payload.OrderId as string
  const status = payload.Status as string
  const rebillId = payload.RebillId as string | undefined

  // Map Tinkoff status → our subscription status
  // Tinkoff statuses we care about:
  //   AUTHORIZED — card captured, money on hold
  //   CONFIRMED  — money captured (final success)
  //   REJECTED   — card declined
  //   REFUNDED   — money returned
  //   3DS_CHECKING — still in 3D Secure flow (ignore)

  let newStatus: 'active' | 'past_due' | 'canceled' | 'pending' = 'pending'
  if (status === 'CONFIRMED' || status === 'AUTHORIZED') newStatus = 'active'
  else if (status === 'REJECTED') newStatus = 'past_due'
  else if (status === 'REFUNDED') newStatus = 'canceled'

  // Update subscription row by order_id
  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (rebillId) updates.tinkoff_rebill_id = rebillId
  if (newStatus === 'active') {
    const now = new Date()
    updates.current_period_start = now.toISOString()
    const next = new Date(now)
    next.setMonth(next.getMonth() + 1)
    updates.current_period_end = next.toISOString()
  }
  if (newStatus === 'canceled') {
    updates.canceled_at = new Date().toISOString()
  }

  const { error } = await admin.from('subscriptions')
    .update(updates)
    .eq('tinkoff_order_id', orderId)

  if (error) console.error('[billing/webhook] DB update error', error)

  return NextResponse.json({ ok: true })
}
