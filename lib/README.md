# FB debug cron cPanel

`fb-debug-cron.ts` giữ logic xử lý hiện tại nhưng export hai tác vụ để API cron gọi trực tiếp. File không còn timer `setTimeout`, tránh bị Passenger tạm dừng khi ứng dụng ngủ.

`prisma.ts` yêu cầu `DATABASE_URL` hợp lệ và dừng sớm nếu chưa cấu hình, thay vì âm thầm kết nối tới địa chỉ mẫu.

`site-config.ts` chuẩn hóa `NEXTAUTH_URL`, sinh URL tuyệt đối và xác định domain chính/alias. `api-v1-auth.ts`, cron, Google Drive và các route tạo short URL đều dùng cấu hình này; không còn cần `API_ALLOWED_HOST` riêng.

Ở production, `site-config.ts` fallback về `https://rutgonlink.site` nếu biến build-time bị thiếu, malformed hoặc dùng protocol không hỗ trợ để metadata, canonical và sitemap không bị đóng cứng bằng hostname mẫu/localhost. Local development vẫn fallback về `http://localhost:3000`.

`google-oauth-config.ts` ưu tiên OAuth credentials mã hóa trong `AppSetting`, fallback về biến môi trường và không bao giờ trả Client Secret qua API. `auth-options.ts` dựng provider Google theo từng auth request, đồng thời upsert user theo email để callback lặp không lỗi unique. `auth-redirect.ts` chặn callback path ngoài origin và chuẩn hóa thông báo lỗi OAuth.

`admin-auth.ts` tập trung role/permission với `ADMIN_EMAIL` làm owner dự phòng. `admin-audit.ts` ghi lại mọi mutation và tự redact key nhạy cảm. `billing.ts` dùng chung quy tắc cộng dồn hạn gói cho webhook lẫn thao tác admin; `system-events.ts` lưu heartbeat/lỗi vận hành.

`request-log-filter.ts` chặn thêm `facebookexternalhit`, `facebookcatalog`, `meta-externalagent`, `meta-externalfetcher`, `meta-webindexer` và `whatsapp` để luồng quét song song của Facebook/Meta không kích hoạt giải mã JWT hoặc gửi request-log nội bộ từ `proxy.ts`. `shared-domains.ts` đặt `ca33newss.xyz` (Tranco Top-1M `#310,405`, parked lên `public_html/rutgonlink.site` qua Cloudflare + AutoSSL) làm shared domain ưu tiên, kèm các domain dự phòng không nằm trong PSL (`6739dd4f.nip.io`, `tin24h-6739dd4f.nip.io`, `103-57-221-79.sslip.io`) để bình luận dạng `facebook.com/l.php?u=<domain>/...` vượt qua bộ lọc Sentry `1404006` của Meta. Kiểm tra bằng `node scripts/test-shared-domain-https.cjs` và ESLint.
