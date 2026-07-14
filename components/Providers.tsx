'use client'

import { SessionProvider } from 'next-auth/react'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#0284c7',
          colorLink: '#0284c7',
          colorLinkHover: '#0369a1',
          borderRadius: 8,
        },
        components: {
          Button: { colorPrimary: '#0284c7' },
          Input: { colorPrimary: '#0284c7' },
          Select: { colorPrimary: '#0284c7' },
          Switch: { colorPrimary: '#0284c7' },
          Checkbox: { colorPrimary: '#0284c7' },
          Radio: { colorPrimary: '#0284c7' },
          Slider: { colorPrimary: '#0284c7' },
          Tabs: { colorPrimary: '#0284c7' },
          Pagination: { colorPrimary: '#0284c7' },
          Progress: { colorInfo: '#0284c7' },
          Tag: { colorPrimary: '#0284c7' },
        },
      }}
    >
      <SessionProvider>{children}</SessionProvider>
    </ConfigProvider>
  )
}
