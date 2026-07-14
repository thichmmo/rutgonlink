/**
 * Auto-migration: chạy khi server khởi động để thêm cột mới an toàn
 * Không xóa dữ liệu cũ — chỉ ADD COLUMN IF NOT EXISTS
 */
import { prisma } from './prisma'

async function migrate(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql)
  } catch (e) {
    const msg = String((e as Error)?.message || '')
    if (!msg.includes('Duplicate column')) {
      console.error('[db-migrate] error:', e)
    }
  }
}

export async function runMigrations() {
  await migrate(`ALTER TABLE \`Link\` ADD COLUMN IF NOT EXISTS \`ogScheduledDisableAt\` DATETIME(3) NULL`)
  await migrate(`ALTER TABLE \`Link\` ADD COLUMN IF NOT EXISTS \`clickResetAt\` DATETIME(3) NULL`)
}
