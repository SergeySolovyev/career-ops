import * as Sentry from '@sentry/nextjs'

const PII_KEYS = [
  'email',
  'phone',
  'telegram',
  'full_name',
  'first_name',
  'password',
  'cv_text',
  'api_key',
  'token',
]

function redactObjectPii(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj
  const out: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {}
  for (const k in obj as Record<string, unknown>) {
    const v = (obj as Record<string, unknown>)[k]
    if (PII_KEYS.some((pii) => k.toLowerCase().includes(pii))) {
      ;(out as Record<string, unknown>)[k] = '[REDACTED]'
    } else if (v && typeof v === 'object') {
      ;(out as Record<string, unknown>)[k] = redactObjectPii(v)
    } else {
      ;(out as Record<string, unknown>)[k] = v
    }
  }
  return out
}

function redactPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.user) {
    delete event.user.email
    delete event.user.ip_address
  }
  if (event.request?.data) {
    event.request.data = redactObjectPii(event.request.data)
  }
  if (event.extra) {
    event.extra = redactObjectPii(event.extra) as Record<string, unknown>
  }
  return event
}

// Edge runtime has limited features — no replays, no Node-only integrations.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend(event) {
    return redactPii(event)
  },
  beforeBreadcrumb(crumb) {
    if (crumb.data) crumb.data = redactObjectPii(crumb.data) as Record<string, unknown>
    return crumb
  },
})
