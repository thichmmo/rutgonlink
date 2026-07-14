# cPanel artifact preparation

`prepare-cpanel.mjs` chạy sau Next build để đưa `public` và `.next/static` vào đúng vị trí mà standalone server phục vụ. Script đồng thời xóa các file `.env*` khỏi bundle để không upload secret lên hosting.

Verification: `pnpm build:cpanel` pass; `.next/standalone/server.js`, `public`, `.next/static` tồn tại và `.next/standalone/.env` không tồn tại.

`restart-cpanel.sh` tự lấy app root từ vị trí của script thay vì hardcode tài khoản/domain hosting; có thể override bằng biến `APP_DIR`. Script ưu tiên dừng PID giữ port 3001. Nếu CloudLinux ẩn PID cổng, script chỉ fallback sang `npm start`/`next-server` trong process list của chính tài khoản, rồi xác nhận PID mới còn sống trước khi báo thành công.
