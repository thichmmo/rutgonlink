# Dashboard domain handling

Short URL mặc định trên dashboard server được sinh từ `NEXTAUTH_URL` qua `lib/site-config.ts`; custom-domain link vẫn dùng domain riêng của link.

Verification: danh sách link gần đây hiển thị đúng origin sau khi đổi domain.

Session lifecycle: dashboard layout also requires an active user status; suspended, deleted or revoked sessions return to `/login`.
