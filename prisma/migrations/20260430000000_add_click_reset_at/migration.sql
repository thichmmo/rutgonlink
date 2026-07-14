-- AlterTable: thêm cột clickResetAt vào bảng Link
ALTER TABLE `Link` ADD COLUMN IF NOT EXISTS `clickResetAt` DATETIME(3) NULL;
