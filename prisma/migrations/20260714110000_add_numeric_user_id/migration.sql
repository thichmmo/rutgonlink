-- Preserve the existing CUID as the internal relation key and expose a sequential user ID.
ALTER TABLE `Subscription` DROP FOREIGN KEY `Subscription_userId_fkey`;
ALTER TABLE `Payment` DROP FOREIGN KEY `Payment_userId_fkey`;
ALTER TABLE `NoteFolder` DROP FOREIGN KEY `NoteFolder_userId_fkey`;
ALTER TABLE `Note` DROP FOREIGN KEY `Note_userId_fkey`;
ALTER TABLE `NoteShare` DROP FOREIGN KEY `NoteShare_userId_fkey`;
ALTER TABLE `Domain` DROP FOREIGN KEY `Domain_userId_fkey`;
ALTER TABLE `Link` DROP FOREIGN KEY `Link_userId_fkey`;
ALTER TABLE `FolderGroup` DROP FOREIGN KEY `FolderGroup_userId_fkey`;
ALTER TABLE `LinkFolder` DROP FOREIGN KEY `LinkFolder_userId_fkey`;
ALTER TABLE `Category` DROP FOREIGN KEY `Category_userId_fkey`;
ALTER TABLE `FbToken` DROP FOREIGN KEY `FbToken_userId_fkey`;
ALTER TABLE `FbDebugJob` DROP FOREIGN KEY `FbDebugJob_userId_fkey`;
ALTER TABLE `BioPage` DROP FOREIGN KEY `BioPage_userId_fkey`;
ALTER TABLE `Workspace` DROP FOREIGN KEY `Workspace_ownerId_fkey`;
ALTER TABLE `WorkspaceMember` DROP FOREIGN KEY `WorkspaceMember_userId_fkey`;

ALTER TABLE `User`
    CHANGE COLUMN `id` `internalId` VARCHAR(191) NOT NULL,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD UNIQUE INDEX `User_id_key`(`id`);

ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NoteFolder` ADD CONSTRAINT `NoteFolder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Note` ADD CONSTRAINT `Note_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NoteShare` ADD CONSTRAINT `NoteShare_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Domain` ADD CONSTRAINT `Domain_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Link` ADD CONSTRAINT `Link_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FolderGroup` ADD CONSTRAINT `FolderGroup_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LinkFolder` ADD CONSTRAINT `LinkFolder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Category` ADD CONSTRAINT `Category_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FbToken` ADD CONSTRAINT `FbToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `FbDebugJob` ADD CONSTRAINT `FbDebugJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BioPage` ADD CONSTRAINT `BioPage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Workspace` ADD CONSTRAINT `Workspace_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WorkspaceMember` ADD CONSTRAINT `WorkspaceMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`internalId`) ON DELETE CASCADE ON UPDATE CASCADE;
