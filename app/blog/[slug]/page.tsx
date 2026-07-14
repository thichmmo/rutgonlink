import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Clock, ArrowLeft, Tag, BookOpen } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const colorMap: Record<string, string> = {
  'Hướng dẫn': 'bg-sky-100 text-sky-700',
  'QR Code': 'bg-purple-100 text-purple-700',
  'Tên miền': 'bg-orange-100 text-orange-700',
  'Tính năng': 'bg-blue-100 text-blue-700',
  'Marketing': 'bg-pink-100 text-pink-700',
  'Thông báo': 'bg-yellow-100 text-yellow-700',
}

const posts: Record<string, {
  title: string
  category: string
  date: string
  readTime: string
  excerpt: string
  content: string
}> = {
  'huong-dan-rut-gon-link-hieu-qua': {
    title: 'Hướng dẫn rút gọn link hiệu quả cho người mới bắt đầu',
    category: 'Hướng dẫn',
    date: '20/03/2026',
    readTime: '5 phút',
    excerpt: 'Tìm hiểu cách tạo link rút gọn chuyên nghiệp, theo dõi thống kê và tối ưu chiến dịch marketing của bạn chỉ trong vài bước đơn giản.',
    content: `
## Link rút gọn là gì và tại sao cần dùng?

Link rút gọn là phiên bản ngắn hơn của một URL dài. Thay vì chia sẻ đường dẫn dài hàng trăm ký tự, bạn có thể dùng một link ngắn gọn, dễ nhớ và dễ chia sẻ hơn.

Ví dụ: \`https://example.com/category/products?utm_source=facebook&utm_medium=post&utm_campaign=summer2026\` có thể rút gọn thành \`lnk.vn/summer26\`.

## Lợi ích khi dùng link rút gọn

- **Dễ chia sẻ hơn**: Đặc biệt trên mạng xã hội, SMS hay bảng hiệu
- **Theo dõi được**: Biết bao nhiêu người đã click, từ đâu, dùng thiết bị gì
- **Kiểm soát được**: Thay đổi URL đích mà không cần in lại QR code
- **Tăng độ tin tưởng**: Link từ domain của bạn trông chuyên nghiệp hơn

## Cách tạo link rút gọn đầu tiên

### Bước 1: Tạo tài khoản

Truy cập trang đăng ký và tạo tài khoản miễn phí. Chỉ cần email, không cần thẻ tín dụng.

### Bước 2: Dán URL cần rút gọn

Sau khi đăng nhập, vào Dashboard và nhấn **Tạo link mới**. Dán URL dài vào ô nhập liệu.

### Bước 3: Tùy chỉnh (tuỳ chọn)

Bạn có thể đặt **slug tùy chỉnh** để link dễ nhớ hơn. Ví dụ: \`lnk.vn/khuyen-mai\` thay vì \`lnk.vn/ab3x9\`.

### Bước 4: Chia sẻ và theo dõi

Copy link và bắt đầu chia sẻ. Vào phần **Thống kê** để xem lượt click theo thời gian thực.

## Mẹo dùng link rút gọn hiệu quả

**1. Đặt slug có nghĩa**: Thay vì để mã ngẫu nhiên, hãy đặt slug mô tả nội dung như \`/san-pham-moi\` hay \`/khuyen-mai-tet\`.

**2. Thêm UTM parameter trước khi rút gọn**: Rút gọn link đã có UTM để theo dõi nguồn traffic trong Google Analytics.

**3. Tạo QR Code ngay**: Mỗi link rút gọn đều có QR code tự động. Dùng cho brochure, bảng hiệu, danh thiếp.

**4. Kiểm tra thống kê định kỳ**: Xem link nào hiệu quả, link nào cần thay đổi nội dung đích.

## Câu hỏi thường gặp

**Link rút gọn có hết hạn không?**
Với gói miễn phí, link không hết hạn. Bạn cũng có thể tự đặt ngày hết hạn nếu muốn.

**Tôi có thể thay đổi URL đích không?**
Có. Bạn có thể chỉnh sửa URL đích bất cứ lúc nào mà link vẫn hoạt động bình thường.

**Có giới hạn số link không?**
Gói miễn phí cho phép 500 link. Nâng lên Pro hoặc Ultra để tăng giới hạn.
    `,
  },
  'loi-ich-su-dung-qr-code-trong-kinh-doanh': {
    title: 'Lợi ích khi sử dụng QR Code trong kinh doanh offline và online',
    category: 'QR Code',
    date: '18/03/2026',
    readTime: '4 phút',
    excerpt: 'QR Code không chỉ là công cụ chia sẻ link. Khám phá cách doanh nghiệp đang dùng QR Code để tăng tương tác khách hàng và đo lường hiệu quả.',
    content: `
## QR Code đang bùng nổ trở lại

Sau thời kỳ đại dịch, QR Code trở thành công cụ phổ biến trong hầu hết các lĩnh vực kinh doanh. Từ nhà hàng thay menu giấy bằng QR, đến quảng cáo ngoài trời dẫn về trang web — QR Code có mặt ở khắp nơi.

Nhưng nhiều doanh nghiệp vẫn đang bỏ lỡ tiềm năng thực sự của công cụ này.

## 5 cách dùng QR Code hiệu quả trong kinh doanh

### 1. Menu nhà hàng và quán cà phê

Thay menu giấy bằng QR code trỏ vào menu online. Khi cần cập nhật giá hay thêm món, bạn chỉ cần sửa trang web — không cần in lại menu.

**Bonus**: Theo dõi được bao nhiêu khách đã scan menu, từ bàn nào, vào giờ nào.

### 2. Danh thiếp kỹ thuật số

Thêm QR code vào danh thiếp dẫn đến trang profile hoặc LinkedIn của bạn. Khách hàng có thể lưu thông tin liên lạc chỉ bằng một lần scan.

### 3. Quảng cáo ngoài trời (OOH)

Banner, poster, bảng hiệu đều có thể gắn QR code. Bạn đo được hiệu quả của từng vị trí đặt quảng cáo bằng cách dùng link rút gọn khác nhau cho mỗi bảng.

### 4. Bao bì sản phẩm

QR code trên hộp/bao bì dẫn đến trang hướng dẫn sử dụng, video demo, hay chương trình bảo hành. Tiết kiệm chi phí in ấn và luôn cập nhật được.

### 5. Sự kiện và triển lãm

Thay vì phát tài liệu giấy, dùng QR code dẫn đến landing page sự kiện, form đăng ký hay tài liệu PDF.

## QR Code động vs QR Code tĩnh

**QR Code tĩnh**: URL được mã hóa trực tiếp vào hình ảnh QR. Không thể thay đổi sau khi in.

**QR Code động** (LinkShort cung cấp): QR code trỏ vào link rút gọn. Bạn có thể thay đổi URL đích bất cứ lúc nào mà không cần in lại QR.

Luôn dùng QR Code động cho marketing để linh hoạt và đo lường được.

## Cách tạo QR Code với LinkShort

1. Tạo link rút gọn cho URL bạn muốn
2. Vào trang chi tiết link, chọn **Tải QR Code**
3. Chọn kích thước, màu sắc (gói Pro trở lên)
4. Tải về dạng PNG hoặc SVG

QR code tự động được tạo cho mọi link, không cần công cụ nào khác.
    `,
  },
  'domain-tuy-chinh-tang-nhan-dien-thuong-hieu': {
    title: 'Domain tùy chỉnh — Cách tăng nhận diện thương hiệu qua link rút gọn',
    category: 'Tên miền',
    date: '15/03/2026',
    readTime: '6 phút',
    excerpt: 'Thay vì link.short/abc123, bạn có thể dùng brand.vn/sale. Hướng dẫn thiết lập domain tùy chỉnh từng bước cho link rút gọn của bạn.',
    content: `
## Tại sao cần domain tùy chỉnh?

Hãy so sánh hai link dưới đây:
- \`lnk.vn/a9kx2\`
- \`mua.shopten.vn/flash-sale\`

Link thứ hai trông chuyên nghiệp hơn, đáng tin hơn và phản ánh thương hiệu của bạn. Người dùng có xu hướng click vào link rõ nguồn gốc hơn.

## Điều kiện để dùng domain tùy chỉnh

- Bạn đang dùng gói **Pro** trở lên
- Bạn đã mua một domain (ví dụ: \`mua.shopten.vn\` hoặc \`go.conty.vn\`)
- Bạn có thể truy cập vào phần quản lý DNS của domain đó

## Hướng dẫn thiết lập từng bước

### Bước 1: Thêm subdomain trong DNS

Đăng nhập vào nhà cung cấp domain của bạn (Inet, PA, GoDaddy...) và thêm bản ghi DNS:

\`\`\`
Type: CNAME
Name: go (hoặc mua, link, click...)
Value: cname.linkshort.vn
TTL: 3600
\`\`\`

### Bước 2: Thêm domain vào LinkShort

1. Vào **Dashboard → Domains**
2. Nhấn **Thêm domain mới**
3. Nhập \`go.shopten.vn\` (tên đầy đủ của subdomain)
4. Nhấn **Xác minh**

Hệ thống sẽ kiểm tra bản ghi CNAME. Thường mất 5–30 phút để DNS cập nhật.

### Bước 3: Đặt làm domain mặc định (tùy chọn)

Sau khi xác minh xong, bạn có thể đặt domain này làm mặc định cho tất cả link mới tạo.

### Bước 4: Tạo link với domain mới

Tạo link mới và chọn domain \`go.shopten.vn\`. Link của bạn sẽ có dạng \`go.shopten.vn/flash-sale\`.

## Lưu ý quan trọng

**SSL tự động**: LinkShort tự cấp chứng chỉ SSL cho domain của bạn. Không cần tự cài Let's Encrypt.

**Không dùng root domain**: Nên dùng subdomain như \`go.example.vn\` thay vì \`example.vn\` để tránh xung đột với website chính.

**Nhiều domain cùng lúc**: Gói Ultra cho phép 5 domain, Ultra+ không giới hạn. Phù hợp nếu bạn quản lý nhiều thương hiệu.
    `,
  },
  'chuyen-huong-theo-quoc-gia-la-gi': {
    title: 'Chuyển hướng theo quốc gia — Tối ưu chiến dịch đa thị trường',
    category: 'Tính năng',
    date: '12/03/2026',
    readTime: '5 phút',
    excerpt: 'Một link, nhiều đích đến. Tìm hiểu cách dùng tính năng geo-redirect để điều hướng người dùng Việt Nam, Mỹ, hay Thái Lan đến trang đích phù hợp.',
    content: `
## Vấn đề khi chạy campaign đa quốc gia

Bạn đang chạy một chiến dịch marketing cho cả thị trường Việt Nam và Thái Lan. Nhưng mỗi thị trường lại có trang đích khác nhau, ngôn ngữ khác nhau, giá khác nhau.

Giải pháp thông thường: tạo 2 link riêng biệt cho 2 thị trường. Nhưng điều này rất bất tiện khi quản lý.

**Giải pháp tốt hơn**: Dùng một link duy nhất với tính năng chuyển hướng theo quốc gia (geo-redirect).

## Geo-redirect hoạt động như thế nào?

Khi người dùng click vào link, hệ thống xác định vị trí địa lý qua địa chỉ IP. Dựa trên quốc gia, người dùng được chuyển đến URL đích tương ứng.

Ví dụ cấu hình:
- 🇻🇳 Việt Nam → \`https://shopten.vn/san-pham\`
- 🇹🇭 Thái Lan → \`https://shopten.th/product\`
- 🌍 Các nước khác → \`https://shopten.com/en/product\`

## Trường hợp sử dụng thực tế

### Affiliate marketing đa thị trường
Một link Amazon Affiliate có thể chuyển hướng đến Amazon.vn, Amazon.com, hay Amazon.co.uk tùy quốc gia của người click.

### Ứng dụng mobile
Chuyển hướng người dùng iOS Việt Nam đến App Store VN, Android đến Google Play VN — tất cả từ một QR code.

### Nội dung bản địa hóa
Blog hay landing page bằng tiếng địa phương giúp tăng chuyển đổi đáng kể so với trang tiếng Anh.

## Cách thiết lập geo-redirect

Tính năng này có trên gói **Ultra** và **Ultra+**.

1. Tạo link mới hoặc chỉnh sửa link hiện có
2. Bật **Chuyển hướng theo quốc gia**
3. Thêm từng quốc gia và URL đích tương ứng
4. Đặt URL mặc định cho các quốc gia không có trong danh sách
5. Lưu và bắt đầu chia sẻ

## Theo dõi hiệu quả

Trong phần thống kê, bạn sẽ thấy biểu đồ phân bổ click theo từng quốc gia. Dữ liệu này rất hữu ích để quyết định nên tập trung vào thị trường nào.
    `,
  },
  'thong-ke-click-giup-gi-cho-marketing': {
    title: 'Thống kê click — Dữ liệu bạn cần để cải thiện chiến dịch marketing',
    category: 'Marketing',
    date: '08/03/2026',
    readTime: '7 phút',
    excerpt: 'Đọc hiểu số liệu thống kê link: lượt click theo giờ, thiết bị, trình duyệt và vị trí địa lý. Cách biến dữ liệu thành quyết định kinh doanh.',
    content: `
## Tại sao thống kê link quan trọng hơn bạn nghĩ?

Nhiều marketer tạo link rút gọn chỉ để link ngắn hơn, rồi bỏ qua hoàn toàn phần thống kê. Đây là một sai lầm lớn.

Thống kê link cung cấp dữ liệu hành vi người dùng thực tế — không phải dự đoán, không phải suy đoán. Và dữ liệu này giúp bạn đưa ra quyết định tốt hơn.

## Những chỉ số quan trọng cần theo dõi

### Lượt click theo thời gian

Biểu đồ này cho bạn thấy:
- **Giờ vàng**: Khung giờ nào người dùng click nhiều nhất → Lên lịch đăng bài vào giờ đó
- **Xu hướng**: Click đang tăng hay giảm → Điều chỉnh content strategy
- **Đột biến**: Khi nào có sự kiện đặc biệt làm tăng traffic

### Nguồn truy cập (Referrer)

Biết người dùng đến từ đâu:
- Facebook, Instagram, TikTok
- Email newsletter
- Tin nhắn trực tiếp (Direct)
- Website khác

**Ứng dụng**: Nếu 70% click đến từ Facebook, hãy tập trung ngân sách quảng cáo vào đây.

### Phân bổ thiết bị

- **Mobile vs Desktop**: Nếu 80% từ mobile, trang đích của bạn phải tối ưu mobile hoàn hảo
- **Loại thiết bị**: iOS vs Android → Biết nên ưu tiên app nào

### Vị trí địa lý

- Thành phố nào có nhiều người click nhất?
- Tỉnh nào có tiềm năng nhưng chưa khai thác?

## Cách đọc dữ liệu và ra quyết định

**Kịch bản 1**: Click cao nhưng chuyển đổi thấp
→ Link hoạt động tốt nhưng trang đích có vấn đề. Kiểm tra lại landing page.

**Kịch bản 2**: Click giảm dần theo ngày
→ Nội dung đang mất hấp dẫn hoặc đối tượng đã bão hòa. Thử target nhóm mới.

**Kịch bản 3**: 90% click từ mobile nhưng trang đích chậm trên mobile
→ Cải thiện performance mobile ngay.

## Tích hợp với Google Analytics

Để theo dõi sâu hơn, thêm UTM parameter vào URL trước khi rút gọn:

\`\`\`
https://yoursite.com/product?utm_source=facebook&utm_medium=social&utm_campaign=sale_march
\`\`\`

Rút gọn URL đã có UTM để dữ liệu được truyền đầy đủ vào Google Analytics.
    `,
  },
  'api-rut-gon-link-tu-dong-hoa-workflow': {
    title: 'API LinkShort — Tự động hóa quy trình tạo link cho developer',
    category: 'Tính năng',
    date: '05/03/2026',
    readTime: '8 phút',
    excerpt: 'Tích hợp API rút gọn link vào ứng dụng của bạn chỉ với vài dòng code. Hỗ trợ REST API với xác thực Bearer Token và rate limiting thông minh.',
    content: `
## Tại sao cần API?

Nếu bạn cần tạo hàng trăm hay hàng nghìn link rút gọn, làm thủ công qua giao diện là không khả thi. API cho phép bạn tích hợp LinkShort vào ứng dụng, script hay workflow của mình.

Một số use case phổ biến:
- E-commerce: Tự động tạo link ngắn cho từng sản phẩm
- Email marketing: Tạo link tracking cho từng campaign
- Social media tool: Tự động rút gọn link trước khi đăng

## Xác thực API

Mọi request đều cần Bearer Token trong header:

\`\`\`http
Authorization: Bearer YOUR_API_TOKEN
\`\`\`

Lấy API token tại: **Dashboard → Cài đặt → API Token**

## Các endpoint chính

### Tạo link rút gọn

\`\`\`http
POST /api/v1/links
Content-Type: application/json

{
  "url": "https://example.com/very-long-url",
  "slug": "my-custom-slug",  // tùy chọn
  "expireAt": "2026-12-31"   // tùy chọn
}
\`\`\`

Response:
\`\`\`json
{
  "id": "clx123abc",
  "shortUrl": "https://lnk.vn/my-custom-slug",
  "originalUrl": "https://example.com/very-long-url",
  "createdAt": "2026-03-05T10:00:00Z"
}
\`\`\`

### Lấy danh sách link

\`\`\`http
GET /api/v1/links?page=1&limit=20
\`\`\`

### Xem thống kê link

\`\`\`http
GET /api/v1/links/{id}/stats
\`\`\`

### Xóa link

\`\`\`http
DELETE /api/v1/links/{id}
\`\`\`

## Ví dụ code

### JavaScript / Node.js

\`\`\`javascript
const response = await fetch('https://lnk.vn/api/v1/links', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://example.com/product/123',
  }),
})

const data = await response.json()
console.log(data.shortUrl) // https://lnk.vn/ab3x9
\`\`\`

### Python

\`\`\`python
import requests

response = requests.post(
    'https://lnk.vn/api/v1/links',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={'url': 'https://example.com/product/123'}
)

data = response.json()
print(data['shortUrl'])
\`\`\`

## Rate Limiting

- Gói Ultra: 1.000 request/giờ
- Gói Ultra+: Không giới hạn

Khi vượt giới hạn, API trả về HTTP 429. Nên implement retry với exponential backoff.
    `,
  },
  'chuyen-huong-theo-thiet-bi-mobile-desktop': {
    title: 'Chuyển hướng theo thiết bị — Mobile vs Desktop khác nhau thế nào?',
    category: 'Tính năng',
    date: '01/03/2026',
    readTime: '4 phút',
    excerpt: 'Khi người dùng di động cần App Store còn người dùng desktop cần trang web, một link thông minh sẽ tự xử lý. Cách thiết lập device redirect trong 2 phút.',
    content: `
## Vấn đề: Một link, hai đích đến khác nhau

Bạn ra mắt ứng dụng di động mới. Trên Instagram, bạn chia sẻ một link và muốn:
- Người dùng **iOS** → App Store
- Người dùng **Android** → Google Play
- Người dùng **Desktop** → Trang web giới thiệu app

Nếu không có device redirect, bạn phải tạo 3 link khác nhau và hướng dẫn người dùng chọn đúng link — rất bất tiện.

## Giải pháp: Device Redirect

Tính năng này có trên gói **Pro** trở lên.

### Cách thiết lập

1. Tạo link mới hoặc chỉnh sửa link hiện có
2. Bật **Chuyển hướng theo thiết bị**
3. Nhập URL cho từng loại thiết bị:
   - **iOS** (iPhone, iPad): Link App Store
   - **Android**: Link Google Play
   - **Desktop / Khác**: Link website hoặc landing page
4. Lưu lại

Chỉ mất khoảng 2 phút để thiết lập.

## Các use case phổ biến

**App Store / Google Play**
Một QR code in trên bao bì sản phẩm có thể đưa iOS user đến App Store và Android user đến Google Play.

**Trang đích tối ưu hóa**
Desktop thường có màn hình lớn, phù hợp với trang đích nhiều thông tin. Mobile cần trang đơn giản, load nhanh với nút CTA to rõ.

**Tài liệu và hướng dẫn sử dụng**
Hướng dẫn sử dụng cho mobile app khác hoàn toàn với desktop. Device redirect giúp đúng người nhận đúng tài liệu.

## Kết hợp với Geo-redirect

Trên gói Ultra trở lên, bạn có thể kết hợp cả **device redirect** và **geo-redirect** trong cùng một link. Ví dụ:

- 🇻🇳 iOS → App Store VN
- 🇻🇳 Android → Google Play VN
- 🇺🇸 iOS → App Store US
- 🇺🇸 Android → Google Play US

Một link duy nhất xử lý tất cả!
    `,
  },
  'link-co-mat-khau-bao-ve-noi-dung': {
    title: 'Link có mật khẩu — Bảo vệ nội dung nhạy cảm khi chia sẻ',
    category: 'Tính năng',
    date: '25/02/2026',
    readTime: '3 phút',
    excerpt: 'Cần chia sẻ tài liệu nội bộ hay file quan trọng mà không muốn ai cũng xem được? Tính năng link bảo mật bằng mật khẩu là giải pháp hoàn hảo.',
    content: `
## Bảo vệ nội dung khi chia sẻ link

Không phải lúc nào bạn cũng muốn link mình chia sẻ có thể truy cập tự do. Đôi khi cần giới hạn người xem, như:

- Tài liệu nội bộ công ty
- Báo giá riêng cho từng khách hàng
- File thiết kế chưa ra mắt
- Nội dung trả phí

## Cách link có mật khẩu hoạt động

Khi ai đó truy cập link, thay vì chuyển hướng ngay, họ thấy trang yêu cầu nhập mật khẩu. Chỉ người có mật khẩu đúng mới được chuyển đến URL đích.

Mật khẩu được mã hóa, không lưu dưới dạng plain text.

## Thiết lập link có mật khẩu

1. Tạo link mới
2. Mở phần **Tùy chọn nâng cao**
3. Bật **Bảo vệ bằng mật khẩu**
4. Nhập mật khẩu của bạn
5. Lưu link

Chia sẻ link và mật khẩu riêng cho người cần xem.

## Kết hợp với hạn chót

Bạn có thể kết hợp mật khẩu với **ngày hết hạn**. Ví dụ: Chia sẻ báo giá cho khách và link tự hết hạn sau 7 ngày, dù biết mật khẩu cũng không vào được nữa.

## Lưu ý bảo mật

- Đừng đưa mật khẩu vào cùng tin nhắn chứa link
- Gửi link qua email, mật khẩu qua Zalo/Messenger
- Thay đổi mật khẩu định kỳ nếu link dùng lâu dài

Tính năng này có sẵn từ gói **Pro** trở lên.
    `,
  },
  'ra-mat-goi-ultra-plus-moi-nhat': {
    title: 'Ra mắt gói Ultra+ — Không giới hạn cho doanh nghiệp lớn',
    category: 'Thông báo',
    date: '20/02/2026',
    readTime: '2 phút',
    excerpt: 'LinkShort chính thức ra mắt gói Ultra+ dành riêng cho agency và doanh nghiệp quy mô lớn. Không giới hạn link, click, domain và hỗ trợ ưu tiên 24/7.',
    content: `
## LinkShort ra mắt gói Ultra+

Hôm nay chúng tôi chính thức giới thiệu gói **Ultra+** — gói cao cấp nhất trong hệ thống dịch vụ LinkShort, được thiết kế đặc biệt cho agency, doanh nghiệp thương mại điện tử và các đội nhóm marketing quy mô lớn.

## Những gì gói Ultra+ mang lại

### Không giới hạn hoàn toàn

Với Ultra+, không còn lo lắng về giới hạn:
- **Không giới hạn link**: Tạo bao nhiêu link tùy ý
- **Không giới hạn lượt click**: Chạy campaign lớn không bị chặn
- **Không giới hạn domain tùy chỉnh**: Quản lý nhiều thương hiệu trên một tài khoản

### Hỗ trợ ưu tiên 24/7

Khách hàng Ultra+ được hỗ trợ qua:
- Chat trực tiếp trong dashboard
- Hotline ưu tiên
- Email với SLA phản hồi trong 4 giờ

### API không giới hạn

Không còn rate limit cho API calls. Phù hợp với hệ thống tự động hóa quy mô lớn.

## Mức giá

**299.000đ/tháng** — tương đương khoảng 12đ/giờ.

So sánh với chi phí nhân sự để xử lý thủ công, đây là đầu tư cực kỳ hiệu quả.

## Nâng cấp ngay hôm nay

Nếu bạn đang dùng gói Ultra và thấy hạn chế về số lượng, đây là lúc để chuyển lên Ultra+.

Truy cập **Dashboard → Nâng cấp gói** để bắt đầu. Không mất dữ liệu, không gián đoạn dịch vụ.

Cảm ơn cộng đồng LinkShort đã đồng hành và phản hồi giúp chúng tôi phát triển gói mới này!
    `,
  },
}

function renderMarkdown(content: string) {
  const lines = content.trim().split('\n')
  const result: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      result.push(
        <pre key={i} className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto text-sm my-5 leading-relaxed">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      i++
      continue
    }

    // H2
    if (line.startsWith('## ')) {
      result.push(<h2 key={i} className="text-2xl font-bold text-gray-900 mt-10 mb-4">{line.slice(3)}</h2>)
      i++; continue
    }

    // H3
    if (line.startsWith('### ')) {
      result.push(<h3 key={i} className="text-lg font-semibold text-gray-800 mt-7 mb-3">{line.slice(4)}</h3>)
      i++; continue
    }

    // Bullet list
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2))
        i++
      }
      result.push(
        <ul key={i} className="list-disc list-inside space-y-1.5 text-gray-700 my-4 ml-2">
          {items.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code class="bg-gray-100 text-blue-700 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>') }} />)}
        </ul>
      )
      continue
    }

    // Empty line
    if (line.trim() === '') { i++; continue }

    // Paragraph
    const html = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 text-blue-700 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    result.push(<p key={i} className="text-gray-700 leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: html }} />)
    i++
  }

  return result
}

export async function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }))
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = posts[slug]
  if (!post) notFound()

  const allSlugs = Object.keys(posts)
  const relatedSlugs = allSlugs.filter((s) => s !== slug).slice(0, 3)

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-8">
          <Link href="/blog" className="hover:text-blue-600 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Blog
          </Link>
          <span>/</span>
          <span className="text-gray-600 truncate">{post.title}</span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-5">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colorMap[post.category] ?? 'bg-gray-100 text-gray-600'}`}>
            {post.category}
          </span>
          <span className="text-sm text-gray-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {post.readTime}
          </span>
          <span className="text-sm text-gray-400">{post.date}</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-5">
          {post.title}
        </h1>

        {/* Excerpt */}
        <p className="text-xl text-gray-500 leading-relaxed mb-10 border-l-4 border-blue-200 pl-4">
          {post.excerpt}
        </p>

        {/* Cover placeholder */}
        <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center mb-12">
          <BookOpen className="w-16 h-16 text-blue-300" />
        </div>

        {/* Content */}
        <div className="prose-custom">
          {renderMarkdown(post.content)}
        </div>

        {/* Tags */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <Tag className="w-4 h-4 text-gray-400" />
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colorMap[post.category] ?? 'bg-gray-100 text-gray-600'}`}>
            {post.category}
          </span>
        </div>

        {/* CTA */}
        <div className="mt-10 bg-blue-50 border border-blue-100 rounded-2xl p-7 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Bắt đầu miễn phí ngay hôm nay</h3>
          <p className="text-gray-600 mb-5 text-sm">Tạo tài khoản trong 30 giây, không cần thẻ tín dụng.</p>
          <Link
            href="/register"
            className="inline-block px-7 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
          >
            Tạo tài khoản miễn phí
          </Link>
        </div>
      </article>

      {/* Related posts */}
      <section className="bg-gray-50 py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-gray-900 mb-8">Bài viết liên quan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {relatedSlugs.map((slug) => {
              const p = posts[slug]
              return (
                <Link
                  key={slug}
                  href={`/blog/${slug}`}
                  className="group bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${colorMap[p.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {p.category}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900 mt-3 mb-2 group-hover:text-blue-700 transition-colors line-clamp-2 leading-snug">
                    {p.title}
                  </h3>
                  <p className="text-xs text-gray-400">{p.date}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
