import type { MetadataRoute } from 'next'
import { buildSiteUrl } from '@/lib/site-config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['facebookexternalhit', 'facebookcatalog', 'Facebot', 'meta-externalagent', 'meta-externalfetcher', 'meta-webindexer', 'Twitterbot', 'LinkedInBot', 'Zalobot'],
        allow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/dashboard', '/login', '/register', '/checkout', '/share', '/p/'],
      },
    ],
    sitemap: buildSiteUrl('/sitemap.xml'),
  }
}
