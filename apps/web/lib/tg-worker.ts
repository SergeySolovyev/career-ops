/**
 * Typed fetch wrapper for the Telegram MTProto worker.
 *
 * The worker runs on a DigitalOcean droplet (same one as Browserless).
 * It exposes 2 endpoints:
 *   POST /tg/scan    — fetch new messages from a list of channels
 *   POST /tg/validate — check if a channel exists + recent activity
 *
 * Authentication: HMAC-SHA256 signature over the request body using
 * WORKER_SHARED_SECRET (env var present in both Vercel and the droplet).
 * Replay protection: timestamp header within ±60s.
 */

import { createHmac } from 'node:crypto'

const WORKER_BASE_URL = process.env.WORKER_BASE_URL
const WORKER_SHARED_SECRET = process.env.WORKER_SHARED_SECRET

export interface ScanRequest {
  channels: {
    username: string                 // without @
    sinceMessageId?: number          // for incremental polling
  }[]
  /** Soft cap on messages per channel; default 50 */
  limitPerChannel?: number
}

export interface ScanResponse {
  channels: {
    username: string
    status: 'ok' | 'invalid' | 'not_found' | 'flood_wait' | 'error'
    error?: string
    lastMessageId?: number
    messages: {
      messageId: number
      text: string
      date: number              // unix seconds
      url: string               // t.me/<channel>/<id>
    }[]
  }[]
}

export interface ValidateRequest {
  username: string
}

export interface ValidateResponse {
  username: string
  exists: boolean
  isPublic: boolean
  lastPostUnix?: number
  postsLast30d?: number
  error?: string
}

interface WorkerError extends Error {
  status?: number
  body?: string
}

function ensureConfigured() {
  if (!WORKER_BASE_URL) {
    throw new Error('WORKER_BASE_URL env var not set')
  }
  if (!WORKER_SHARED_SECRET) {
    throw new Error('WORKER_SHARED_SECRET env var not set')
  }
}

function signRequest(body: string, ts: string): string {
  return createHmac('sha256', WORKER_SHARED_SECRET!)
    .update(`${ts}.${body}`)
    .digest('hex')
}

async function postJson<T>(path: string, payload: unknown, timeoutMs: number): Promise<T> {
  ensureConfigured()
  const body = JSON.stringify(payload)
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = signRequest(body, ts)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    const res = await fetch(`${WORKER_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CP-Timestamp': ts,
        'X-CP-Signature': sig,
      },
      body,
      signal: ctrl.signal,
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      const err = new Error(
        `Worker ${path} ${res.status}: ${errBody.slice(0, 300)}`,
      ) as WorkerError
      err.status = res.status
      err.body = errBody
      throw err
    }

    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

export function tgWorkerScan(req: ScanRequest): Promise<ScanResponse> {
  // Long timeout: scanning 10 channels × 50 messages can take ~30s
  return postJson<ScanResponse>('/tg/scan', req, 90_000)
}

export function tgWorkerValidate(req: ValidateRequest): Promise<ValidateResponse> {
  return postJson<ValidateResponse>('/tg/validate', req, 15_000)
}

/** Health check — used by /api/tg/scan-all to short-circuit on dead worker. */
export async function tgWorkerHealth(): Promise<{ ok: boolean; error?: string }> {
  if (!WORKER_BASE_URL) return { ok: false, error: 'not_configured' }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5_000)
    const res = await fetch(`${WORKER_BASE_URL}/health`, { signal: ctrl.signal })
    clearTimeout(timer)
    return { ok: res.ok }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}
