-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    ADD COLUMN `adminRole` VARCHAR(191) NULL,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `suspendedAt` DATETIME(3) NULL,
    ADD COLUMN `suspensionReason` VARCHAR(500) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `sessionsRevokedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Domain`
    ADD COLUMN `disabledAt` DATETIME(3) NULL,
    ADD COLUMN `disabledReason` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `Link`
    ADD COLUMN `disabledByAdmin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `adminNote` TEXT NULL,
    ADD COLUMN `moderatedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NULL,
    `adminEmail` VARCHAR(191) NOT NULL,
    `adminRole` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `beforeData` LONGTEXT NULL,
    `afterData` LONGTEXT NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_adminUserId_idx`(`adminUserId`),
    INDEX `AdminAuditLog_action_idx`(`action`),
    INDEX `AdminAuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AdminAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemEvent` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `details` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SystemEvent_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `SystemEvent_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentEvent` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'sepay',
    `externalId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `transferAmount` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `message` TEXT NULL,
    `payload` LONGTEXT NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PaymentEvent_externalId_key`(`externalId`),
    INDEX `PaymentEvent_paymentId_idx`(`paymentId`),
    INDEX `PaymentEvent_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `PaymentEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_status_idx` ON `User`(`status`);

-- CreateIndex
CREATE INDEX `User_adminRole_idx` ON `User`(`adminRole`);

-- AddForeignKey
ALTER TABLE `PaymentEvent` ADD CONSTRAINT `PaymentEvent_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
