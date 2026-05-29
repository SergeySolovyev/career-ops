import type { MetadataRoute } from 'next'

/**
 * Dynamic robots.txt — uses NEXT_PUBLIC_SITE_URL so the sitemap link
 * stays correct after domain migration.
 *
 * Replaces public/robots.txt (deleted).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://careerpilot-umber.vercel.app'
  return {
    rules: [
      {
        userAgent: '*',
        // Allow indexing of marketing pages, block app surfaces (PII risk +
        // makes no sense to index per-user data).
        allow: ['/', '/signup', '/login', '/chat', '/offer', '/privacy', '/refund'],
        disallow: [
          '/dashboard',
          '/matches',
          '/onboarding',
          '/settings',
          '/pipeline',
          '/analytics',
          '/connect-hh',
          '/api/',
          '/billing/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
