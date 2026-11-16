# Domain-aware API responses

Các response tạo/list link dùng origin từ `NEXTAUTH_URL` theo mặc định và ưu tiên `domain.domain` hoặc `sharedDomain` (thuộc `SHARED_DOMAINS`, ví dụ `6739dd4f.nip.io`) khi link được gắn domain riêng/dùng chung; kiểm tra chống rút gọn chính domain ứng dụng dùng hostname trung tâm.

Verification: gọi `GET/POST /api/v1/links` (có và không có `sharedDomain`) và kiểm tra `shortUrl` trả đúng host đã cấu hình, cùng `pnpm exec eslint app/api/v1/links/route.ts` và `tsc --noEmit`.
