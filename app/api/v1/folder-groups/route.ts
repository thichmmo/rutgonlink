import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { z } from 'zod'

// GET /api/v1/folder-groups - Lấy danh sách folder groups
export async function GET(req: NextRequest) {
  // Xác thực API key
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth

  // Lấy tất cả folder groups của user, bao gồm folders bên trong
  const groups = await prisma.folderGroup.findMany({
    where: { userId: user.id },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      order: true,
      createdAt: true,
      folders: {
        select: {
          id: true,
          name: true,
          urls: true,
          order: true,
        },
        orderBy: { order: 'asc' },
      },
      _count: {
        select: { folders: true, categories: true },
      },
    },
  })

  // Format dữ liệu trả về
  return NextResponse.json({
    data: groups.map((g: typeof groups[0]) => ({
      id: g.id,
      name: g.name,
      order: g.order,
      createdAt: g.createdAt,
      foldersCount: g._count.folders,
      categoriesCount: g._count.categories,
      // Chỉ trả về thông tin cơ bản của folders, không trả về toàn bộ URLs
      folders: g.folders.map((f: typeof g.folders[0]) => ({
        id: f.id,
        name: f.name,
        urlsCount: f.urls.split('\n').filter(Boolean).length,
        order: f.order,
      })),
    })),
  })
}

// POST /api/v1/folder-groups - Tạo folder group mới
const createSchema = z.object({
  name: z.string().min(1).max(100),
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

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, order } = parsed.data

  let finalOrder = order
  if (finalOrder === undefined) {
    const maxGroup = await prisma.folderGroup.findFirst({
      where: { userId: user.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    finalOrder = (maxGroup?.order ?? -1) + 1
  }

  const group = await prisma.folderGroup.create({
    data: { userId: user.id, name, order: finalOrder },
  })

  return NextResponse.json({ data: group }, { status: 201 })
}
