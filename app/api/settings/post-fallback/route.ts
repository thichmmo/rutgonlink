import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { getManagedContentActor } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

const fallbackSchema = z.object({
  enabled: z.boolean(),
}).strict()

export async function GET() {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { numericFallbackEnabled: true } })
  const enabled = Boolean(user?.numericFallbackEnabled)
  return NextResponse.json({ enabled, numericFallbackEnabled: enabled })
}

export async function PUT(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { enabled } = fallbackSchema.parse(await req.json())
    await prisma.user.update({ where: { id: actor.id }, data: { numericFallbackEnabled: enabled } })
    return NextResponse.json({ enabled, numericFallbackEnabled: enabled })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Dữ liệu JSON không hợp lệ' }, { status: 400 })
    console.error('[PUT /api/settings/post-fallback]', error)
    return NextResponse.json({ error: 'Lưu cài đặt hứng link thất bại' }, { status: 500 })
  }
}
