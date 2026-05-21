/**
 * Beta whitelist gate for signup. Reads WHITELIST_EMAILS env var as
 * comma-separated list (case-insensitive). Empty / unset = open signup.
 *
 * Mon May 13 launch: 10 invited emails. Wed May 15 graduation:
 *   vercel env rm WHITELIST_EMAILS  (or set to '*')
 *
 * Special value '*' = open signup (same as unset). Useful for staging
 * tests where you want to keep the var visible but disabled.
 */
export function isEmailWhitelisted(email: string): boolean {
  const raw = process.env.WHITELIST_EMAILS?.trim()
  if (!raw || raw === '*') return true // open signup
  const allowed = raw
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return allowed.includes(email.toLowerCase().trim())
}

export const WHITELIST_REJECT_MESSAGE =
  'CareerPilot работает в режиме закрытой беты. Запросите invite на hello@careerpilot.app — мы пригласим вас в течение 24 часов.'
