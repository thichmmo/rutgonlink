# Redirect domain handling

Fallback hết hạn và proxy ảnh Open Graph dùng origin trung tâm từ `NEXTAUTH_URL`; custom short-link domain vẫn giữ hostname của request để tra link.

Verification: link hết hạn quay về domain chính và OG ảnh base64 đi qua API của domain chính.
