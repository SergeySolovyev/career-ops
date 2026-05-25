/**
 * Tinkoff Касса billing SDK wrapper.
 * Handles request signing, Init, Charge (recurring), webhook signature verification.
 *
 * Env vars required (set in Vercel):
 *   TINKOFF_TERMINAL_KEY — terminal ID from Tinkoff dashboard
 *   TINKOFF_PASSWORD — secret password for HMAC signing
 *   TINKOFF_API_BASE — defaults to https://securepay.tinkoff.ru/v2 (test: https://rest-api-test.tinkoff.ru/v2)
 */

import { createHash } from 'crypto'

const API_BASE = process.env.TINKOFF_API_BASE || 'https://securepay.tinkoff.ru/v2'

export type TinkoffInitRequest = {
  amount: number  // kopecks
  orderId: string
  customerKey: string
  recurrent?: boolean
  description?: string
  email: string
  successUrl?: string
  failUrl?: string
  notificationUrl?: string  // webhook URL
}

export type TinkoffInitResponse = {
  Success: boolean
  ErrorCode: string
  TerminalKey: string
  Status: string
  PaymentId: string
  OrderId: string
  Amount: number
  PaymentURL?: string
  Message?: string
  Details?: string
}

export type TinkoffChargeRequest = {
  amount: number  // kopecks
  orderId: string
  rebillId: string
  customerKey: string
  description?: string
  email: string
}

/**
 * Sign Tinkoff request — they use a specific algorithm:
 *   1. Take all top-level fields from the request body (exclude DATA, Receipt, Token, Shops, Items, Routes)
 *   2. Add { TerminalKey, Password } to the set
 *   3. Sort by key alphabetically
 *   4. Concat all VALUES (no separator, no keys)
 *   5. SHA256 the result, lowercase hex
 *
 * Returns the Token to add to the request body.
 */
export function signTinkoffRequest(payload: Record<string, unknown>): string {
  const password = process.env.TINKOFF_PASSWORD
  if (!password) throw new Error('TINKOFF_PASSWORD not configured')

  const EXCLUDE = new Set(['DATA', 'Receipt', 'Token', 'Shops', 'Items', 'Routes'])
  const fields: Record<string, unknown> = { ...payload, Password: password }
  const ordered: string[] = []
  for (const key of Object.keys(fields).sort()) {
    if (EXCLUDE.has(key)) continue
    const v = fields[key]
    if (v === undefined || v === null) continue
    if (typeof v === 'object') continue  // skip nested
    ordered.push(String(v))
  }
  const concat = ordered.join('')
  return createHash('sha256').update(concat, 'utf-8').digest('hex')
}

export async function initPayment(req: TinkoffInitRequest): Promise<TinkoffInitResponse> {
  const terminalKey = process.env.TINKOFF_TERMINAL_KEY
  if (!terminalKey) throw new Error('TINKOFF_TERMINAL_KEY not configured')

  // Minimal receipt for ФЗ-54 fiscal compliance
  const receipt = {
    Email: req.email,
    Taxation: 'usn_income',  // УСН (доходы) — typical ИП. Adjust if user is general taxation.
    Items: [
      {
        Name: req.description || 'CareerPilot подписка',
        Price: req.amount,
        Quantity: 1,
        Amount: req.amount,
        Tax: 'none',  // ИП на УСН без НДС
        PaymentMethod: 'full_prepayment',
        PaymentObject: 'service',
      },
    ],
  }

  const body: Record<string, unknown> = {
    TerminalKey: terminalKey,
    Amount: req.amount,
    OrderId: req.orderId,
    CustomerKey: req.customerKey,
    Description: req.description,
    NotificationURL: req.notificationUrl,
    SuccessURL: req.successUrl,
    FailURL: req.failUrl,
    Receipt: receipt,
  }
  if (req.recurrent) body.Recurrent = 'Y'

  body.Token = signTinkoffRequest(body)

  const res = await fetch(`${API_BASE}/Init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

/**
 * Charge a saved card via RebillId (recurring monthly).
 * Two-step: first call /Init with the new OrderId (no Recurrent flag),
 * then call /Charge with the returned PaymentId + RebillId.
 */
export async function chargeRecurring(req: TinkoffChargeRequest): Promise<TinkoffInitResponse> {
  const terminalKey = process.env.TINKOFF_TERMINAL_KEY
  if (!terminalKey) throw new Error('TINKOFF_TERMINAL_KEY not configured')

  const receipt = {
    Email: req.email,
    Taxation: 'usn_income',
    Items: [
      {
        Name: req.description || 'CareerPilot подписка (продление)',
        Price: req.amount,
        Quantity: 1,
        Amount: req.amount,
        Tax: 'none',
        PaymentMethod: 'full_prepayment',
        PaymentObject: 'service',
      },
    ],
  }

  // Step 1: Init payment (no Recurrent flag for charge)
  const initBody: Record<string, unknown> = {
    TerminalKey: terminalKey,
    Amount: req.amount,
    OrderId: req.orderId,
    CustomerKey: req.customerKey,
    Description: req.description,
    Receipt: receipt,
  }
  initBody.Token = signTinkoffRequest(initBody)

  const initRes = await fetch(`${API_BASE}/Init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initBody),
  })
  const initJson = (await initRes.json()) as TinkoffInitResponse
  if (!initJson.Success || !initJson.PaymentId) return initJson

  // Step 2: Charge via RebillId
  const chargeBody: Record<string, unknown> = {
    TerminalKey: terminalKey,
    PaymentId: initJson.PaymentId,
    RebillId: req.rebillId,
  }
  chargeBody.Token = signTinkoffRequest(chargeBody)

  const chargeRes = await fetch(`${API_BASE}/Charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chargeBody),
  })
  return chargeRes.json()
}

/**
 * Verify webhook signature. Tinkoff signs the notification with the same
 * algorithm: all top-level scalar fields + Password, sorted, concat values, SHA256.
 *
 * Tinkoff webhook quirk: boolean fields arrive as "true"/"false" strings already;
 * if any arrive as native booleans they MUST be stringified for the signature
 * to match (true → "true", not "1").
 */
export function verifyWebhookSignature(payload: Record<string, unknown>): boolean {
  const { Token, ...rest } = payload
  if (!Token || typeof Token !== 'string') return false
  // Normalise booleans to lowercase string (Tinkoff convention)
  const normalised: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rest)) {
    normalised[k] = typeof v === 'boolean' ? String(v) : v
  }
  const expected = signTinkoffRequest(normalised)
  return Token.toLowerCase() === expected.toLowerCase()
}
