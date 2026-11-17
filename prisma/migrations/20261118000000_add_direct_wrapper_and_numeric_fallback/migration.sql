-- Additive flags for direct popup wrapper mode ("Bọc thẳng") and optional /p7/<code> anti-404 fallback.
ALTER TABLE `User` ADD COLUMN `numericFallbackEnabled` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `ManagedPost` ADD COLUMN `isDirectWrapper` BOOLEAN NOT NULL DEFAULT false;
