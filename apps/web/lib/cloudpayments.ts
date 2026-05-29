/**
 * CloudPayments billing SDK wrapper.
 *
 * Why CloudPayments (vs ЮKassa/Tinkoff):
 *   - 2.9% all-inclusive; payouts straight to ВТБ account, no intermediate fees
 *   - Native subscription support — first payment creates a recurring schedule
 *   - Hosted payment page via /orders/create (redirect flow, no PCI scope)
 *   - Webhook auth via HMAC-SHA256 in Content-HMAC header
 *
 * Env vars required:
 *   CLOUDPAYMENTS_PUBLIC_ID — `pk_xxx...` from cabinet
 *   CLOUDPAYMENTS_API_PASSWORD — secret used both for Basic Auth and webhook HMAC
 *
 * Docs: https://developers.cloudpayments.ru/
 */

import { createHmac } from 'crypto'

const API_BASE = 'https://api.cloudpayments.ru'

function authHeader(): string {
  const id = process.env.CLOUDPAYMENTS_PUBLIC_ID
  const pw = process.env.CLOUDPAYMENTS_API_PASSWORD
  if (!id) throw new Error('CLOUDPAYMENTS_PUBLIC_ID not configured')
  if (!pw) throw new Error('CLOUDPAYMENTS_API_PASSWORD not configured')
  return 'Basic ' + Buffer.from(`${id}:${pw}`).toString('base64')
}

type CreateOrderRequest = {
  /** Amount in kopecks. We convert to rubles below (CP wants decimal RUB). */
  amountKopecks: number
  orderId: string             // your idempotency key
  customerKey: string         // user_id — bound as AccountId for AML / recurring lookups
  description: string
  email: string
  successUrl: string
  /**
   * If set — first payment also creates a monthly subscription that auto-charges
   * the given amount on the same day every month. CloudPayments handles the
   * scheduling and webhook notifications on every renewal.
   */
  subscription?: {
    /** Amount per renewal in kopecks; may differ from initial (e.g. ₽99 first → ₽299/mo) */
    renewalAmountKopecks: number
    /** Days until first renewal; e.g. 30 for monthly */
    daysUntilFirstRenewal: number
  }
}

type CloudPaymentsOrderResponse = {
  Success: boolean
  Message?: string | null
  Model?: {
    Id: string                // CP-internal order ID
    Number: number            // increment-int order number
    Amount: number            // RUB
    Currency: string
    Description: string
    Email: string
    Url: string               // hosted payment page URL — redirect customer here
    InternalId: number
    CreatedDate: string
    PaymentDate: string | null
  }
  ErrorCode?: number
}

/** kopecks → rubles number (CloudPayments expects RUB number, not string) */
function toRub(kopecks: number): number {
  return kopecks / 100
}

/**
 * Create a hosted-checkout order. Returns the URL to redirect the customer to.
 *
 * Per docs: https://developers.cloudpayments.ru/#sozdanie-scheta
 * The `Url` field in the response is the customer-facing payment page.
 */
export async function createOrder(req: CreateOrderRequest): Promise<CloudPaymentsOrderResponse> {
  const body: Record<string, unknown> = {
    Amount: toRub(req.amountKopecks),
    Currency: 'RUB',
    Description: req.description,
    Email: req.email,
    SendEmail: true,                  // CloudPayments emails the receipt link
    InvoiceId: req.orderId,           // our idempotency key (visible in dashboard)
    AccountId: req.customerKey,       // user_id — needed for token-based recurring later
    RequireConfirmation: false,       // capture immediately, no two-step hold
    JsonData: {
      // 54-ФЗ fiscal receipt — CloudPayments forwards this to whatever ОФД
      // is configured in the cabinet (АТОЛ Online / 1С-ОФД / etc.)
      cloudPayments: {
        customerReceipt: {
          Items: [
            {
              label: req.description.slice(0, 128),
              price: toRub(req.amountKopecks),
              quantity: 1.0,
              amount: toRub(req.amountKopecks),
              vat: null,             // null = без НДС (УСН)
              method: 4,             // 4 = full prepayment
              object: 4,             // 4 = service (digital)
            },
          ],
          taxationSystem: 1,        // 1 = УСН доходы (matches ИП Бирюкова)
          email: req.email,
          isBso: false,
          amounts: {
            electronic: toRub(req.amountKopecks),
            advancePayment: 0,
            credit: 0,
            provision: 0,
          },
        },
      },
    },
  }

  if (req.subscription) {
    // Embedded subscription — first payment + auto-renewal schedule.
    // CloudPayments creates subscription record on its side; emits
    // `Recurrent` webhook on every successful renewal.
    body.Subscription = {
      Interval: 'Month',
      Period: 1,
      Amount: toRub(req.subscription.renewalAmountKopecks),
      Currency: 'RUB',
      Description: req.description,
      Email: req.email,
      RequireConfirmation: false,
      StartDate: new Date(
        Date.now() + req.subscription.daysUntilFirstRenewal * 86_400_000,
      ).toISOString(),
    }
  }

  const res = await fetch(`${API_BASE}/orders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`CloudPayments /orders/create ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

/**
 * Cancel an active subscription by its CloudPayments subscription Id.
 * Returns true if the API confirms cancellation.
 *
 * Subscription Id is captured from the first successful Recurrent webhook —
 * we store it in subscriptions.provider_recurring_token.
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/subscriptions/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify({ Id: subscriptionId }),
  })
  const json = (await res.json()) as { Success?: boolean }
  return !!json?.Success
}

/**
 * Webhook signature verification.
 *
 * CloudPayments sends `Content-HMAC` header with HMAC-SHA256 of the raw
 * request body, base64-encoded. Secret = API password.
 *
 * IMPORTANT: must verify against the RAW body bytes, NOT a re-serialized
 * JSON — even whitespace differences will fail the signature.
 *
 * https://developers.cloudpayments.ru/#proverka-uvedomleniy
 */
export function verifyWebhookSignature(rawBody: string, headerHmac: string | null): boolean {
  if (!headerHmac) return false
  const pw = process.env.CLOUDPAYMENTS_API_PASSWORD
  if (!pw) return false
  const expected = createHmac('sha256', pw).update(rawBody, 'utf-8').digest('base64')
  // Constant-time compare to defeat timing attacks
  if (expected.length !== headerHmac.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ headerHmac.charCodeAt(i)
  }
  return mismatch === 0
}

/** Webhook payload shapes — CloudPayments uses x-www-form-urlencoded, not JSON. */
export type CloudPaymentsPayWebhook = {
  TransactionId: string
  Amount: string
  Currency: string
  PaymentAmount: string
  PaymentCurrency: string
  InvoiceId?: string         // our orderId from JsonData
  AccountId?: string         // our user_id
  SubscriptionId?: string    // present when subscription was created
  Email?: string
  DateTime: string
  Token?: string             // saved card token for future charges
  CardType?: string
  Status: 'Completed' | 'Cancelled' | 'Declined'
}

export type CloudPaymentsRecurrentWebhook = {
  Id: string                 // subscription Id
  AccountId: string
  Description: string
  Email: string
  Amount: string
  Currency: string
  RequireConfirmation: string
  StartDate: string
  Interval: 'Day' | 'Week' | 'Month'
  Period: string             // '1'
  Status: 'Active' | 'PastDue' | 'Cancelled' | 'Rejected' | 'Expired'
  SuccessfulTransactionsNumber: string
  FailedTransactionsNumber: string
  LastTransactionDate?: string
  NextTransactionDate?: string
}
