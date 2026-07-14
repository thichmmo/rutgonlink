# Google Drive OAuth callback

Trao đổi authorization code dùng cùng origin `NEXTAUTH_URL` với route connect, tránh redirect URI mismatch.

Verification: callback URI gửi khi đổi code khớp URI đã đăng ký trên Google Cloud Console.
