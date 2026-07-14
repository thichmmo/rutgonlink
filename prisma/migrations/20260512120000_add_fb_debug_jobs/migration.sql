-- CreateTable
CREATE TABLE `FbDebugJob` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `total` INTEGER NOT NULL DEFAULT 0,
    `processed` INTEGER NOT NULL DEFAULT 0,
    `success` INTEGER NOT NULL DEFAULT 0,
    `failed` INTEGER NOT NULL DEFAULT 0,
    `batchLimit` INTEGER NOT NULL DEFAULT 10,
    `nextRunAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FbDebugJobItem` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `shortUrl` TEXT NULL,
    `message` TEXT NULL,
    `errorCode` INTEGER NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `FbDebugJob_userId_idx` ON `FbDebugJob`(`userId`);

-- CreateIndex
CREATE INDEX `FbDebugJob_status_nextRunAt_idx` ON `FbDebugJob`(`status`, `nextRunAt`);

-- CreateIndex
CREATE UNIQUE INDEX `FbDebugJobItem_jobId_linkId_key` ON `FbDebugJobItem`(`jobId`, `linkId`);

-- CreateIndex
CREATE INDEX `FbDebugJobItem_jobId_status_order_idx` ON `FbDebugJobItem`(`jobId`, `status`, `order`);

-- CreateIndex
CREATE INDEX `FbDebugJobItem_linkId_idx` ON `FbDebugJobItem`(`linkId`);

-- AddForeignKey
ALTER TABLE `FbDebugJob` ADD CONSTRAINT `FbDebugJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FbDebugJobItem` ADD CONSTRAINT `FbDebugJobItem_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `FbDebugJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FbDebugJobItem` ADD CONSTRAINT `FbDebugJobItem_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `Link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
