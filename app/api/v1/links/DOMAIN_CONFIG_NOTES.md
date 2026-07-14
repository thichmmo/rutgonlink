# Domain-aware API responses

Các response tạo/list link dùng origin từ `NEXTAUTH_URL`; kiểm tra chống rút gọn chính domain ứng dụng cũng dùng hostname trung tâm.

Verification: gọi `GET/POST /api/v1/links` và kiểm tra `shortUrl` bắt đầu bằng domain cấu hình.
