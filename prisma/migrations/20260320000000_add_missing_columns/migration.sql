-- AlterTable Click: add language column
ALTER TABLE `Click` ADD COLUMN `language` VARCHAR(191) NULL;

-- AlterTable Click: add createdAt index
CREATE INDEX `Click_createdAt_idx` ON `Click`(`createdAt`);

-- AlterTable Link: add og fields
ALTER TABLE `Link` ADD COLUMN `ogTitle` VARCHAR(191) NULL;
ALTER TABLE `Link` ADD COLUMN `ogDescription` TEXT NULL;
ALTER TABLE `Link` ADD COLUMN `ogImage` LONGTEXT NULL;

-- AlterTable User: allow null password
ALTER TABLE `User` MODIFY COLUMN `password` VARCHAR(191) NULL;
