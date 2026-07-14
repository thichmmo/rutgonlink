-- AlterTable: add sharedDomain column to Link
ALTER TABLE `Link` ADD COLUMN `sharedDomain` VARCHAR(191) NULL;
