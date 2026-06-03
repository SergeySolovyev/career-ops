#!/usr/bin/env tsx
/**
 * draft-outreach.ts — CLI для запуска Outreach Drafter Agent на батче имён.
 *
 * Входной формат: docs/outreach-list.json (создать руками — see schema ниже)
 *   [
 *     {
 *       "name": "Алексей",
 *       "profession": "junior frontend dev, год опыта",
 *       "relationship": "одногруппник по МАИ, мы вместе делали diplom",
 *       "handle": "@alexei_dev",
 *       "channel": "tg"
 *     },
 *     ...
 *   ]
 *
 * Выходной формат: docs/OUTREACH-DRAFTS.md
 *   Каждый draft — отдельный блок с reasoning + body, готов к copy-paste.
 *
 * Запуск:
 *   ANTHROPIC_API_KEY=sk-... tsx scripts/draft-outreach.ts
 *
 * Workflow Яны/Сергея:
 *   1. Создать docs/outreach-list.json со списком людей
 *   2. tsx scripts/draft-outreach.ts
 *   3. Открыть docs/OUTREACH-DRAFTS.md, проредактировать любые черновики
 *   4. Скопипастить в Telegram/Gmail и отправить
 *   5. Через 7 дней — отслеживать ответы, лучшие черновики добавить в
 *      eval-dataset для следующей итерации SOP агента
 */

import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { draftOutreachBatch, type OutreachTarget } from '../apps/web/lib/agents/outreach-drafter'

const ROOT = resolve(__dirname, '..')
const INPUT_PATH = resolve(ROOT, 'docs/outreach-list.json')
const OUTPUT_PATH = resolve(ROOT, 'docs/OUTREACH-DRAFTS.md')

async function main() {
  let rawInput: string
  try {
    rawInput = await readFile(INPUT_PATH, 'utf-8')
  } catch (e: any) {
    console.error(`❌ Не удалось прочитать ${INPUT_PATH}`)
    console.error('   Создайте файл со списком людей в формате:')
    console.error(SAMPLE_INPUT)
    process.exit(1)
  }

  let targets: OutreachTarget[]
  try {
    targets = JSON.parse(rawInput) as OutreachTarget[]
  } catch (e: any) {
    console.error(`❌ JSON parse error в ${INPUT_PATH}: ${e?.message ?? e}`)
    process.exit(1)
  }

  if (!Array.isArray(targets) || targets.length === 0) {
    console.error('❌ outreach-list.json должен быть массивом с ≥ 1 элементом')
    process.exit(1)
  }

  console.log(`📋 Draft'ить сообщения для ${targets.length} человек...`)
  const drafts = await draftOutreachBatch(targets)

  // Render Markdown — каждый draft в отдельном блоке
  const md = renderMarkdown(targets, drafts)
  await writeFile(OUTPUT_PATH, md, 'utf-8')

  const succeeded = drafts.filter((d) => !('error' in d)).length
  const failed = drafts.length - succeeded
  console.log(`\n✅ Готово: ${succeeded} drafts в ${OUTPUT_PATH}`)
  if (failed > 0) {
    console.log(`⚠️  ${failed} с ошибками — см. файл, секция «Failed»`)
  }
}

function renderMarkdown(
  targets: OutreachTarget[],
  drafts: Array<{ recipient?: string; channel?: string; subject?: string | null; body?: string; reasoning?: string } | { error: string; recipient?: string }>,
): string {
  const ok = drafts
    .map((d, i) => ({ d, target: targets[i] }))
    .filter(({ d }) => !('error' in d))

  const failed = drafts
    .map((d, i) => ({ d, target: targets[i] }))
    .filter(({ d }) => 'error' in d)

  let out = `# Outreach Drafts — ${new Date().toISOString().slice(0, 10)}\n\n`
  out += `Сгенерировано Outreach Drafter Agent (\`apps/web/lib/agents/outreach-drafter.ts\`).\n`
  out += `**Прежде чем отправить** — прочитайте каждый draft и при необходимости отредактируйте.\n`
  out += `Это humanApprovalGate агента — отправка только вручную.\n\n`
  out += `---\n\n`

  for (const { d, target } of ok) {
    const draft = d as { recipient: string; channel: string; subject: string | null; body: string; reasoning: string }
    out += `## ${target.name} → ${target.handle} (${draft.channel})\n\n`
    out += `**Контекст:** ${target.relationship} · ${target.profession}\n\n`
    out += `**Почему так** (agent reasoning):\n> ${draft.reasoning}\n\n`
    if (draft.subject) {
      out += `**Subject:** ${draft.subject}\n\n`
    }
    out += `**Message:**\n\n\`\`\`\n${draft.body}\n\`\`\`\n\n`
    out += `---\n\n`
  }

  if (failed.length > 0) {
    out += `## Failed (${failed.length})\n\n`
    for (const { d, target } of failed) {
      const err = d as { error: string }
      out += `- **${target.name}** (${target.handle}): ${err.error}\n`
    }
  }

  return out
}

const SAMPLE_INPUT = `   [
     {
       "name": "Алексей",
       "profession": "junior frontend dev, год опыта",
       "relationship": "одногруппник по МАИ, вместе делали diplom",
       "handle": "@alexei_dev",
       "channel": "tg"
     }
   ]`

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
