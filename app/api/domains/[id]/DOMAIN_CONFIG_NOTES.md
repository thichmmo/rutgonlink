# Custom-domain DNS validation

CNAME được so với hostname lấy từ `NEXTAUTH_URL`; A record vẫn kiểm tra theo `VPS_HOST`.

Verification: domain có CNAME về domain chính hoặc A record về server được đánh dấu hợp lệ.
