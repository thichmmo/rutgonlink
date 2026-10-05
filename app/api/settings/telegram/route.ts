import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getManagedContentActor } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'
import { normalizeTelegramSettings, telegramSettingsSchema } from '@/lib/telegram-settings'

export async function GET() {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { telegramSettings: true } })
  return NextResponse.json(normalizeTelegramSettings(user?.telegramSettings))
}

export async function PUT(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const settings = telegramSettingsSchema.parse(await req.json())
    await prisma.user.update({ where: { id: actor.id }, data: { telegramSettings: settings } })
    // Only the account default changes; already-created posts retain their snapshot.
    return NextResponse.json(settings)
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Dữ liệu JSON không hợp lệ' }, { status: 400 })
    console.error('[PUT /api/settings/telegram]', error)
    return NextResponse.json({ error: 'Lưu cài đặt Telegram thất bại' }, { status: 500 })
  }
}
