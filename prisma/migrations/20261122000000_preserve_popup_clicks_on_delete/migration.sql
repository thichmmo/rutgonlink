ALTER TABLE `PopupClick` DROP FOREIGN KEY `PopupClick_postId_fkey`;
ALTER TABLE `PopupClick` DROP FOREIGN KEY `PopupClick_popupId_fkey`;

ALTER TABLE `PopupClick`
  MODIFY `postId` VARCHAR(191) NULL,
  MODIFY `popupId` VARCHAR(191) NULL;

ALTER TABLE `PopupClick`
  ADD CONSTRAINT `PopupClick_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ManagedPost` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PopupClick_popupId_fkey` FOREIGN KEY (`popupId`) REFERENCES `PopupTemplate` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
