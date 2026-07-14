-- ============================================================
-- Rutgonlink schema for cPanel MySQL/MariaDB
-- Generated from prisma/schema.prisma with Prisma 7, then adjusted for cPanel.
-- Every table explicitly uses InnoDB/DYNAMIC to support utf8mb4 composite indexes.
-- Recommended server: MySQL 5.7+ or MariaDB 10.2+ with InnoDB enabled.
-- Contains 32 empty tables; application data is not included.
--
-- Import this file into an EMPTY database using cPanel/phpMyAdmin.
-- Do not configure DATABASE_URL to this file: DATABASE_URL must point
-- to the MySQL/MariaDB database where this script was imported.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+07:00';
SET default_storage_engine = InnoDB;

-- CreateTable
CREATE TABLE `User` (
    `internalId` VARCHAR(191) NOT NULL,
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `adminRole` VARCHAR(191) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `suspendedAt` DATETIME(3) NULL,
    `suspensionReason` VARCHAR(500) NULL,
    `deletedAt` DATETIME(3) NULL,
    `sessionsRevokedAt` DATETIME(3) NULL,
    `plan` VARCHAR(191) NOT NULL DEFAULT 'free',
    `planExpiresAt` DATETIME(3) NULL,
    `apiKey` VARCHAR(191) NULL,
    `googleDriveRefreshToken` TEXT NULL,
    `googleDriveEmail` VARCHAR(191) NULL,
    `googleDriveFolderId` VARCHAR(191) NULL,
    `fbDebugIntervalMinutes` INTEGER NOT NULL DEFAULT 20,
    `fbDebugMinClicksPerDay` INTEGER NOT NULL DEFAULT 0,
    `fbDebugAllActiveLinks` BOOLEAN NOT NULL DEFAULT false,
    `fbDebugDailyAllActiveLinks` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_apiKey_key`(`apiKey`),
    UNIQUE INDEX `User_id_key`(`id`),
    INDEX `User_status_idx`(`status`),
    INDEX `User_adminRole_idx`(`adminRole`),
    PRIMARY KEY (`internalId`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subscription_userId_idx`(`userId`),
    INDEX `Subscription_status_idx`(`status`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `transactionID` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_transactionID_key`(`transactionID`),
    UNIQUE INDEX `Payment_content_key`(`content`),
    INDEX `Payment_userId_idx`(`userId`),
    INDEX `Payment_content_idx`(`content`),
    INDEX `Payment_transactionID_idx`(`transactionID`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NoteFolder` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#6366f1',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NoteFolder_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Note` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `folderId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `starred` BOOLEAN NOT NULL DEFAULT false,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `publicToken` VARCHAR(191) NULL,
    `publicPassword` VARCHAR(191) NULL,
    `driveFileId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Note_publicToken_key`(`publicToken`),
    INDEX `Note_userId_idx`(`userId`),
    INDEX `Note_folderId_idx`(`folderId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NoteShare` (
    `id` VARCHAR(191) NOT NULL,
    `noteId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `permission` VARCHAR(191) NOT NULL DEFAULT 'viewer',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NoteShare_userId_idx`(`userId`),
    INDEX `NoteShare_noteId_idx`(`noteId`),
    UNIQUE INDEX `NoteShare_noteId_userId_key`(`noteId`, `userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Domain` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `disabledAt` DATETIME(3) NULL,
    `disabledReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Domain_domain_key`(`domain`),
    INDEX `Domain_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Link` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `domainId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `workspaceId` VARCHAR(191) NULL,
    `shortCode` VARCHAR(191) NOT NULL,
    `originalUrl` TEXT NOT NULL,
    `title` VARCHAR(191) NULL,
    `sharedDomain` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `maxClicks` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `disabledByAdmin` BOOLEAN NOT NULL DEFAULT false,
    `adminNote` TEXT NULL,
    `moderatedAt` DATETIME(3) NULL,
    `ogEnabled` BOOLEAN NOT NULL DEFAULT true,
    `ogAutoReset` BOOLEAN NOT NULL DEFAULT false,
    `ogTitle` VARCHAR(191) NULL,
    `ogDescription` TEXT NULL,
    `ogImage` LONGTEXT NULL,
    `deepLinkIos` TEXT NULL,
    `deepLinkAndroid` TEXT NULL,
    `lastFbDebug` DATETIME(3) NULL,
    `ogScheduledDisableAt` DATETIME(3) NULL,
    `clickResetAt` DATETIME(3) NULL,
    `useFolderRotation` BOOLEAN NOT NULL DEFAULT false,
    `folderRotationStartDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Link_shortCode_key`(`shortCode`),
    INDEX `Link_domainId_fkey`(`domainId`),
    INDEX `Link_userId_fkey`(`userId`),
    INDEX `Link_categoryId_idx`(`categoryId`),
    INDEX `Link_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FolderGroup` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FolderGroup_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LinkFolder` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `folderGroupId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `urls` TEXT NOT NULL,
    `order` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LinkFolder_userId_idx`(`userId`),
    INDEX `LinkFolder_folderGroupId_idx`(`folderGroupId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LinkFolderAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `folderId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,

    INDEX `LinkFolderAssignment_linkId_idx`(`linkId`),
    UNIQUE INDEX `LinkFolderAssignment_linkId_folderId_key`(`linkId`, `folderId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#6366f1',
    `folderGroupId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Category_userId_idx`(`userId`),
    INDEX `Category_folderGroupId_idx`(`folderGroupId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FbToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `token` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unknown',
    `lastChecked` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FbToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

    INDEX `FbDebugJob_userId_idx`(`userId`),
    INDEX `FbDebugJob_status_nextRunAt_idx`(`status`, `nextRunAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

    INDEX `FbDebugJobItem_jobId_status_order_idx`(`jobId`, `status`, `order`),
    INDEX `FbDebugJobItem_linkId_idx`(`linkId`),
    UNIQUE INDEX `FbDebugJobItem_jobId_linkId_key`(`jobId`, `linkId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LanguageRule` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `languageCode` VARCHAR(191) NOT NULL,
    `redirectUrl` TEXT NOT NULL,

    INDEX `LanguageRule_linkId_idx`(`linkId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Click` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `device` VARCHAR(191) NULL,
    `deviceModel` VARCHAR(191) NULL,
    `browser` VARCHAR(191) NULL,
    `os` VARCHAR(191) NULL,
    `osVersion` VARCHAR(191) NULL,
    `referer` VARCHAR(191) NULL,
    `language` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Click_linkId_fkey`(`linkId`),
    INDEX `Click_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceRule` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `deviceType` VARCHAR(191) NOT NULL,
    `redirectUrl` TEXT NOT NULL,

    INDEX `DeviceRule_linkId_fkey`(`linkId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CountryRule` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `countryCode` VARCHAR(191) NOT NULL,
    `redirectUrl` TEXT NOT NULL,

    INDEX `CountryRule_linkId_fkey`(`linkId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BioPage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `avatar` LONGTEXT NULL,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'default',
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BioPage_username_key`(`username`),
    INDEX `BioPage_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BioLink` (
    `id` VARCHAR(191) NOT NULL,
    `bioPageId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `icon` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BioLink_bioPageId_idx`(`bioPageId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workspace` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Workspace_slug_key`(`slug`),
    INDEX `Workspace_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkspaceMember` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'member',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkspaceMember_userId_idx`(`userId`),
    INDEX `WorkspaceMember_workspaceId_idx`(`workspaceId`),
    UNIQUE INDEX `WorkspaceMember_workspaceId_userId_key`(`workspaceId`, `userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `site` VARCHAR(20) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `ip` VARCHAR(45) NULL,
    `country` VARCHAR(2) NULL,
    `device` VARCHAR(20) NULL,
    `browser` VARCHAR(50) NULL,
    `os` VARCHAR(50) NULL,
    `userAgent` VARCHAR(500) NULL,
    `referer` VARCHAR(500) NULL,
    `userId` VARCHAR(191) NULL,
    `userEmail` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `request_logs_site_idx`(`site`),
    INDEX `request_logs_ip_idx`(`ip`),
    INDEX `request_logs_userId_idx`(`userId`),
    INDEX `request_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AppSetting_key_key`(`key`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `PhimPageVisit` (
    `id` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `userAgent` VARCHAR(500) NULL,
    `device` VARCHAR(20) NULL,
    `browser` VARCHAR(50) NULL,
    `os` VARCHAR(50) NULL,
    `referer` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PhimPageVisit_ip_idx`(`ip`),
    INDEX `PhimPageVisit_createdAt_idx`(`createdAt`),
    INDEX `PhimPageVisit_device_idx`(`device`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhimMovieClick` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NULL,
    `ip` VARCHAR(45) NULL,
    `device` VARCHAR(20) NULL,
    `browser` VARCHAR(50) NULL,
    `os` VARCHAR(50) NULL,
    `referer` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PhimMovieClick_linkId_idx`(`linkId`),
    INDEX `PhimMovieClick_ip_idx`(`ip`),
    INDEX `PhimMovieClick_createdAt_idx`(`createdAt`),
    INDEX `PhimMovieClick_device_idx`(`device`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhimRedirectLink` (
    `id` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `label` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PhimRedirectLink_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhimRedirectClick` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NULL,
    `ip` VARCHAR(45) NULL,
    `device` VARCHAR(20) NULL,
    `browser` VARCHAR(50) NULL,
    `os` VARCHAR(50) NULL,
    `referer` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PhimRedirectClick_linkId_idx`(`linkId`),
    INDEX `PhimRedirectClick_createdAt_idx`(`createdAt`),
    INDEX `PhimRedirectClick_device_idx`(`device`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentEvent` ADD CONSTRAINT `PaymentEvent_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteFolder` ADD CONSTRAINT `NoteFolder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `NoteFolder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteShare` ADD CONSTRAINT `NoteShare_noteId_fkey` FOREIGN KEY (`noteId`) REFERENCES `Note`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NoteShare` ADD CONSTRAINT `NoteShare_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Domain` ADD CONSTRAINT `Domain_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Link` ADD CONSTRAINT `Link_domainId_fkey` FOREIGN KEY (`domainId`) REFERENCES `Domain`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Link` ADD CONSTRAINT `Link_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Link` ADD CONSTRAINT `Link_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Link` ADD CONSTRAINT `Link_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FolderGroup` ADD CONSTRAINT `FolderGroup_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LinkFolder` ADD CONSTRAINT `LinkFolder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LinkFolder` ADD CONSTRAINT `LinkFolder_folderGroupId_fkey` FOREIGN KEY (`folderGroupId`) REFERENCES `FolderGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LinkFolderAssignment` ADD CONSTRAINT `LinkFolderAssignment_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `Link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LinkFolderAssignment` ADD CONSTRAINT `LinkFolderAssignment_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `LinkFolder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_folderGroupId_fkey` FOREIGN KEY (`folderGroupId`) REFERENCES `FolderGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FbToken` ADD CONSTRAINT `FbToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FbDebugJob` ADD CONSTRAINT `FbDebugJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FbDebugJobItem` ADD CONSTRAINT `FbDebugJobItem_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `FbDebugJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FbDebugJobItem` ADD CONSTRAINT `FbDebugJobItem_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `Link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LanguageRule` ADD CONSTRAINT `LanguageRule_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `Link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Click` ADD CONSTRAINT `Click_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `Link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceRule` ADD CONSTRAINT `DeviceRule_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `Link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CountryRule` ADD CONSTRAINT `CountryRule_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `Link`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BioPage` ADD CONSTRAINT `BioPage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BioLink` ADD CONSTRAINT `BioLink_bioPageId_fkey` FOREIGN KEY (`bioPageId`) REFERENCES `BioPage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workspace` ADD CONSTRAINT `Workspace_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhimRedirectClick` ADD CONSTRAINT `PhimRedirectClick_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `PhimRedirectLink`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;

-- Import complete: configure DATABASE_URL with the cPanel database credentials.
