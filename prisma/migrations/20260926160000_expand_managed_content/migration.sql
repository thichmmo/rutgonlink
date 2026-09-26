ALTER TABLE `PopupTemplate`
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `settings` JSON NULL;

UPDATE `PopupTemplate`
SET `settings` = JSON_OBJECT(
  'shopee', JSON_OBJECT(
    'enabled', true,
    'androidEnabled', true,
    'iosEnabled', true,
    'url', `firstUrl`,
    'delaySeconds', 1,
    'imageUrl', `imageUrl`
  ),
  'tiktok', JSON_OBJECT(
    'enabled', true,
    'androidEnabled', true,
    'iosEnabled', true,
    'url', `secondUrl`,
    'androidUrl', `secondUrl`,
    'iosUrl', `secondUrl`,
    'delaySeconds', 10,
    'imageUrl', `imageUrl`,
    'iosMode', 'desktop'
  ),
  'cooldownMinutes', 30,
  'forceChromeAndroid', false,
  'forceSafariIos', false
)
WHERE `settings` IS NULL;

ALTER TABLE `ManagedPost`
  ADD COLUMN `domainId` VARCHAR(191) NULL,
  ADD COLUMN `sharedDomain` VARCHAR(255) NULL,
  ADD COLUMN `contentFormat` VARCHAR(20) NOT NULL DEFAULT 'plain',
  ADD COLUMN `previewImage` LONGTEXT NULL,
  ADD INDEX `ManagedPost_domainId_idx` (`domainId`),
  ADD INDEX `ManagedPost_sharedDomain_idx` (`sharedDomain`),
  ADD CONSTRAINT `ManagedPost_domainId_fkey` FOREIGN KEY (`domainId`) REFERENCES `Domain` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `ManagedContentBlock` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `contentFormat` VARCHAR(20) NOT NULL DEFAULT 'rich',
  `placement` VARCHAR(10) NOT NULL DEFAULT 'after',
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ManagedContentBlock_userId_placement_sortOrder_idx` (`userId`, `placement`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ManagedContentBlock_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`internalId`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
