-- Add isArchived column to Link table (safe: adds column with default, no data loss)
ALTER TABLE `Link` ADD COLUMN IF NOT EXISTS `isArchived` BOOLEAN NOT NULL DEFAULT false;
