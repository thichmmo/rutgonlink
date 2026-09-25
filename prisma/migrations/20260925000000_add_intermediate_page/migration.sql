-- Add optional video-style intermediate page settings to Link.
ALTER TABLE `Link`
  ADD COLUMN `enableIntermediatePage` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `intermediateImage` LONGTEXT NULL;
