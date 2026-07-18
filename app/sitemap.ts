import type { MetadataRoute } from 'next'
import { buildSiteUrl } from '@/lib/site-config'
import { BLOG_SEO_ENTRIES } from '@/app/blog/blog-seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: buildSiteUrl('/'),
      lastModified: '2026-07-18',
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: buildSiteUrl('/blog'),
      lastModified: '2026-03-20',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: buildSiteUrl('/api-docs'),
      lastModified: '2026-07-18',
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  return [
    ...staticPages,
    ...BLOG_SEO_ENTRIES.map(({ slug, lastModified }) => ({
      url: buildSiteUrl(`/blog/${slug}`),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
