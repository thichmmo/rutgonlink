CREATE TABLE `PopupTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `imageUrl` LONGTEXT NULL,
  `firstUrl` TEXT NOT NULL,
  `secondUrl` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `PopupTemplate_userId_idx` (`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PopupTemplate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`internalId`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ManagedPost` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `popupId` VARCHAR(191) NULL,
  `title` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(190) NOT NULL,
  `excerpt` TEXT NULL,
  `content` LONGTEXT NOT NULL,
  `isPublished` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ManagedPost_slug_key` (`slug`),
  INDEX `ManagedPost_userId_idx` (`userId`),
  INDEX `ManagedPost_isPublished_createdAt_idx` (`isPublished`, `createdAt`),
  INDEX `ManagedPost_popupId_idx` (`popupId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ManagedPost_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`internalId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ManagedPost_popupId_fkey` FOREIGN KEY (`popupId`) REFERENCES `PopupTemplate` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
