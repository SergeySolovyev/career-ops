/**
 * One-time authentication script.
 * Run interactively to generate TG_MTPROTO_SESSION (StringSession base64).
 *
 *   docker run --rm -it --env-file .env -v $(pwd):/app -w /app node:20 sh
 *     > npm install
 *     > node auth.js
 *
 * It will prompt for phone, code, optional 2FA password.
 * Print resulting session string — copy to .env as TG_MTPROTO_SESSION.
 *
 * Run ONCE. Sessions don't expire unless terminated from another device.
 */

import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import input from 'input'

const apiId = Number(process.env.TG_MTPROTO_API_ID)
const apiHash = process.env.TG_MTPROTO_API_HASH
if (!apiId || !apiHash) {
  console.error('Set TG_MTPROTO_API_ID + TG_MTPROTO_API_HASH first')
  process.exit(1)
}

const session = new StringSession('') // empty = create new

const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 3,
})

await client.start({
  phoneNumber: () => input.text('Phone number (with country code, e.g. +79991234567): '),
  password: () => input.text('2FA password (skip if none): '),
  phoneCode: () => input.text('Code from Telegram: '),
  onError: (err) => console.error('Auth error:', err),
})

console.log('\n\n========== SAVE THIS SESSION STRING ==========')
console.log(client.session.save())
console.log('================================================')
console.log('Add to .env as TG_MTPROTO_SESSION=<value>')

await client.disconnect()
