'use client'

/**
 * Settings UI section: manage user's Telegram channels for vacancy parsing.
 *
 * - Lists default + custom channels
 * - Add: validates @username format, optional live-check via /api/tg/validate
 * - Remove: confirms before deletion
 * - Status badges: active / invalid / paused / not_found
 */

import { useEffect, useState, useTransition } from 'react'
import {
  Send,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react'

interface Channel {
  id: number
  channel_username: string
  is_default: boolean
  status: 'active' | 'invalid' | 'paused' | 'not_found'
  last_parsed_at: string | null
  validation_error: string | null
}

interface ValidateResult {
  ok: boolean
  exists?: boolean
  isPublic?: boolean
  lastPostUnix?: number
  postsLast30d?: number
  error?: string
}

const inputCls =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100'

export default function TelegramChannels() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newChannel, setNewChannel] = useState('')
  const [isPending, startTransition] = useTransition()
  const [validating, setValidating] = useState<string | null>(null)
  const [validateMsg, setValidateMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/tg/channels', { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setChannels(j.channels ?? [])
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'load_failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd() {
    const username = newChannel.trim().replace(/^@/, '').toLowerCase()
    if (!username) return

    setError(null)
    setValidateMsg(null)
    try {
      const res = await fetch('/api/tg/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setNewChannel('')
      await load()
    } catch (e: any) {
      setError(e?.message ?? 'add_failed')
    }
  }

  async function handleRemove(username: string) {
    if (!confirm(`Удалить канал @${username}?`)) return
    try {
      const res = await fetch(`/api/tg/channels?u=${encodeURIComponent(username)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? `HTTP ${res.status}`)
      }
      await load()
    } catch (e: any) {
      setError(e?.message ?? 'remove_failed')
    }
  }

  async function handleValidate(username: string) {
    setValidating(username)
    setValidateMsg(null)
    try {
      const res = await fetch('/api/tg/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const j: ValidateResult = await res.json()
      if (j.ok && j.exists && j.isPublic) {
        const ago = j.lastPostUnix
          ? Math.round((Date.now() / 1000 - j.lastPostUnix) / 3600)
          : null
        setValidateMsg(
          ago !== null
            ? `@${username}: жив, последний пост ${ago}ч назад, ${j.postsLast30d ?? '?'} постов за 30 дней`
            : `@${username}: жив`,
        )
      } else {
        setValidateMsg(`@${username}: ${j.error ?? 'не найден'}`)
      }
      await load()
    } catch (e: any) {
      setValidateMsg(`@${username}: ${e?.message ?? 'ошибка проверки'}`)
    } finally {
      setValidating(null)
    }
  }

  return (
    <div>
      {/* Add new channel */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            @
          </span>
          <input
            type="text"
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                startTransition(handleAdd)
              }
            }}
            placeholder="имя_канала или @username"
            className={inputCls + ' pl-7'}
          />
        </div>
        <button
          onClick={() => startTransition(handleAdd)}
          disabled={!newChannel.trim() || isPending}
          className="btn-primary h-9 px-4 text-[12.5px] disabled:opacity-50"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Добавить
        </button>
      </div>

      {/* role=status + aria-live: screen readers announce validation/error changes */}
      <div role="status" aria-live="polite" className="contents">
        {validateMsg && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">
            {validateMsg}
          </div>
        )}
      </div>

      {/* Channel list */}
      <div className="mt-4 space-y-1.5">
        {loading && (
          <div className="flex items-center gap-2 px-2 py-3 font-mono text-[11px] uppercase tracking-wider text-slate-500">
            <Loader2 size={11} className="animate-spin" /> loading…
          </div>
        )}
        {!loading && channels.length === 0 && !error && (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-[12.5px] text-slate-500">
            Нет каналов. Добавьте первый — система автоматически добавит топ-10
            популярных IT-каналов через минуту.
          </div>
        )}
        {channels.map((ch) => (
          <div
            key={ch.id}
            className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px]"
          >
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-slate-900 text-white">
              <Send size={12} strokeWidth={2} />
            </span>
            <a
              href={`https://t.me/${ch.channel_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate font-medium text-slate-900 hover:underline"
            >
              @{ch.channel_username}
            </a>

            {ch.is_default && (
              <span className="pill bg-blue-50 text-blue-700">
                <Sparkles size={9} />
                default
              </span>
            )}

            <StatusPill ch={ch} />

            <button
              onClick={() => handleValidate(ch.channel_username)}
              disabled={validating === ch.channel_username}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              title="Проверить, что канал жив"
            >
              {validating === ch.channel_username ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                'check'
              )}
            </button>

            <button
              onClick={() => handleRemove(ch.channel_username)}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
              title="Удалить"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* role=alert: errors get higher screen-reader priority than status */}
      <div role="alert" aria-live="assertive" className="contents">
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            <AlertCircle size={13} className="mt-0.5 flex-none" />
            {error}
          </div>
        )}
      </div>

      <p className="mt-4 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
        Парсер обходит каналы каждый час · ~$0.75/мес · cap $3
      </p>
    </div>
  )
}

function StatusPill({ ch }: { ch: Channel }) {
  if (ch.status === 'active') {
    return (
      <span className="pill bg-emerald-50 text-emerald-700">
        <CheckCircle2 size={9} />
        active
      </span>
    )
  }
  if (ch.status === 'invalid' || ch.status === 'not_found') {
    return (
      <span
        className="pill bg-red-50 text-red-700"
        title={ch.validation_error ?? ''}
      >
        <AlertCircle size={9} />
        {ch.status}
      </span>
    )
  }
  return (
    <span className="pill bg-slate-50 text-slate-600">
      {ch.status}
    </span>
  )
}
