import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      color: true,
      folderGroupId: true,
      createdAt: true,
      folderGroup: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: { links: true },
      },
    },
  })

  return NextResponse.json({
    data: categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      folderGroupId: c.folderGroupId,
      folderGroup: c.folderGroup,
      linksCount: c._count.links,
      createdAt: c.createdAt,
    })),
  })
}

// POST /api/v1/categories - Tạo category mới
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  folderGroupId: z.string().optional(),
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

  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, color, folderGroupId } = parsed.data

  const category = await prisma.category.create({
    data: { userId: user.id, name, color, folderGroupId: folderGroupId || null },
  })

  return NextResponse.json({ data: category }, { status: 201 })
}
