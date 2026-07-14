-- AlterTable Click: add osVersion and deviceModel columns
ALTER TABLE `Click` ADD COLUMN `osVersion` VARCHAR(191) NULL;
ALTER TABLE `Click` ADD COLUMN `deviceModel` VARCHAR(191) NULL;
