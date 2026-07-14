import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { z } from 'zod'

// POST /api/v1/folders - Tạo folder mới
const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  urls: z.string().min(1),
  folderGroupId: z.string().optional(),
  order: z.number().int().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createFolderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, urls, folderGroupId, order } = parsed.data

  let finalOrder = order
  if (finalOrder === undefined) {
    const maxFolder = await prisma.linkFolder.findFirst({
      where: { userId: user.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    finalOrder = (maxFolder?.order ?? -1) + 1
  }

  const folder = await prisma.linkFolder.create({
    data: {
      userId: user.id,
      name,
      urls,
      order: finalOrder,
      folderGroupId: folderGroupId || null,
    },
  })

  return NextResponse.json({ data: folder }, { status: 201 })
}
