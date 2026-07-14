-- AddTable PhimPageVisit: track page visits to vmephim.media (IP dedup 10 min, bot filtered)
CREATE TABLE `PhimPageVisit` (
  `id`        VARCHAR(191) NOT NULL,
  `ip`        VARCHAR(45)  NOT NULL,
  `userAgent` VARCHAR(500) NULL,
  `device`    VARCHAR(20)  NULL,
  `browser`   VARCHAR(50)  NULL,
  `os`        VARCHAR(50)  NULL,
  `referer`   VARCHAR(500) NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PhimPageVisit_ip_idx`       (`ip`),
  INDEX `PhimPageVisit_createdAt_idx`(`createdAt`),
  INDEX `PhimPageVisit_device_idx`   (`device`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddTable PhimMovieClick: track movie clicks separately (IP dedup 10 min, bot filtered)
CREATE TABLE `PhimMovieClick` (
  `id`        VARCHAR(191) NOT NULL,
  `linkId`    VARCHAR(191) NULL,
  `ip`        VARCHAR(45)  NULL,
  `device`    VARCHAR(20)  NULL,
  `browser`   VARCHAR(50)  NULL,
  `os`        VARCHAR(50)  NULL,
  `referer`   VARCHAR(500) NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PhimMovieClick_linkId_idx`   (`linkId`),
  INDEX `PhimMovieClick_ip_idx`       (`ip`),
  INDEX `PhimMovieClick_createdAt_idx`(`createdAt`),
  INDEX `PhimMovieClick_device_idx`   (`device`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
