# FB debug cron cPanel

`fb-debug-cron.ts` giữ logic xử lý hiện tại nhưng export hai tác vụ để API cron gọi trực tiếp. File không còn timer `setTimeout`, tránh bị Passenger tạm dừng khi ứng dụng ngủ.

`prisma.ts` yêu cầu `DATABASE_URL` hợp lệ và dừng sớm nếu chưa cấu hình, thay vì âm thầm kết nối tới địa chỉ mẫu.

`api-v1-auth.ts` mặc định dùng `rutgonlink.site`; production nên khai báo rõ `API_ALLOWED_HOST`.

Đã kiểm tra file bằng scoped ESLint từ project root.
