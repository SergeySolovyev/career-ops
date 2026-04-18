/**
 * Connect to the self-hosted Browserless instance running on the DO Droplet.
 * Used for any operation that must bypass HH's cloud-IP block — Vercel
 * functions can't talk to HH directly (403), but Browserless on a residential-
 * adjacent IP can.
 *
 * Required env:
 *   BROWSERLESS_WSS    e.g. wss://165-245-217-177.nip.io/chromium/playwright
 *   BROWSERLESS_TOKEN  shared secret for the Browserless instance
 */

import { chromium, type Browser } from 'playwright-core'

let _cachedBrowser: Browser | null = null

export function isBrowserlessConfigured(): boolean {
  return !!(process.env.BROWSERLESS_WSS && process.env.BROWSERLESS_TOKEN)
}

/**
 * Connect to Browserless and return a Browser instance.
 *
 * Vercel function instances are short-lived but warm enough to reuse a
 * connection across requests within the same instance. We cache it but
 * gracefully reconnect if it's been closed.
 */
export async function connectBrowser(): Promise<Browser> {
  if (!isBrowserlessConfigured()) {
    throw new Error('BROWSERLESS_WSS / BROWSERLESS_TOKEN are not set')
  }

  if (_cachedBrowser?.isConnected()) return _cachedBrowser

  const url = `${process.env.BROWSERLESS_WSS}?token=${process.env.BROWSERLESS_TOKEN}`
  _cachedBrowser = await chromium.connect(url, { timeout: 30_000 })
  return _cachedBrowser
}

/**
 * Standard human-looking browser context options.
 * Cookies are passed in via `storageState.cookies`.
 */
export const DEFAULT_CONTEXT_OPTIONS = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 768 },
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
} as const
