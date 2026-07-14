import Link from 'next/link'
import { BookOpen, Clock, ArrowRight } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const categories = [
  { name: 'Tất cả', slug: '' },
  { name: 'Tính năng', slug: 'tinh-nang' },
  { name: 'Hướng dẫn', slug: 'huong-dan' },
  { name: 'Marketing', slug: 'marketing' },
  { name: 'QR Code', slug: 'qr-code' },
  { name: 'Tên miền', slug: 'ten-mien' },
  { name: 'Thông báo', slug: 'thong-bao' },
]

const posts = [
  {
    slug: 'huong-dan-rut-gon-link-hieu-qua',
    category: 'Hướng dẫn',
    categorySlug: 'huong-dan',
    title: 'Hướng dẫn rút gọn link hiệu quả cho người mới bắt đầu',
    excerpt:
      'Tìm hiểu cách tạo link rút gọn chuyên nghiệp, theo dõi thống kê và tối ưu chiến dịch marketing của bạn chỉ trong vài bước đơn giản.',
    date: '20/03/2026',
    readTime: '5 phút',
    cover: null,
    featured: true,
  },
  {
    slug: 'loi-ich-su-dung-qr-code-trong-kinh-doanh',
    category: 'QR Code',
    categorySlug: 'qr-code',
    title: 'Lợi ích khi sử dụng QR Code trong kinh doanh offline và online',
    excerpt:
      'QR Code không chỉ là công cụ chia sẻ link. Khám phá cách doanh nghiệp đang dùng QR Code để tăng tương tác khách hàng và đo lường hiệu quả.',
    date: '18/03/2026',
    readTime: '4 phút',
    cover: null,
    featured: false,
  },
  {
    slug: 'domain-tuy-chinh-tang-nhan-dien-thuong-hieu',
    category: 'Tên miền',
    categorySlug: 'ten-mien',
    title: 'Domain tùy chỉnh — Cách tăng nhận diện thương hiệu qua link rút gọn',
    excerpt:
      'Thay vì link.short/abc123, bạn có thể dùng brand.vn/sale. Hướng dẫn thiết lập domain tùy chỉnh từng bước cho link rút gọn của bạn.',
    date: '15/03/2026',
    readTime: '6 phút',
    cover: null,
    featured: false,
  },
  {
    slug: 'chuyen-huong-theo-quoc-gia-la-gi',
    category: 'Tính năng',
    categorySlug: 'tinh-nang',
    title: 'Chuyển hướng theo quốc gia — Tối ưu chiến dịch đa thị trường',
    excerpt:
      'Một link, nhiều đích đến. Tìm hiểu cách dùng tính năng geo-redirect để điều hướng người dùng Việt Nam, Mỹ, hay Thái Lan đến trang đích phù hợp.',
    date: '12/03/2026',
    readTime: '5 phút',
    cover: null,
    featured: false,
  },
  {
    slug: 'thong-ke-click-giup-gi-cho-marketing',
    category: 'Marketing',
    categorySlug: 'marketing',
    title: 'Thống kê click — Dữ liệu bạn cần để cải thiện chiến dịch marketing',
    excerpt:
      'Đọc hiểu số liệu thống kê link: lượt click theo giờ, thiết bị, trình duyệt và vị trí địa lý. Cách biến dữ liệu thành quyết định kinh doanh.',
    date: '08/03/2026',
    readTime: '7 phút',
    cover: null,
    featured: false,
  },
  {
    slug: 'api-rut-gon-link-tu-dong-hoa-workflow',
    category: 'Tính năng',
    categorySlug: 'tinh-nang',
    title: 'API LinkShort — Tự động hóa quy trình tạo link cho developer',
    excerpt:
      'Tích hợp API rút gọn link vào ứng dụng của bạn chỉ với vài dòng code. Hỗ trợ REST API với xác thực Bearer Token và rate limiting thông minh.',
    date: '05/03/2026',
    readTime: '8 phút',
    cover: null,
    featured: false,
  },
  {
    slug: 'chuyen-huong-theo-thiet-bi-mobile-desktop',
    category: 'Tính năng',
    categorySlug: 'tinh-nang',
    title: 'Chuyển hướng theo thiết bị — Mobile vs Desktop khác nhau thế nào?',
    excerpt:
      'Khi người dùng di động cần App Store còn người dùng desktop cần trang web, một link thông minh sẽ tự xử lý. Cách thiết lập device redirect trong 2 phút.',
    date: '01/03/2026',
    readTime: '4 phút',
    cover: null,
    featured: false,
  },
  {
    slug: 'link-co-mat-khau-bao-ve-noi-dung',
    category: 'Tính năng',
    categorySlug: 'tinh-nang',
    title: 'Link có mật khẩu — Bảo vệ nội dung nhạy cảm khi chia sẻ',
    excerpt:
      'Cần chia sẻ tài liệu nội bộ hay file quan trọng mà không muốn ai cũng xem được? Tính năng link bảo mật bằng mật khẩu là giải pháp hoàn hảo.',
    date: '25/02/2026',
    readTime: '3 phút',
    cover: null,
    featured: false,
  },
  {
    slug: 'ra-mat-goi-ultra-plus-moi-nhat',
    category: 'Thông báo',
    categorySlug: 'thong-bao',
    title: 'Ra mắt gói Ultra+ — Không giới hạn cho doanh nghiệp lớn',
    excerpt:
      'LinkShort chính thức ra mắt gói Ultra+ dành riêng cho agency và doanh nghiệp quy mô lớn. Không giới hạn link, click, domain và hỗ trợ ưu tiên 24/7.',
    date: '20/02/2026',
    readTime: '2 phút',
    cover: null,
    featured: false,
  },
]

const colorMap: Record<string, string> = {
  'Hướng dẫn': 'bg-sky-100 text-sky-700',
  'QR Code': 'bg-purple-100 text-purple-700',
  'Tên miền': 'bg-orange-100 text-orange-700',
  'Tính năng': 'bg-blue-100 text-blue-700',
  'Marketing': 'bg-pink-100 text-pink-700',
  'Thông báo': 'bg-yellow-100 text-yellow-700',
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category = '' } = await searchParams
  const filtered = category ? posts.filter((p) => p.categorySlug === category) : posts
  const featuredPost = filtered.find((p) => p.featured)
  const regularPosts = filtered.filter((p) => !p.featured)

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="bg-linear-to-br from-blue-50 via-white to-indigo-50 pt-28 pb-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <BookOpen className="w-4 h-4" />
            Blog LinkShort
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">
            Kiến thức & Hướng dẫn
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Mẹo sử dụng link rút gọn hiệu quả, tối ưu marketing và cập nhật tính năng mới nhất.
          </p>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mb-12 justify-center">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={cat.slug ? `/blog?category=${cat.slug}` : '/blog'}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  cat.slug === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>

          {/* Featured post */}
          {featuredPost && (
            <div className="mb-12">
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="group grid grid-cols-1 md:grid-cols-2 gap-8 bg-linear-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100 hover:border-blue-300 transition-colors"
              >
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colorMap[featuredPost.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {featuredPost.category}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {featuredPost.readTime}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-700 transition-colors leading-snug">
                    {featuredPost.title}
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed mb-5">{featuredPost.excerpt}</p>
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                    Đọc ngay <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
                <div className="hidden md:flex items-center justify-center">
                  <div className="w-full aspect-video rounded-xl bg-linear-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-white/60" />
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Post grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md hover:border-blue-200 transition-all"
              >
                <div className="h-40 bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-gray-300" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${colorMap[post.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {post.readTime}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors leading-snug line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{post.excerpt}</p>
                  <div className="mt-4 text-xs text-gray-400">{post.date}</div>
                </div>
              </Link>
            ))}
          </div>

          {regularPosts.length === 0 && !featuredPost && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">Chưa có bài viết trong danh mục này.</p>
              <Link href="/blog" className="mt-4 inline-block text-blue-600 hover:underline text-sm">Xem tất cả bài viết</Link>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Nhận bài viết mới nhất</h2>
          <p className="text-blue-200 mb-7">Đăng ký nhận thông báo khi có bài viết mới về marketing và công cụ số.</p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Email của bạn..."
              className="flex-1 px-4 py-3 rounded-xl text-sm bg-white/10 text-white placeholder:text-blue-300 border border-white/20 focus:outline-none focus:border-white"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-white text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              Đăng ký
            </button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  )
}
