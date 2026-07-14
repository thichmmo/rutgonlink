-- CreateTable
CREATE TABLE `FolderGroup` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FolderGroup_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `LinkFolder` ADD COLUMN `folderGroupId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Category` ADD COLUMN `folderGroupId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `LinkFolder_folderGroupId_idx` ON `LinkFolder`(`folderGroupId`);

-- CreateIndex
CREATE INDEX `Category_folderGroupId_idx` ON `Category`(`folderGroupId`);

-- AddForeignKey
ALTER TABLE `LinkFolder` ADD CONSTRAINT `LinkFolder_folderGroupId_fkey` FOREIGN KEY (`folderGroupId`) REFERENCES `FolderGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_folderGroupId_fkey` FOREIGN KEY (`folderGroupId`) REFERENCES `FolderGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FolderGroup` ADD CONSTRAINT `FolderGroup_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
