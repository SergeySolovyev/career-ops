import type { MetadataRoute } from 'next'

/**
 * Dynamic sitemap — generated at build time.
 * Single source of truth: NEXT_PUBLIC_SITE_URL. When we move from
 * vibeoffer.today → vibeoffer.today, only that env var changes.
 *
 * Replaces the previous static public/sitemap.xml (deleted) which hardcoded
 * the Vercel preview domain.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://vibeoffer.today'
  const now = new Date()

  // Only public, indexable routes. Authenticated pages (/dashboard, /matches,
  // /chat, /onboarding, /settings) deliberately excluded — they hide private
  // content behind login and shouldn't be in Google's index.
  return [
    { url: `${base}/`,        lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/signup`,  lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/login`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${base}/chat`,    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/offer`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${base}/refund`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
  ]
}
