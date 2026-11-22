-- 1. Safely drop any existing FK on PopupClick.postId regardless of constraint name or db-push history
SET @post_fk_name = (
  SELECT MIN(CONSTRAINT_NAME)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'PopupClick'
    AND COLUMN_NAME = 'postId'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);
SET @sql_drop_post_fk = IF(
  @post_fk_name IS NOT NULL,
  CONCAT('ALTER TABLE `PopupClick` DROP FOREIGN KEY `', @post_fk_name, '`'),
  'SELECT 1'
);
PREPARE stmt_drop_post_fk FROM @sql_drop_post_fk;
EXECUTE stmt_drop_post_fk;
DEALLOCATE PREPARE stmt_drop_post_fk;

-- 2. Safely drop any existing FK on PopupClick.popupId regardless of constraint name or db-push history
SET @popup_fk_name = (
  SELECT MIN(CONSTRAINT_NAME)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'PopupClick'
    AND COLUMN_NAME = 'popupId'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);
SET @sql_drop_popup_fk = IF(
  @popup_fk_name IS NOT NULL,
  CONCAT('ALTER TABLE `PopupClick` DROP FOREIGN KEY `', @popup_fk_name, '`'),
  'SELECT 1'
);
PREPARE stmt_drop_popup_fk FROM @sql_drop_popup_fk;
EXECUTE stmt_drop_popup_fk;
DEALLOCATE PREPARE stmt_drop_popup_fk;

-- 3. Make postId and popupId nullable, matching ManagedPost.id and PopupTemplate.id charset/collation
SET @post_col_def = (
  SELECT CONCAT(
    COLUMN_TYPE,
    IF(CHARACTER_SET_NAME IS NOT NULL, CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME), ''),
    IF(COLLATION_NAME IS NOT NULL, CONCAT(' COLLATE ', COLLATION_NAME), ''),
    ' NULL'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ManagedPost' AND COLUMN_NAME = 'id'
  LIMIT 1
);
SET @popup_col_def = (
  SELECT CONCAT(
    COLUMN_TYPE,
    IF(CHARACTER_SET_NAME IS NOT NULL, CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME), ''),
    IF(COLLATION_NAME IS NOT NULL, CONCAT(' COLLATE ', COLLATION_NAME), ''),
    ' NULL'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PopupTemplate' AND COLUMN_NAME = 'id'
  LIMIT 1
);
SET @sql_modify_cols = CONCAT(
  'ALTER TABLE `PopupClick` MODIFY `postId` ', COALESCE(@post_col_def, 'VARCHAR(191) NULL'),
  ', MODIFY `popupId` ', COALESCE(@popup_col_def, 'VARCHAR(191) NULL')
);
PREPARE stmt_modify_cols FROM @sql_modify_cols;
EXECUTE stmt_modify_cols;
DEALLOCATE PREPARE stmt_modify_cols;

-- 4. Null out any historical orphaned references before adding ON DELETE SET NULL constraints
UPDATE `PopupClick` pc
LEFT JOIN `ManagedPost` mp ON mp.`id` = pc.`postId`
SET pc.`postId` = NULL
WHERE pc.`postId` IS NOT NULL AND mp.`id` IS NULL;

UPDATE `PopupClick` pc
LEFT JOIN `PopupTemplate` pt ON pt.`id` = pc.`popupId`
SET pc.`popupId` = NULL
WHERE pc.`popupId` IS NOT NULL AND pt.`id` IS NULL;

-- 5. Add ON DELETE SET NULL foreign keys when all three tables use InnoDB
SET @all_innodb = (
  SELECT COUNT(*) = 3
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('PopupClick', 'ManagedPost', 'PopupTemplate')
    AND ENGINE = 'InnoDB'
);
SET @sql_add_fks = IF(
  @all_innodb,
  'ALTER TABLE `PopupClick` ADD CONSTRAINT `PopupClick_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ManagedPost` (`id`) ON DELETE SET NULL ON UPDATE CASCADE, ADD CONSTRAINT `PopupClick_popupId_fkey` FOREIGN KEY (`popupId`) REFERENCES `PopupTemplate` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_add_fks FROM @sql_add_fks;
EXECUTE stmt_add_fks;
DEALLOCATE PREPARE stmt_add_fks;
