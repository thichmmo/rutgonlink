import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Chính sách bảo mật' }

export default function PrivacyPage() {
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12 text-gray-800">
    <h1 className="text-3xl font-bold">Chính sách bảo mật</h1>
    <p>Thông tin về việc sử dụng dữ liệu trên rutgonlink.site và các trang bài viết được xuất bản qua hệ thống.</p>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Tài khoản và nội dung</h2>
      <p>Hệ thống lưu thông tin đăng ký, nội dung bài viết, tệp tải lên và cấu hình do chủ tài khoản cung cấp để vận hành dịch vụ. Bài viết đã xuất bản và các tệp được liên kết trong bài có thể được người truy cập xem.</p>
    </section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Thống kê và lưu trữ trên trình duyệt</h2>
      <p>Dịch vụ ghi nhận lượt truy cập liên kết và lượt bấm popup để cung cấp thống kê. Tùy luồng truy cập, thông tin có thể bao gồm thời điểm, địa chỉ IP, trình duyệt, loại thiết bị và trang giới thiệu. Cookie và bộ nhớ trình duyệt được dùng cho phiên đăng nhập, tiến trình popup và thời gian chờ hiển thị lại.</p>
    </section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Telegram, video nhúng và liên kết ngoài</h2>
      <p>Nút Telegram dẫn tới nhóm hoặc kênh do tác giả bài viết cấu hình. Video nhúng và liên kết ngoài có thể tải nội dung từ nhà cung cấp khác. Khi truy cập hoặc tương tác, chính sách của nhà cung cấp đó được áp dụng; rutgonlink.site không quản lý tài khoản Telegram của người xem.</p>
    </section>
    <section className="space-y-2"><h2 className="text-xl font-semibold">Liên hệ</h2>
      <p>Để hỏi về dữ liệu tài khoản, yêu cầu chỉnh sửa hoặc báo cáo nội dung, liên hệ <a className="text-sky-700 underline" href="mailto:vmetavn@gmail.com">vmetavn@gmail.com</a>. Vui lòng gửi kèm liên kết bài viết liên quan, không gửi mật khẩu.</p>
    </section>
    <Link href="/" className="inline-block text-sky-700 underline">Về trang chủ</Link>
  </main>
}
