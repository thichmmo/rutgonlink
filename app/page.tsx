'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Link2,
  QrCode,
  BarChart2,
  Smartphone,
  Globe,
  Settings,
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
  AlertCircle,
  X,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const configuredDomain = (() => {
  try {
    return new URL(process.env.NEXTAUTH_URL || 'https://rutgonlink.site').hostname.toLowerCase()
  } catch {
    return 'rutgonlink.site'
  }
})()

const ALLOWED_DOMAINS = new Set([
  configuredDomain,
  `www.${configuredDomain}`,
  'clonetot.site',
  'www.clonetot.site',
  'rutgonlink.site',
  'localhost',
  '127.0.0.1',
])

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
      // Block custom domains from showing homepage
      const hostname = window.location.hostname
      if (!ALLOWED_DOMAINS.has(hostname.toLowerCase())) {
        window.location.href = '/404'
        return
      }

      const params = new URLSearchParams(window.location.search)
      if (params.get('error') === 'expired') {
        queueMicrotask(() => setNotice('Link này đã hết hạn và không thể truy cập.'))
      // Remove the param from URL without reload
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    try {
      new URL(url)
    } catch {
      setError('Vui lòng nhập URL hợp lệ (ví dụ: https://example.com)')
      return
    }

    setLoading(true)
    setError('')
    // Redirect to register for anonymous users — URL param preserved for UX context
    window.location.href = `/register?url=${encodeURIComponent(url)}`
  }

  const features = [
    {
      icon: <Link2 className="w-6 h-6 text-blue-600" />,
      title: 'Rút gọn link',
      desc: 'Tạo link ngắn gọn, dễ nhớ chỉ trong vài giây. Hỗ trợ mã tùy chỉnh.',
    },
    {
      icon: <QrCode className="w-6 h-6 text-blue-600" />,
      title: 'QR Code',
      desc: 'Tự động tạo QR Code cho mỗi link rút gọn. Dễ dàng chia sẻ offline.',
    },
    {
      icon: <BarChart2 className="w-6 h-6 text-blue-600" />,
      title: 'Thống kê real-time',
      desc: 'Theo dõi lượt click theo thời gian thực. Biết ai, ở đâu và khi nào.',
    },
    {
      icon: <Smartphone className="w-6 h-6 text-blue-600" />,
      title: 'Chuyển hướng thiết bị',
      desc: 'Điều hướng người dùng đến URL khác nhau dựa trên thiết bị di động hay máy tính.',
    },
    {
      icon: <Globe className="w-6 h-6 text-blue-600" />,
      title: 'Chuyển hướng quốc gia',
      desc: 'Tùy chỉnh trang đích theo từng quốc gia. Tối ưu chiến dịch marketing.',
    },
    {
      icon: <Settings className="w-6 h-6 text-blue-600" />,
      title: 'Domain tùy chỉnh',
      desc: 'Sử dụng tên miền riêng để tăng độ tin cậy và nhận diện thương hiệu.',
    },
  ]

  const stats = [
    { value: '9,720+', label: 'Khách hàng' },
    { value: '50M+', label: 'Lượt click' },
    { value: '99.9%', label: 'Uptime' },
  ]

  const steps = [
    {
      num: '01',
      icon: <Link2 className="w-8 h-8 text-blue-600" />,
      title: 'Dán URL của bạn',
      desc: 'Nhập URL dài vào ô nhập liệu trên trang chủ.',
    },
    {
      num: '02',
      icon: <Zap className="w-8 h-8 text-blue-600" />,
      title: 'Nhấn Rút gọn',
      desc: 'Chúng tôi tạo link ngắn ngay lập tức cho bạn.',
    },
    {
      num: '03',
      icon: <TrendingUp className="w-8 h-8 text-blue-600" />,
      title: 'Theo dõi thống kê',
      desc: 'Xem chi tiết lượt click, thiết bị, quốc gia truy cập.',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Expired link notice */}
      {notice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 shadow-lg">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice('')} className="shrink-0 text-amber-400 hover:text-amber-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <Zap className="w-4 h-4" />
            Rút gọn link nhanh nhất Việt Nam
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Rút Gọn Link{' '}
            <span className="text-blue-600">Thông Minh</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Tạo link rút gọn chuyên nghiệp, theo dõi thống kê click real-time,
            chuyển hướng theo thiết bị và quốc gia — hoàn toàn miễn phí.
          </p>

          {/* URL Form */}
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleShorten} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError('')
                }}
                placeholder="Dán URL dài của bạn vào đây..."
                className="flex-1 px-5 py-4 text-base border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Rút gọn
              </button>
            </form>

            {error && (
              <div className="mt-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {error}
              </div>
            )}

            <p className="mt-4 text-sm text-gray-500">
              Đã có tài khoản?{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Đăng nhập
              </Link>{' '}
              để quản lý link và xem thống kê đầy đủ.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-blue-600 py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-8 text-center text-white">
            {stats.map((stat, i) => (
              <div key={i}>
                <div className="text-4xl font-bold mb-2">{stat.value}</div>
                <div className="text-blue-200 text-sm font-medium uppercase tracking-wide">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Tính năng mạnh mẽ
            </h2>
            <p className="text-gray-600 text-lg max-w-xl mx-auto">
              Mọi công cụ bạn cần để quản lý và tối ưu link rút gọn trong một nền tảng.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feat.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Cách sử dụng</h2>
            <p className="text-gray-600 text-lg">Chỉ 3 bước đơn giản để bắt đầu</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="relative inline-block mb-5">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
                    {step.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Badge */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-center">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Bảo mật SSL</div>
                <div className="text-sm text-gray-500">Mọi link đều được bảo vệ</div>
              </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-gray-200" />
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Tốc độ cao</div>
                <div className="text-sm text-gray-500">Chuyển hướng dưới 100ms</div>
              </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-gray-200" />
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Thống kê chi tiết</div>
                <div className="text-sm text-gray-500">Click, thiết bị, quốc gia</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Bắt đầu miễn phí ngay hôm nay
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            Không cần thẻ tín dụng. Tạo tài khoản chỉ mất 30 giây.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
            >
              Tạo tài khoản miễn phí
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border-2 border-white text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
