# Google Drive OAuth origin

Route bắt đầu OAuth Drive dùng origin trung tâm từ `NEXTAUTH_URL` để callback ổn định sau reverse proxy hoặc đổi domain.

Verification: URL Google tạo ra chứa redirect URI `<NEXTAUTH_URL>/api/drive/callback`.

OAuth credentials ưu tiên cấu hình mã hóa từ admin, sau đó mới fallback về environment.
