# Google login

Trang đăng nhập lấy danh sách provider thật từ `/api/auth/providers`, nên nút Google chỉ hiện khi server có đủ OAuth credentials. Callback nội bộ được giới hạn ở path bắt đầu bằng `/`, và lỗi OAuth trả về được hiển thị trực tiếp trên form.

Verification: endpoint providers có `google`, click nút chuyển tới `accounts.google.com`, callback quay lại `/dashboard`.

Credential login now reads `session.user.isAdmin` after sign-in instead of comparing a hardcoded email, so DB-assigned admin roles also land on `/admin`.
