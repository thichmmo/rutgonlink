import type { MetadataRoute } from 'next'
import { buildSiteUrl, getSiteUrl } from '@/lib/site-config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/dashboard', '/login', '/register', '/checkout', '/share', '/p/'],
      },
      {
        userAgent: ['facebookexternalhit', 'Facebot', 'meta-externalagent', 'Twitterbot', 'LinkedInBot', 'Zalobot'],
        allow: '/',
      },
    ],
    sitemap: buildSiteUrl('/sitemap.xml'),
    host: getSiteUrl(),
  }
}
