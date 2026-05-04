/**
 * CareerPilot Telegram MTProto reader — HTTP API.
 *
 * Endpoints:
 *   GET  /health                    Liveness probe
 *   POST /tg/scan      {channels, limitPerChannel}  → fetch new messages
 *   POST /tg/validate  {username}                    → check channel exists + recency
 *
 * Auth: HMAC-SHA256 over "<X-CP-Timestamp>.<rawBody>" using TG_WORKER_SECRET.
 * Replay protection: timestamp ±60s.
 *
 * MTProto session: persistent, loaded from TG_MTPROTO_SESSION env var.
 * One reader account serves all CareerPilot users (passive read-only).
 */

import express from 'express'
import crypto from 'node:crypto'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import { Api } from 'telegram'
import pLimit from 'p-limit'

// ---------- Config ----------
const PORT = Number(process.env.PORT || 3200)
const SECRET = process.env.TG_WORKER_SECRET
const API_ID = Number(process.env.TG_MTPROTO_API_ID)
const API_HASH = process.env.TG_MTPROTO_API_HASH
const SESSION_STRING = process.env.TG_MTPROTO_SESSION
const TIMESTAMP_TOLERANCE_S = 60
const CHANNEL_CONCURRENCY = 5
const PER_CHANNEL_DELAY_MS = 200

if (!SECRET || !API_ID || !API_HASH || !SESSION_STRING) {
  console.error(
    'Missing required env vars: TG_WORKER_SECRET, TG_MTPROTO_API_ID, TG_MTPROTO_API_HASH, TG_MTPROTO_SESSION',
  )
  process.exit(1)
}

// ---------- Telegram client (singleton) ----------
const session = new StringSession(SESSION_STRING)
const client = new TelegramClient(session, API_ID, API_HASH, {
  connectionRetries: 5,
  baseLogger: { log: () => {}, info: () => {}, warn: console.warn, error: console.error },
})

await client.connect()
console.log('[tg-worker] Telegram MTProto connected')

// ---------- Helpers ----------
function verifySignature(req, rawBody) {
  const ts = req.headers['x-cp-timestamp']
  const sig = req.headers['x-cp-signature']
  if (!ts || !sig) return false

  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) return false
  const ageS = Math.abs(Math.floor(Date.now() / 1000) - tsNum)
  if (ageS > TIMESTAMP_TOLERANCE_S) return false

  try {
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${ts}.${rawBody}`)
      .digest('hex')

    // Constant-time compare; both must be same length & valid Buffers
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(String(sig), 'hex')
    if (a.length === 0 || a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function plainText(message) {
  // gramjs Message has .text — already without entities
  return (message?.message ?? '').toString().slice(0, 8000)
}

async function fetchChannelHistory(username, sinceMessageId, limit) {
  let entity
  try {
    entity = await client.getEntity(`@${username}`)
  } catch (e) {
    const msg = String(e?.errorMessage ?? e?.message ?? '')
    if (/USERNAME_NOT_OCCUPIED|USERNAME_INVALID/.test(msg)) {
      return { status: 'not_found', error: msg, messages: [] }
    }
    return { status: 'invalid', error: msg, messages: [] }
  }

  // gramjs accepts: { peer, limit, minId } — minId returns messages with id > minId
  let messages
  try {
    // Worker hard cap matches app cap (MAX_MESSAGES_PER_CHANNEL=30) to avoid drift
    const result = await client.getMessages(entity, {
      limit: Math.min(Math.max(limit ?? 30, 1), 30),
      minId: sinceMessageId ?? 0,
    })
    messages = result
  } catch (e) {
    const msg = String(e?.errorMessage ?? e?.message ?? '')
    if (msg.startsWith('FLOOD_WAIT')) {
      return { status: 'flood_wait', error: msg, messages: [] }
    }
    return { status: 'error', error: msg, messages: [] }
  }

  const out = []
  let lastMessageId = sinceMessageId ?? 0
  for (const m of messages) {
    const text = plainText(m)
    if (!text) continue
    out.push({
      messageId: m.id,
      text,
      date: m.date,
      url: `https://t.me/${username}/${m.id}`,
    })
    if (m.id > lastMessageId) lastMessageId = m.id
  }
  // gramjs returns in descending order — reverse so caller gets chronological
  out.reverse()
  return { status: 'ok', messages: out, lastMessageId }
}

async function validateChannel(username) {
  let entity
  try {
    entity = await client.getEntity(`@${username}`)
  } catch (e) {
    const msg = String(e?.errorMessage ?? e?.message ?? '')
    if (/USERNAME_NOT_OCCUPIED|USERNAME_INVALID/.test(msg)) {
      return { username, exists: false, isPublic: false, error: 'not_found' }
    }
    return { username, exists: false, isPublic: false, error: msg }
  }
  // Public channel/megagroup detection
  const isPublic = !!entity?.username
  // Pull last 30 messages to estimate posts/30d
  const messages = await client.getMessages(entity, { limit: 30 })
  const now = Math.floor(Date.now() / 1000)
  const lastPostUnix = messages[0]?.date
  const cutoff30d = now - 30 * 86400
  const postsLast30d = messages.filter((m) => m.date >= cutoff30d).length
  return {
    username,
    exists: true,
    isPublic,
    lastPostUnix,
    postsLast30d,
  }
}

// ---------- Express app ----------
const app = express()
app.use(
  express.json({
    limit: '512kb',
    verify: (req, _res, buf) => {
      // store raw body for HMAC verification
      req.rawBody = buf.toString('utf8')
    },
  }),
)

app.get('/health', (req, res) => {
  res.json({ ok: client.connected, ts: Date.now() })
})

app.post('/tg/scan', async (req, res) => {
  if (!verifySignature(req, req.rawBody ?? '')) {
    return res.status(401).json({ error: 'bad_signature' })
  }
  const { channels = [], limitPerChannel = 30 } = req.body ?? {}
  if (!Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({ error: 'no_channels' })
  }

  const limit = pLimit(CHANNEL_CONCURRENCY)
  const tasks = channels.map((ch, i) =>
    limit(async () => {
      // small stagger to avoid bursting
      if (i > 0) await new Promise((r) => setTimeout(r, PER_CHANNEL_DELAY_MS))
      const username = String(ch.username ?? '').toLowerCase().replace(/^@/, '')
      const sinceMessageId = Number(ch.sinceMessageId ?? 0) || 0
      const r = await fetchChannelHistory(username, sinceMessageId, limitPerChannel)
      return { username, ...r }
    }),
  )

  const results = await Promise.all(tasks)
  res.json({ channels: results })
})

app.post('/tg/validate', async (req, res) => {
  if (!verifySignature(req, req.rawBody ?? '')) {
    return res.status(401).json({ error: 'bad_signature' })
  }
  const username = String(req.body?.username ?? '').toLowerCase().replace(/^@/, '')
  if (!username) return res.status(400).json({ error: 'no_username' })

  try {
    const result = await validateChannel(username)
    res.json(result)
  } catch (e) {
    res.status(500).json({
      username,
      exists: false,
      isPublic: false,
      error: e?.message ?? 'unknown',
    })
  }
})

app.listen(PORT, () => {
  console.log(`[tg-worker] HTTP listening on :${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[tg-worker] SIGTERM, disconnecting Telegram')
  await client.disconnect()
  process.exit(0)
})
