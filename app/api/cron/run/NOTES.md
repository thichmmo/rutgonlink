# Web-triggered cron

Endpoint `GET/POST /api/cron/run` xác thực `CRON_SECRET`, sau đó chạy scheduled actions và FB debug batch tuần tự. HTTP `207` cho biết có ít nhất một tác vụ thất bại.

Mỗi lần chạy ghi thêm `SystemEvent` heartbeat cho Admin System Health. Nếu riêng bước ghi monitoring lỗi, cron chỉ log lỗi và vẫn trả kết quả thật của các tác vụ.

Đã kiểm tra file bằng scoped ESLint từ project root; cần gọi thử với secret thật sau khi deploy.
