import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white mb-3">
              <Image src="/logo_v_transparent.png" alt="LinkShort" width={32} height={32} className="object-contain" />
              LinkShort
            </Link>
            <p className="text-sm leading-relaxed">
              Dịch vụ rút gọn link chuyên nghiệp. Theo dõi thống kê, chuyển hướng thông minh.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4">Sản phẩm</h3>
            <ul className="space-y-2.5 text-sm">
              <li><a href="/#features" className="hover:text-white transition-colors">Tính năng</a></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Bảng giá</Link></li>
              <li><Link href="/register" className="hover:text-white transition-colors">Đăng ký</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold text-sm mb-4">Tài nguyên</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><a href="#docs" className="hover:text-white transition-colors">Tài liệu API</a></li>
              <li><a href="#support" className="hover:text-white transition-colors">Hỗ trợ</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold text-sm mb-4">Liên hệ</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="tel:0343335657" className="hover:text-white transition-colors flex items-center gap-1.5">
                  📞 0343.335.657
                </a>
              </li>
              <li>
                <a href="https://t.me/vmetamedia" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5">
                  ✈️ Telegram: @vmetamedia
                </a>
              </li>
              <li><a href="mailto:vmetavn@gmail.com" className="hover:text-white transition-colors">vmetavn@gmail.com</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} LinkShort. Bảo lưu mọi quyền.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <a href="#terms" className="hover:text-white transition-colors">Điều khoản</a>
            <a href="#privacy" className="hover:text-white transition-colors">Bảo mật</a>
            <a href="#cookie" className="hover:text-white transition-colors">Cookie</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
