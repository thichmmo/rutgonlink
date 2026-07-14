ALTER TABLE `User`
  ADD COLUMN `fbDebugAllActiveLinks` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `fbDebugDailyAllActiveLinks` BOOLEAN NOT NULL DEFAULT false;