import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { customAlphabet } from 'nanoid'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6)

const createLinkSchema = z.object({
  originalUrl: z.string().url('URL không hợp lệ — phải bắt đầu bằng https://'),
  customCode: z.string().min(3).max(190).optional().or(z.literal('')),
  title: z.string().max(100).optional(),
  expiresAt: z.string().optional(),
  password: z.string().optional(),
  maxClicks: z.number().int().positive().optional(),
})

const LINK_SELECT = {
  id: true,
  shortCode: true,
  originalUrl: true,
  title: true,
  isActive: true,
  expiresAt: true,
  maxClicks: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { clicks: true } },
} as const

/**
 * GET /api/v1/links
 * Query: page, limit, search
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const search = (searchParams.get('search') || '').slice(0, 100)

  const where: Record<string, unknown> = { userId: user.id }
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { originalUrl: { contains: search } },
      { shortCode: { contains: search } },
    ]
  }

  const [links, total] = await Promise.all([
    prisma.link.findMany({
      where,
      select: LINK_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.link.count({ where }),
  ])

  const baseUrl = 'https://rutgonlink.site/'

  return NextResponse.json({
    data: links.map((l) => ({
      ...l,
      shortUrl: baseUrl + l.shortCode,
      clicks: l._count.clicks,
      _count: undefined,
    })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}

/**
 * POST /api/v1/links
 * Body: { originalUrl, customCode?, title?, expiresAt?, password?, maxClicks? }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 })
  }

  const parsed = createLinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message, details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Tránh rút gọn domain chính của ứng dụng
  const appHost = 'rutgonlink.site'
  try {
    const targetHost = new URL(data.originalUrl).hostname
    if (targetHost === appHost) {
      return NextResponse.json(
        { error: 'Không thể dùng domain của ứng dụng làm link đích' },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }

  const shortCode = data.customCode || nanoid()

  if (data.customCode) {
    const existing = await prisma.link.findUnique({ where: { shortCode } })
    if (existing) {
      return NextResponse.json({ error: 'Mã rút gọn đã tồn tại, vui lòng chọn mã khác' }, { status: 409 })
    }
  }

  const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : null

  const link = await prisma.link.create({
    data: {
      userId: user.id,
      shortCode,
      originalUrl: data.originalUrl,
      title: data.title || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      password: hashedPassword,
      maxClicks: data.maxClicks || null,
    },
    select: LINK_SELECT,
  })

  const baseUrl = 'https://rutgonlink.site/'

  return NextResponse.json(
    {
      data: {
        ...link,
        shortUrl: baseUrl + link.shortCode,
        clicks: link._count.clicks,
        _count: undefined,
      },
    },
    { status: 201 }
  )
}
