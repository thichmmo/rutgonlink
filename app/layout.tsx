import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import Providers from '@/components/Providers'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'vietnamese'] })
const appUrl = process.env.NEXTAUTH_URL || 'https://rutgonlink.site'
const appHostname = new URL(appUrl).hostname

export const metadata: Metadata = {
  title: `${appHostname} - Rút gọn link chuyên nghiệp`,
  description:
    'Dịch vụ rút gọn link miễn phí, theo dõi thống kê click, chuyển hướng theo thiết bị và quốc gia. Tạo link ngắn gọn, đẹp, dễ nhớ.',
  metadataBase: new URL(appUrl),
  openGraph: {
    title: `${appHostname} - Rút gọn link chuyên nghiệp`,
    description:
      'Dịch vụ rút gọn link miễn phí, theo dõi thống kê click, chuyển hướng theo thiết bị và quốc gia.',
    url: appUrl,
    siteName: appHostname,
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appHostname} - Rút gọn link chuyên nghiệp`,
    description:
      'Dịch vụ rút gọn link miễn phí, theo dõi thống kê click, chuyển hướng theo thiết bị và quốc gia.',
  },
  icons: {
    icon: '/logo_v_clean.svg',
    shortcut: '/logo_v_transparent.png',
    apple: '/logo_v_transparent.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  )
}
