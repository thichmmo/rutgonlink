-- AlterTable: thêm cột ogScheduledDisableAt vào bảng Link
-- Dùng IF NOT EXISTS để an toàn khi deploy lặp lại hoặc khi runMigrations() đã chạy trước
ALTER TABLE `Link` ADD COLUMN IF NOT EXISTS `ogScheduledDisableAt` DATETIME(3) NULL;
