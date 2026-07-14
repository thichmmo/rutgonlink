-- Step 1: Add userId to LinkFolder (nullable first)
ALTER TABLE `LinkFolder` ADD COLUMN `userId` VARCHAR(191) NULL;

-- Step 2: Populate userId from Link table
UPDATE `LinkFolder` lf
INNER JOIN `Link` l ON lf.linkId = l.id
SET lf.userId = l.userId;

-- Step 3: Make userId NOT NULL and add foreign key
ALTER TABLE `LinkFolder` MODIFY `userId` VARCHAR(191) NOT NULL;
ALTER TABLE `LinkFolder` ADD CONSTRAINT `LinkFolder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Create LinkFolderAssignment table
CREATE TABLE `LinkFolderAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `folderId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 5: Migrate existing relationships to assignment table
INSERT INTO `LinkFolderAssignment` (`id`, `linkId`, `folderId`, `order`)
SELECT UUID(), `linkId`, `id`, `order` FROM `LinkFolder`;

-- Step 6: Create indexes and constraints for LinkFolderAssignment
CREATE UNIQUE INDEX `LinkFolderAssignment_linkId_folderId_key` ON `LinkFolderAssignment`(`linkId`, `folderId`);
CREATE INDEX `LinkFolderAssignment_linkId_idx` ON `LinkFolderAssignment`(`linkId`);
ALTER TABLE `LinkFolderAssignment` ADD CONSTRAINT `LinkFolderAssignment_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `Link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LinkFolderAssignment` ADD CONSTRAINT `LinkFolderAssignment_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `LinkFolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 7: Drop foreign key from LinkFolder (must drop FK before dropping column)
ALTER TABLE `LinkFolder` DROP FOREIGN KEY `LinkFolder_linkId_fkey`;

-- Step 8: Drop linkId column from LinkFolder (indexes will be auto-dropped)
ALTER TABLE `LinkFolder` DROP COLUMN `linkId`;

-- Step 9: Add index on userId for LinkFolder
CREATE INDEX `LinkFolder_userId_idx` ON `LinkFolder`(`userId`);
