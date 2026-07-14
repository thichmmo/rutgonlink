# FB debug cron cPanel

`fb-debug-cron.ts` giữ logic xử lý hiện tại nhưng export hai tác vụ để API cron gọi trực tiếp. File không còn timer `setTimeout`, tránh bị Passenger tạm dừng khi ứng dụng ngủ.

`prisma.ts` yêu cầu `DATABASE_URL` hợp lệ và dừng sớm nếu chưa cấu hình, thay vì âm thầm kết nối tới địa chỉ mẫu.

`site-config.ts` chuẩn hóa `NEXTAUTH_URL`, sinh URL tuyệt đối và xác định domain chính/alias. `api-v1-auth.ts`, cron, Google Drive và các route tạo short URL đều dùng cấu hình này; không còn cần `API_ALLOWED_HOST` riêng.

`auth-options.ts` chỉ bật Google khi có đủ `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`, đồng thời upsert user theo email để callback lặp không lỗi unique. `auth-redirect.ts` chặn callback path ngoài origin và chuẩn hóa thông báo lỗi OAuth.

Đã kiểm tra file bằng scoped ESLint từ project root.
