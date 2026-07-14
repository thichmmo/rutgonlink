# Rutgonlink — source code dùng trên hosting

Đây là repository chứa source code của `rutgonlink.site`, được chuẩn bị để build và triển khai trên hosting cPanel dùng Node.js/Passenger.

Các thư mục sinh tự động như `node_modules` và `.next` không được lưu trên GitHub. Repository chỉ cung cấp `.env.example`; secret production phải được cấu hình trực tiếp trên hosting và không được commit.

## Database cPanel

`database.sql` là schema MySQL/MariaDB gồm 29 bảng, được sinh trực tiếp từ `prisma/schema.prisma`. Đây là script import, không phải file database mà Node.js có thể mở trực tiếp.

1. Trong cPanel → **MySQL Databases**, tạo database và user rồi cấp **ALL PRIVILEGES**.
2. Trong phpMyAdmin, chọn database trống vừa tạo và import `database.sql`.
3. Sửa `.env` và biến môi trường trong **Setup Node.js App**:

```env
DATABASE_URL="mysql://CPANEL_DB_USER:URL_ENCODED_PASSWORD@localhost:3306/CPANEL_DB_NAME"
```

cPanel thường tự thêm prefix tài khoản vào tên database/user. Nếu mật khẩu có ký tự `@`, `:`, `/`, `#`, `?` hoặc `%`, phải URL-encode phần mật khẩu.

Không đặt `DATABASE_URL=file:./database.sql`. Sau khi import schema này, không chạy `prisma migrate deploy` lần đầu vì database không có lịch sử `_prisma_migrations`; dùng chính `database.sql` cho lần khởi tạo.

Nếu lần import cũ đã dừng với lỗi `#1071`, database đang ở trạng thái tạo dở. Hãy xóa/tạo lại database trống (hoặc xóa toàn bộ bảng đã tạo dở), rồi import lại file `database.sql`. Bản sửa ép cả 29 bảng dùng `InnoDB` + `ROW_FORMAT=DYNAMIC`.

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

Next.js 16.1.7 cần Node.js `>=20.9.0`.

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

Workflow Docker/VPS trong `.github/workflows/deploy.yml` chỉ chạy thủ công qua `workflow_dispatch`; push source hosting không tự động triển khai lên VPS. Nếu dùng workflow này, cấu hình các GitHub Secrets `DOCKERHUB_TOKEN`, `VPS_HOST` và `VPS_PASSWORD` trước khi chạy.

## cPanel Cron Job

Chạy mỗi 5 phút:

```bash
curl -fsS -H "x-cron-secret: YOUR_SECRET" "https://rutgonlink.site/api/cron/run" >/dev/null
```

## Verification

Đã chạy thành công:

```bash
pnpm exec eslint next.config.ts instrumentation.ts lib/prisma.ts lib/fb-debug-cron.ts app/api/cron/run/route.ts passenger_entry.js scripts/prepare-cpanel.mjs
pnpm exec tsc --noEmit --pretty false --incremental false --project tsconfig.json
pnpm exec prisma validate --config prisma.config.ts
pnpm build:cpanel
```

Kết quả: schema hợp lệ, `database.sql` khớp 29 model Prisma, build standalone thành công, entry Passenger trả HTTP 200, cron không secret trả HTTP 401, static/public phục vụ thành công và artifact không chứa `.env`.
