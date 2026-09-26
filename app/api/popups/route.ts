import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getManagedContentUserId, popupSchema } from '@/lib/content-management'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const popups = await prisma.popupTemplate.findMany({
    where: { userId },
    include: { _count: { select: { posts: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(popups)
}

export async function POST(req: NextRequest) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = popupSchema.parse(await req.json())
    const popup = await prisma.popupTemplate.create({
      data: { ...data, imageUrl: data.imageUrl || null, userId },
    })
    return NextResponse.json(popup, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    throw error
  }
}
