# Dashboard domain handling

Short URL mặc định trên dashboard server được sinh từ `NEXTAUTH_URL` qua `lib/site-config.ts`; custom-domain link vẫn dùng domain riêng của link.

Verification: danh sách link gần đây hiển thị đúng origin sau khi đổi domain.
