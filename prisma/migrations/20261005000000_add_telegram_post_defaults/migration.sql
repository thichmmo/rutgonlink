-- Nullable account defaults and immutable-at-creation post snapshots.
-- Existing rows remain NULL and render Telegram disabled.
ALTER TABLE `User` ADD COLUMN `telegramSettings` JSON NULL;
ALTER TABLE `ManagedPost` ADD COLUMN `telegramSettings` JSON NULL;
