# Rutgonlink — source code dùng trên hosting

Đây là repository chứa source code của `rutgonlink.site`, được chuẩn bị để build và triển khai trên hosting cPanel dùng Node.js/Passenger.

Các thư mục sinh tự động như `node_modules` và `.next` không được lưu trên GitHub. Repository chỉ cung cấp `.env.example`; secret production phải được cấu hình trực tiếp trên hosting và không được commit.

## Đổi domain

Domain chính chỉ lấy từ một biến môi trường:

```env
NEXTAUTH_URL=https://your-domain.com
```

API, short URL, metadata, OAuth callback, cron và kiểm tra host đều dùng giá trị này. Nếu cần giữ domain cũ làm alias cho toàn bộ giao diện, khai báo thêm `APP_ALLOWED_HOSTS=old-domain.com,www.old-domain.com`; custom domain rút gọn không cần thêm vào đây.

Sau khi đổi `NEXTAUTH_URL`, cập nhật DNS/SSL và domain trong cPanel rồi build/restart ứng dụng. Không cần tìm và sửa domain trong source.

## Đăng nhập Google

1. Tạo OAuth Client loại **Web application** trong Google Cloud Console.
2. Thêm **Authorized JavaScript origin**: `https://your-domain.com`.
3. Thêm hai **Authorized redirect URI**:

```text
https://your-domain.com/api/auth/callback/google
https://your-domain.com/api/drive/callback
```

4. Đăng nhập owner và nhập Client ID/Secret tại `/admin/oauth`. Secret được mã hóa trong database và có hiệu lực ngay cho đăng nhập Google lẫn Google Drive.

Biến môi trường vẫn được hỗ trợ làm fallback khi chưa có cấu hình trong admin:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Google chỉ xuất hiện trên trang đăng nhập/đăng ký khi có đủ credentials từ admin hoặc environment. Kiểm tra nhanh `GET /api/auth/providers`; response phải có provider `google`.

SePay webhook yêu cầu cấu hình `SEPAY_WEBHOOK_SECRET` trên hosting và gửi cùng giá trị bằng `Authorization: Bearer ...` hoặc header `x-sepay-secret`.

## Admin operations

`/admin` gồm tổng quan, user detail/lifecycle, link/domain moderation, payment/subscription/SePay reconciliation, traffic, immutable audit log và system health. `ADMIN_EMAIL` là owner dự phòng; các user khác có thể được cấp role `support`, `finance`, `ops` hoặc `viewer` trong trang chi tiết user. Mọi mutation quan trọng yêu cầu lý do và ghi `AdminAuditLog`.

## Database cPanel

`database.sql` là schema MySQL/MariaDB gồm 32 bảng, được sinh trực tiếp từ `prisma/schema.prisma`. Đây là script import, không phải file database mà Node.js có thể mở trực tiếp.

1. Trong cPanel → **MySQL Databases**, tạo database và user rồi cấp **ALL PRIVILEGES**.
2. Trong phpMyAdmin, chọn database trống vừa tạo và import `database.sql`.
3. Sửa `.env` và biến môi trường trong **Setup Node.js App**:

```env
DATABASE_URL="mysql://CPANEL_DB_USER:URL_ENCODED_PASSWORD@localhost:3306/CPANEL_DB_NAME"
```

cPanel thường tự thêm prefix tài khoản vào tên database/user. Nếu mật khẩu có ký tự `@`, `:`, `/`, `#`, `?` hoặc `%`, phải URL-encode phần mật khẩu.

Không đặt `DATABASE_URL=file:./database.sql`. Sau khi import schema này, không chạy `prisma migrate deploy` lần đầu vì database không có lịch sử `_prisma_migrations`; dùng chính `database.sql` cho lần khởi tạo.

Nếu lần import cũ đã dừng với lỗi `#1071`, database đang ở trạng thái tạo dở. Hãy xóa/tạo lại database trống (hoặc xóa toàn bộ bảng đã tạo dở), rồi import lại file `database.sql`. Bản sửa ép cả 32 bảng dùng `InnoDB` + `ROW_FORMAT=DYNAMIC`.

Với database đang chạy từ bản trước, **phải** áp dụng `prisma/migrations/20260714000000_add_admin_operations/migration.sql` trước khi restart source admin mới. Database cPanel đã khởi tạo bằng `database.sql` thường không có lịch sử Prisma migration, vì vậy import trực tiếp file migration này một lần bằng phpMyAdmin thay vì chạy toàn bộ `prisma migrate deploy`. Migration chỉ thêm cột/bảng/index và giữ nguyên dữ liệu hiện có.

Sau admin migration, áp dụng `prisma/migrations/20260714110000_add_numeric_user_id/migration.sql` để đổi cột `User.id` thành số tự tăng. CUID cũ được giữ ở `User.internalId` làm khóa quan hệ, nên không phải viết lại foreign key hoặc session hiện có.

## Các file cPanel chính

```text
rutgonlink/
├── next.config.ts
├── instrumentation.ts
├── passenger_entry.js
├── database.sql
├── lib/fb-debug-cron.ts
└── app/api/cron/run/route.ts
```

## Thay đổi

- Bật Next.js standalone build.
- Dùng `passenger_entry.js` làm Application startup file trong cPanel.
- Bỏ timer cron nền khỏi `instrumentation.ts` và `lib/fb-debug-cron.ts`.
- Không tự sửa schema lúc Passenger khởi động; schema được import rõ ràng từ `database.sql`.
- Cung cấp `GET/POST /api/cron/run`, bảo vệ bằng biến môi trường `CRON_SECRET`.

## Build và upload

Next.js 16.2.10 cần Node.js `>=20.9.0`.

```bash
pnpm install
pnpm build:cpanel
```

`build:cpanel` build ứng dụng, copy static/public vào standalone và xóa `.env*` khỏi artifact. Secret phải cấu hình trong **Setup Node.js App**, không upload trong bundle.

Để standalone server phục vụ đúng static/public, cấu trúc trên cPanel phải là:

```text
<app_root>/
├── passenger_entry.js
└── .next/standalone/
    ├── server.js
    ├── public/              # copy từ public/
    └── .next/static/        # copy từ .next/static/
```

Trong cPanel, đặt Application startup file là `passenger_entry.js`. Khai báo toàn bộ biến bắt buộc từ `.env.example` trong giao diện Node.js App rồi restart ứng dụng.

Workflow Docker/VPS trong `.github/workflows/deploy.yml` chỉ chạy thủ công qua `workflow_dispatch`; push source hosting không tự động triển khai lên VPS. Nếu dùng workflow này, cấu hình các GitHub Secrets `APP_DOMAIN`, `DOCKERHUB_TOKEN`, `VPS_HOST` và `VPS_PASSWORD` trước khi chạy.

## cPanel Cron Job

Chạy mỗi 5 phút:

```bash
curl -fsS -H "x-cron-secret: YOUR_SECRET" "$NEXTAUTH_URL/api/cron/run" >/dev/null
```

## Verification

Đã chạy thành công:

```bash
pnpm exec eslint next.config.ts instrumentation.ts lib/prisma.ts lib/fb-debug-cron.ts app/api/cron/run/route.ts passenger_entry.js scripts/prepare-cpanel.mjs
pnpm exec tsc --noEmit --pretty false --incremental false --project tsconfig.json
pnpm exec prisma validate --config prisma.config.ts
pnpm build:cpanel
```

Admin release còn được kiểm tra bằng scoped ESLint cho `app/admin`, `app/api/admin` và các helper auth/billing; smoke test xác nhận anonymous admin API trả `403`, `/admin` trả `404`, và SePay secret sai trả `401`.

Dependency security: Next.js/NextAuth được giữ ở bản vá đã audit; `pnpm.overrides` khóa các dependency gián tiếp có advisory nhưng chưa được package cha nâng phiên bản. Sau khi đổi dependency, chạy lại `pnpm audit --prod` và production build.

Kết quả: schema hợp lệ, `database.sql` khớp 32 model Prisma, build standalone thành công, entry Passenger trả HTTP 200, cron không secret trả HTTP 401, static/public phục vụ thành công và artifact không chứa `.env`.

## SEO production

Build cPanel phải đặt `NEXTAUTH_URL=https://rutgonlink.site` để title, canonical, Open Graph, robots và sitemap dùng đúng origin. Release SEO hợp nhất `http`/`www` về HTTPS apex, tạo `/sitemap.xml`, thêm metadata riêng cho blog và không đưa route đăng nhập/dashboard/API vào sitemap.
