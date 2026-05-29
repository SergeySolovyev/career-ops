import { NextResponse } from 'next/server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import {
  verifyWebhookSignature,
  type CloudPaymentsPayWebhook,
  type CloudPaymentsRecurrentWebhook,
} from '@/lib/cloudpayments'

export const runtime = 'nodejs'

/**
 * CloudPayments unified webhook endpoint.
 *
 * Configure ALL hooks in CloudPayments cabinet → "Уведомления" to point here:
 *   Pay        — first payment OR recurring renewal succeeded
 *   Fail       — payment declined
 *   Refund     — payment refunded
 *   Cancel     — auth cancelled (3DS abandoned)
 *   Recurrent  — subscription state change (Active/PastDue/Cancelled)
 *
 * Each hook arrives as x-www-form-urlencoded POST with:
 *   - HMAC of raw body in `Content-HMAC` header
 *   - Different field sets per hook type — we discriminate by query param `kind`
 *     OR by field presence (Token = payment hook, Status = recurrent hook)
 *
 * We use field presence (simpler — no need to register 5 distinct URLs in cabinet).
 */
export async function POST(req: Request) {
  // 1) HMAC check on raw body — must read text() BEFORE parsing
  const rawBody = await req.text()
  const hmacHeader = req.headers.get('content-hmac')
  if (!verifyWebhookSignature(rawBody, hmacHeader)) {
    console.warn('[billing/webhook] HMAC mismatch — possible spoofing')
    return new NextResponse('{"code":13}', { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  if (!isAdminConfigured()) {
    console.error('[billing/webhook] admin client not configured')
    // Return success code so CP doesn't retry — fixing missing key is a manual op
    return NextResponse.json({ code: 0 })
  }

  // 2) Parse form-encoded body into a flat object
  const params = new URLSearchParams(rawBody)
  const data: Record<string, string> = {}
  for (const [k, v] of params.entries()) data[k] = v

  const admin = createAdminClient()

  // 3) Dispatch by hook shape
  //    Recurrent hook has `Interval` field (Day/Week/Month). Pay/Fail/Refund don't.
  if (data.Interval && data.Status) {
    return handleRecurrentHook(data as unknown as CloudPaymentsRecurrentWebhook, admin)
  }
  return handlePayHook(data as unknown as CloudPaymentsPayWebhook, admin)
}

async function handlePayHook(
  data: CloudPaymentsPayWebhook,
  admin: ReturnType<typeof createAdminClient>,
) {
  const orderId = data.InvoiceId
  if (!orderId) {
    console.warn('[billing/webhook/pay] missing InvoiceId, skipping')
    return NextResponse.json({ code: 0 })
  }

  // Map CP payment status → our subscription status
  let newStatus: 'active' | 'past_due' | 'canceled' | null = null
  if (data.Status === 'Completed') newStatus = 'active'
  else if (data.Status === 'Declined') newStatus = 'past_due'
  else if (data.Status === 'Cancelled') newStatus = 'canceled'

  if (!newStatus) return NextResponse.json({ code: 0 })

  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  // SubscriptionId arrives only when Subscription= was set in /orders/create.
  // Capture once — used for cancel API + manual lookups.
  if (newStatus === 'active' && data.SubscriptionId) {
    updates.provider_recurring_token = data.SubscriptionId
  }

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

  const { error } = await admin
    .from('subscriptions')
    .update(updates)
    .eq('provider_order_id', orderId)

  if (error) {
    console.error('[billing/webhook/pay] DB update error', error)
    // code 1 = "try again later" for CP — they'll retry
    return NextResponse.json({ code: 1 })
  }
  return NextResponse.json({ code: 0 })
}

async function handleRecurrentHook(
  data: CloudPaymentsRecurrentWebhook,
  admin: ReturnType<typeof createAdminClient>,
) {
  // Recurrent webhook fires when subscription state changes (renewal, fail, cancel).
  // Find the subscription row by provider_recurring_token (= CP subscription Id).
  const subscriptionId = data.Id
  if (!subscriptionId) return NextResponse.json({ code: 0 })

  let newStatus: 'active' | 'past_due' | 'canceled' | null = null
  if (data.Status === 'Active') newStatus = 'active'
  else if (data.Status === 'PastDue' || data.Status === 'Rejected') newStatus = 'past_due'
  else if (data.Status === 'Cancelled' || data.Status === 'Expired') newStatus = 'canceled'

  if (!newStatus) return NextResponse.json({ code: 0 })

  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  // On successful renewal — bump the period forward 1 month from LastTransactionDate
  if (newStatus === 'active' && data.LastTransactionDate) {
    const last = new Date(data.LastTransactionDate)
    updates.current_period_start = last.toISOString()
    const next = new Date(last)
    next.setMonth(next.getMonth() + 1)
    updates.current_period_end = next.toISOString()
  }
  if (newStatus === 'canceled') {
    updates.canceled_at = new Date().toISOString()
  }

  const { error } = await admin
    .from('subscriptions')
    .update(updates)
    .eq('provider_recurring_token', subscriptionId)

  if (error) {
    console.error('[billing/webhook/recurrent] DB error', error)
    return NextResponse.json({ code: 1 })
  }
  return NextResponse.json({ code: 0 })
}
