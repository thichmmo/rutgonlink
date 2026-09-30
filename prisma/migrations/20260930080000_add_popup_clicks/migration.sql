CREATE TABLE `PopupClick` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(100) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `postId` VARCHAR(191) NOT NULL,
  `popupId` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(10) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PopupClick_eventId_key` (`eventId`),
  INDEX `PopupClick_userId_createdAt_idx` (`userId`, `createdAt`),
  INDEX `PopupClick_postId_createdAt_idx` (`postId`, `createdAt`),
  INDEX `PopupClick_popupId_createdAt_idx` (`popupId`, `createdAt`),
  CONSTRAINT `PopupClick_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`internalId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PopupClick_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ManagedPost` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PopupClick_popupId_fkey` FOREIGN KEY (`popupId`) REFERENCES `PopupTemplate` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
