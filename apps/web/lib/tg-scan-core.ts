/**
 * Core Telegram scan pipeline — reused by both /api/tg/scan-now (user-context)
 * and /api/tg/scan-all (cron, service_role context).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { tgWorkerScan } from './tg-worker'
import {
  classifyBatch,
  extractVacancy,
  canonicalKey,
  extractHhUrl,
  aiEvaluate,
  type TgMessage,
} from '@careerpilot/core'

export const MAX_CHANNELS_PER_RUN = 10
export const MAX_MESSAGES_PER_CHANNEL = 30
export const MAX_SONNET_EXTRACTS = 15
export const MONTHLY_COST_CAP_USD = 3.0

const HAIKU_PRICE_INPUT = 0.80 / 1_000_000
const HAIKU_PRICE_OUTPUT = 4.00 / 1_000_000
const SONNET_PRICE_INPUT = 3.00 / 1_000_000
const SONNET_PRICE_OUTPUT = 15.00 / 1_000_000

// Estimated worst-case Sonnet extract cost (used for mid-loop cost guard).
// Assumes ~3000 in / 600 out tokens per extract.
const EST_PER_EXTRACT_USD = 3000 * SONNET_PRICE_INPUT + 600 * SONNET_PRICE_OUTPUT

// Dedup window — only check duplicates against rows from last N days.
const DEDUP_WINDOW_DAYS = 90

export interface ScanReport {
  channelsScanned: number
  messagesFetched: number
  messagesClassified: number
  vacanciesExtracted: number
  newRows: number
  duplicates: number
  costUsd: number
  errors: string[]
  blockedByQuota?: boolean
  monthSpend?: number
}

export function emptyReport(): ScanReport {
  return {
    channelsScanned: 0,
    messagesFetched: 0,
    messagesClassified: 0,
    vacanciesExtracted: 0,
    newRows: 0,
    duplicates: 0,
    costUsd: 0,
    errors: [],
  }
}

interface RunScanOpts {
  userId: string
  apiKey: string
  /** When true (cron path), validates that user_id exists in auth.users. */
  validateUser?: boolean
}

interface ProfileRow {
  cv_text: string | null
  target_roles: string[] | null
  positive_keywords: string[] | null
  salary_target_min?: number | null
  salary_target_max?: number | null
}

interface EvalKeyRow {
  url: string
  canonical_key: string | null
  source: string | null
}

/**
 * Build a compact profile summary string — same shape as HH path uses for aiEvaluate().
 * This keeps cross-source scoring consistent.
 */
function buildProfileSummary(profile: ProfileRow): string {
  const parts: string[] = []
  if (profile.target_roles?.length) {
    parts.push(`Целевые роли: ${profile.target_roles.slice(0, 5).join(', ')}`)
  }
  if (profile.salary_target_min || profile.salary_target_max) {
    parts.push(
      `Зарплата: ${profile.salary_target_min ?? '?'}–${profile.salary_target_max ?? '?'} ₽`,
    )
  }
  if (profile.positive_keywords?.length) {
    parts.push(`Ключевые слова: ${profile.positive_keywords.slice(0, 10).join(', ')}`)
  }
  return parts.join(' · ')
}

export async function runScanForUser(
  supabase: SupabaseClient,
  opts: RunScanOpts,
): Promise<ScanReport> {
  const { userId, apiKey, validateUser } = opts

  // ---- Validate user exists (cron path safety) ----
  if (validateUser) {
    const { data: u } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (!u) {
      const r = emptyReport()
      r.errors.push('user_not_found')
      return r
    }
  }

  // ---- Cost guard (initial check) ----
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  const { data: spendRows } = await supabase
    .from('tg_scan_log')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('ran_at', since)

  const monthSpend = (spendRows ?? []).reduce(
    (s: number, r: any) => s + Number(r.cost_usd || 0),
    0,
  )
  if (monthSpend >= MONTHLY_COST_CAP_USD) {
    const r = emptyReport()
    r.blockedByQuota = true
    r.monthSpend = monthSpend
    return r
  }
  // Remaining budget for this run
  const remainingBudget = MONTHLY_COST_CAP_USD - monthSpend

  // ---- Load channels ----
  const { data: channels, error: chErr } = await supabase
    .from('tg_channels')
    .select('id, channel_username, last_message_id, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_parsed_at', { ascending: true, nullsFirst: true })
    .limit(MAX_CHANNELS_PER_RUN)
  if (chErr) throw chErr
  if (!channels || channels.length === 0) {
    return emptyReport()
  }

  // ---- Load profile ----
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('cv_text, target_roles, positive_keywords, salary_target_min, salary_target_max')
    .eq('user_id', userId)
    .maybeSingle()
  if (!profile?.cv_text) {
    const r = emptyReport()
    r.errors.push('no_cv')
    return r
  }
  const profileTyped = profile as ProfileRow

  const candidateSummary = String(profile.cv_text).slice(0, 1500)
  const candidateKeywords: string[] = [
    ...((profile.target_roles ?? []) as string[]),
    ...((profile.positive_keywords ?? []) as string[]),
  ]
  const profileSummary = buildProfileSummary(profileTyped)

  // ---- Fetch from worker ----
  const scanRes = await tgWorkerScan({
    channels: channels.map((c: any) => ({
      username: c.channel_username,
      sinceMessageId: c.last_message_id ?? undefined,
    })),
    limitPerChannel: MAX_MESSAGES_PER_CHANNEL,
  })

  const report = emptyReport()
  report.channelsScanned = scanRes.channels.length

  const allMessages: TgMessage[] = []
  for (const ch of scanRes.channels) {
    if (ch.status !== 'ok') {
      report.errors.push(
        `${ch.username}: ${ch.status}${ch.error ? ` (${ch.error})` : ''}`,
      )
      // Mark only on hard failures, preserve cursor
      const update: Record<string, unknown> = {
        validation_error: ch.error ?? null,
        last_parsed_at: new Date().toISOString(),
      }
      if (ch.status === 'invalid' || ch.status === 'not_found') {
        update.status = ch.status
      }
      await supabase
        .from('tg_channels')
        .update(update)
        .eq('user_id', userId)
        .eq('channel_username', ch.username)
      continue
    }
    for (const m of ch.messages) {
      allMessages.push({
        messageId: m.messageId,
        channelUsername: ch.username,
        text: m.text,
        date: m.date,
        url: m.url,
      })
    }
  }
  report.messagesFetched = allMessages.length

  // Helper: update channel cursor without nullifying last_message_id
  async function updateChannelCursor(
    username: string,
    lastMessageId: number | undefined,
  ) {
    const update: Record<string, unknown> = {
      last_parsed_at: new Date().toISOString(),
      status: 'active',
      validation_error: null,
    }
    // Only persist if defined and > 0 (preserves NULL for "never fetched")
    if (lastMessageId !== undefined && lastMessageId > 0) {
      update.last_message_id = lastMessageId
    }
    await supabase
      .from('tg_channels')
      .update(update)
      .eq('user_id', userId)
      .eq('channel_username', username)
  }

  if (allMessages.length === 0) {
    for (const ch of scanRes.channels) {
      if (ch.status === 'ok') {
        await updateChannelCursor(ch.username, ch.lastMessageId)
      }
    }
    return report
  }

  // ---- Pass-1 classify (Haiku, batched) ----
  const classifyOut = await classifyBatch(allMessages, {
    apiKey,
    candidateSummary,
    candidateKeywords,
    model: process.env.ANTHROPIC_HAIKU_MODEL,
  })
  report.messagesClassified = classifyOut.results.length
  const haikuIn = classifyOut.usage.inputTokens
  const haikuOut = classifyOut.usage.outputTokens

  // ---- Lookup existing keys for dedup (90-day window only) ----
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_DAYS * 86400_000).toISOString()
  const { data: existingKeys } = await supabase
    .from('user_evaluations')
    .select('url, canonical_key, source')
    .eq('user_id', userId)
    .gte('evaluated_at', dedupSince)
  const existingRows: EvalKeyRow[] = (existingKeys as any[]) ?? []
  const keyToExisting = new Map<string, { url: string; source: string }>()
  const existingUrls = new Set<string>()
  for (const r of existingRows) {
    existingUrls.add(r.url)
    if (r.canonical_key) {
      keyToExisting.set(r.canonical_key, {
        url: r.url,
        source: r.source ?? 'unknown',
      })
    }
  }

  // ---- Pass-2 extract — top candidates by roleMatch DESC ----
  const sortedCandidates = classifyOut.results
    .filter((r) => r.isVacancy && r.roleMatch >= 2)
    .sort((a, b) => b.roleMatch - a.roleMatch)
    .slice(0, MAX_SONNET_EXTRACTS)

  let sonnetIn = 0
  let sonnetOut = 0

  // Running cost — used to bail mid-loop before exceeding remainingBudget
  function runCost() {
    return (
      haikuIn * HAIKU_PRICE_INPUT +
      haikuOut * HAIKU_PRICE_OUTPUT +
      sonnetIn * SONNET_PRICE_INPUT +
      sonnetOut * SONNET_PRICE_OUTPUT
    )
  }

  for (const cls of sortedCandidates) {
    // Mid-loop cost cap: stop if next extract would exceed user's remaining budget
    if (runCost() + EST_PER_EXTRACT_USD > remainingBudget) {
      report.errors.push(`cost_cap_reached at ${runCost().toFixed(3)}/${remainingBudget.toFixed(2)}`)
      break
    }

    const msg = allMessages.find((m) => m.messageId === cls.messageId)
    if (!msg) continue

    // ---- EARLY DEDUP (before Sonnet extract) ----
    // 1. If TG message contains an hh.ru link to a vacancy we already evaluated → skip Sonnet
    const hhUrlInText = extractHhUrl(msg.text)
    if (hhUrlInText && existingUrls.has(hhUrlInText)) {
      report.duplicates++
      continue
    }
    // 2. The t.me/<channel>/<id> URL itself is a stable id; if we've already evaluated this exact message, skip
    const tgUrl = msg.url || `https://t.me/${msg.channelUsername}/${msg.messageId}`
    if (existingUrls.has(tgUrl)) {
      report.duplicates++
      continue
    }

    try {
      const { vacancy, usage: extUsage } = await extractVacancy(msg, { apiKey })
      sonnetIn += extUsage.inputTokens
      sonnetOut += extUsage.outputTokens
      report.vacanciesExtracted++

      const cKey = canonicalKey(vacancy.company, vacancy.title)
      const existing = keyToExisting.get(cKey)
      const duplicateOfKey = existing && existing.source === 'hh_ru' ? cKey : null

      // Use t.me URL for the evaluation row — preserves both HH and TG rows for same job.
      const url = tgUrl

      const evalRes = await aiEvaluate(
        vacancy.title,
        vacancy.company,
        vacancy.description,
        {
          apiKey,
          cvText: profile.cv_text as string,
          profileSummary, // ← consistency with HH path
        },
      )

      const row = {
        user_id: userId,
        url,
        source: 'tg',
        title: vacancy.title,
        company: vacancy.company,
        location: vacancy.location,
        description: vacancy.description,
        ai_score: evalRes.score,
        ai_verdict: evalRes.verdict,
        ai_summary: evalRes.summary,
        ai_strengths: evalRes.strengths,
        ai_weaknesses: evalRes.weaknesses,
        tg_channel: msg.channelUsername,
        tg_message_id: msg.messageId,
        canonical_key: cKey,
        duplicate_of_key: duplicateOfKey,
      }

      // ignoreDuplicates: don't overwrite existing row (e.g. a HH row with same URL)
      const { error: upErr } = await supabase
        .from('user_evaluations')
        .upsert(row, { onConflict: 'user_id,url', ignoreDuplicates: true })

      if (upErr) {
        report.errors.push(`upsert ${url}: ${upErr.message}`)
      } else {
        report.newRows++
        if (duplicateOfKey) report.duplicates++
        // Update local set so the same message in the same batch isn't re-counted
        existingUrls.add(url)
      }
    } catch (e: any) {
      report.errors.push(
        `extract ${msg.channelUsername}/${msg.messageId}: ${e?.message ?? 'unknown'}`,
      )
    }
  }

  // ---- Update channel cursors ----
  for (const ch of scanRes.channels) {
    if (ch.status === 'ok') {
      await updateChannelCursor(ch.username, ch.lastMessageId)
    }
  }

  // ---- Cost log ----
  report.costUsd = Number(runCost().toFixed(5))

  await supabase.from('tg_scan_log').insert({
    user_id: userId,
    channels_scanned: report.channelsScanned,
    messages_fetched: report.messagesFetched,
    messages_classified: report.messagesClassified,
    vacancies_found: report.vacanciesExtracted,
    haiku_input_tokens: haikuIn,
    haiku_output_tokens: haikuOut,
    sonnet_input_tokens: sonnetIn,
    sonnet_output_tokens: sonnetOut,
    cost_usd: report.costUsd,
    error:
      report.errors.length > 0
        ? report.errors.slice(0, 5).join('; ').slice(0, 500)
        : null,
  })

  return report
}
