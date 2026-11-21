import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { getManagedContentActor } from '@/lib/content-management'
import { DASHBOARD_QUICK_MODES } from '@/lib/dashboard-quick-mode'
import {
  getQuickTelegramDashboardConfig,
  getUserDashboardQuickMode,
  saveUserDashboardQuickMode,
} from '@/lib/dashboard-quick-mode-server'

const updateQuickModeSchema = z
  .object({
    mode: z.enum(DASHBOARD_QUICK_MODES),
  })
  .strict()

export async function GET() {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [mode, telegramConfig] = await Promise.all([
    getUserDashboardQuickMode(actor.id),
    getQuickTelegramDashboardConfig(actor.id),
  ])

  return NextResponse.json(
    { mode, telegramConfig },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function PUT(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const parsed = updateQuickModeSchema.parse(await req.json())
    const mode = await saveUserDashboardQuickMode(actor.id, parsed.mode)
    return NextResponse.json({ mode })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Chế độ tạo nhanh không hợp lệ' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Không thể lưu chế độ tạo nhanh' }, { status: 400 })
  }
}
