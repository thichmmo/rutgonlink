# Domain-aware API docs

Base URL, ví dụ short URL và thông báo host trong tài liệu API được sinh từ `NEXTAUTH_URL` qua `lib/site-config.ts`. Đổi domain không cần sửa các code sample thủ công.

Verification: build với một `NEXTAUTH_URL` thử nghiệm và kiểm tra `/api-docs` chỉ hiển thị origin đó.
