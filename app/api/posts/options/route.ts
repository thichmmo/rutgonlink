import { NextResponse } from 'next/server'
import { getManagedContentActor, getPublicationTargets } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'
import { normalizeTelegramSettings } from '@/lib/telegram-settings'

export async function GET() {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [popups, domains, user] = await Promise.all([
    // Creation defaults use the latest valid popup; ID breaks timestamp ties.
    prisma.popupTemplate.findMany({ where: { userId: actor.id, isActive: true }, select: { id: true, name: true, imageUrl: true, settings: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    getPublicationTargets(actor.id),
    prisma.user.findUnique({ where: { id: actor.id }, select: { telegramSettings: true } }),
  ])
  return NextResponse.json({ popups, domains, canUseRawHtml: actor.isAdmin, telegramDefaults: normalizeTelegramSettings(user?.telegramSettings) })
}
