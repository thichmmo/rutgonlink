import type { Metadata } from 'next'
import HomePageClient from './HomePageClient'
import { buildSiteUrl, getSiteName } from '@/lib/site-config'

const siteName = getSiteName()
const canonicalUrl = buildSiteUrl('/')
const description =
  'Rút gọn link miễn phí, tạo QR Code và theo dõi lượt click theo thiết bị, vị trí và nguồn truy cập.'

export const metadata: Metadata = {
  title: 'Rút gọn link miễn phí, theo dõi click và tạo QR Code',
  description,
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: `${siteName} - Rút gọn link chuyên nghiệp`,
    description,
    url: canonicalUrl,
    siteName,
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} - Rút gọn link chuyên nghiệp`,
    description,
  },
}

export default function HomePage() {
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: canonicalUrl,
    description,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <HomePageClient />
    </>
  )
}
