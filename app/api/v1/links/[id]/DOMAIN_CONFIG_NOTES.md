# Domain-aware link details

Response xem/sửa link dùng helper `buildShortUrl`, tránh trả về domain production hardcode.

Verification: `GET/PATCH /api/v1/links/:id` trả `shortUrl` theo `NEXTAUTH_URL`.
