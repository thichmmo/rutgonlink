import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { customAlphabet } from 'nanoid'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getVietnamDayBoundaries } from '@/lib/vn-time'
import { getAlignedFolderRotationStartDateForGroup } from '@/lib/folder-active-preview-actions'
import { getSiteHostname } from '@/lib/site-config'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6)

async function attachClickTrend24h<T extends { id: string }>(links: T[]) {
  if (links.length === 0) return [] as Array<T & { clickTrend24h: { current: number; previous: number; delta: number } }>

  const { startOfToday, startOfYesterday, startOfTomorrow } = getVietnamDayBoundaries()
  const linkIds = links.map((l) => l.id)

  const [currentCounts, previousCounts] = await Promise.all([
    prisma.click.groupBy({
      by: ['linkId'],
      where: {
        linkId: { in: linkIds },
        createdAt: { gte: startOfToday, lt: startOfTomorrow },
      },
      _count: { _all: true },
    }),
    prisma.click.groupBy({
      by: ['linkId'],
      where: {
        linkId: { in: linkIds },
        createdAt: { gte: startOfYesterday, lt: startOfToday },
      },
      _count: { _all: true },
    }),
  ])

  const currentMap = new Map<string, number>(
    currentCounts.map((c: { linkId: string; _count: { _all: number } }) => [c.linkId, Number(c._count._all)]),
  )
  const previousMap = new Map<string, number>(
    previousCounts.map((c: { linkId: string; _count: { _all: number } }) => [c.linkId, Number(c._count._all)]),
  )

  return links.map((link) => {
    const current = currentMap.get(link.id) ?? 0
    const previous = previousMap.get(link.id) ?? 0

    return {
      ...link,
      clickTrend24h: {
        current,
        previous,
        delta: current - previous,
      },
    }
  })
}

const createLinkSchema = z.object({
  originalUrl: z
    .string()
    .min(1, 'Vui lòng nhập ít nhất 1 URL')
    .refine(
      (val) => {
        const urls = val.split('\n').map((u) => u.trim()).filter(Boolean)
        return urls.length > 0 && urls.every((u) => {
          try { new URL(u); return true } catch { return false }
        })
      },
      'URL không hợp lệ — mỗi dòng phải là URL đầy đủ (bắt đầu bằng https://)'
    ),
  customCode: z.string().min(3).max(190).optional().or(z.literal('')),
  title: z.string().max(100).optional(),
  domainId: z.string().optional(),
  sharedDomain: z.string().optional(),
  categoryId: z.string().optional(),
  workspaceId: z.string().optional(),
  expiresAt: z.string().optional(),
  password: z.string().optional(),
  maxClicks: z.number().int().positive().optional(),
  deepLinkIos: z.string().optional(),
  deepLinkAndroid: z.string().optional(),
  ogEnabled: z.boolean().optional(),
  ogAutoReset: z.boolean().optional(),
  ogScheduledDisableAt: z.string().optional(),
  clickResetAt: z.string().optional(),
  ogTitle: z.string().max(100).optional(),
  ogDescription: z.string().max(300).optional(),
  ogImage: z.string().max(2 * 1024 * 1024, 'Ảnh OG vượt quá 2MB').optional(),
  deviceRules: z
    .array(z.object({ deviceType: z.string(), redirectUrl: z.string().url() }))
    .optional(),
  countryRules: z
    .array(z.object({ countryCode: z.string().length(2), redirectUrl: z.string().url() }))
    .optional(),
  languageRules: z
    .array(z.object({ languageCode: z.string().min(2), redirectUrl: z.string().url() }))
    .optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = (searchParams.get('search') || '').slice(0, 100)
  const workspaceId = searchParams.get('workspaceId') || ''
  const categoryId = searchParams.get('categoryId') || ''
  const archived = searchParams.get('archived') === 'true'

  // Nếu lọc theo workspace, kiểm tra user có phải thành viên không
  if (workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { where: { userId: user.id } } },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace không tồn tại' }, { status: 404 })

    const isMember = workspace.ownerId === user.id || workspace.members.length > 0
    if (!isMember) return NextResponse.json({ error: 'Bạn không phải thành viên workspace này' }, { status: 403 })

    // Thành viên thấy TẤT CẢ link trong workspace (không lọc theo userId)
    const where: Record<string, unknown> = {
      workspaceId,
      isArchived: archived,
      ...(search
        ? {
          OR: [
            { title: { contains: search } },
            { originalUrl: { contains: search } },
            { shortCode: { contains: search } },
          ],
        }
        : {}),
    }
    if (categoryId) where.categoryId = categoryId

    const [links, total] = await Promise.all([
      prisma.link.findMany({
        where,
        include: {
          domain: true,
          category: true,
          workspace: { select: { id: true, name: true } },
          _count: { select: { clicks: true } },
          deviceRules: true,
          countryRules: true,
          languageRules: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.link.count({ where }),
    ])
    const linksWithTrend = await attachClickTrend24h(links)
    return NextResponse.json({ links: linksWithTrend, total, page, limit })
  }

  // Không lọc workspace → chỉ link của user
  const where: Record<string, unknown> = {
    userId: user.id,
    isArchived: archived,
    ...(search
      ? {
        OR: [
          { title: { contains: search } },
          { originalUrl: { contains: search } },
          { shortCode: { contains: search } },
        ],
      }
      : {}),
  }
  if (categoryId) where.categoryId = categoryId

  const [links, total] = await Promise.all([
    prisma.link.findMany({
      where,
      include: {
        domain: true,
        category: true,
        workspace: { select: { id: true, name: true } },
        _count: { select: { clicks: true } },
        deviceRules: true,
        countryRules: true,
        languageRules: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.link.count({ where }),
  ])

  const linksWithTrend = await attachClickTrend24h(links)
  return NextResponse.json({ links: linksWithTrend, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createLinkSchema.parse(body)

    // Plan validation
    {
      const {
        getPlanLimits, isPlanActive,
        checkDeviceRedirectAllowed, checkGeoRedirectAllowed,
      } = await import('@/lib/plan-limits')
      const isActive = isPlanActive(user.plan, user.planExpiresAt)
      const effectivePlan = user.plan !== 'free' && !isActive ? 'free' : user.plan
      const limits = getPlanLimits(effectivePlan)

      // Link count limit (free unlimited for now)
      if (effectivePlan !== 'free' && limits.maxLinks !== null) {
        const linkCount = await prisma.link.count({ where: { userId: user.id } })
        if (linkCount >= limits.maxLinks) {
          return NextResponse.json(
            { error: `Gói ${effectivePlan.toUpperCase()} chỉ cho phép tối đa ${limits.maxLinks} link. Vui lòng nâng cấp gói để tạo thêm.` },
            { status: 403 }
          )
        }
      }

      // Device redirect validation
      if (data.deviceRules && data.deviceRules.length > 0) {
        const err = checkDeviceRedirectAllowed(user.plan, user.planExpiresAt)
        if (err) return NextResponse.json({ error: err }, { status: 403 })
      }

      // Geo redirect validation
      if (data.countryRules && data.countryRules.length > 0) {
        const err = checkGeoRedirectAllowed(user.plan, user.planExpiresAt)
        if (err) return NextResponse.json({ error: err }, { status: 403 })
      }
    }

    // Validate workspace membership nếu có workspaceId
    if (data.workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: data.workspaceId },
        include: { members: { where: { userId: user.id } } },
      })
      if (!workspace) return NextResponse.json({ error: 'Workspace không tồn tại' }, { status: 404 })
      const isMember = workspace.ownerId === user.id || workspace.members.length > 0
      if (!isMember) return NextResponse.json({ error: 'Bạn không phải thành viên workspace này' }, { status: 403 })
    }

      const appHost = getSiteHostname()
    const targetHost = new URL(data.originalUrl).hostname
    if (targetHost === appHost) {
      return NextResponse.json({ error: 'Không thể dùng domain của ứng dụng làm link đích' }, { status: 400 })
    }

    const shortCode = data.customCode || nanoid()

    if (data.customCode) {
      const existing = await prisma.link.findUnique({ where: { shortCode } })
      if (existing) {
        return NextResponse.json({ error: 'Mã rút gọn đã tồn tại' }, { status: 400 })
      }
    }

    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = await (prisma.link.create as any)({
      data: {
        userId: user.id,
        shortCode,
        originalUrl: data.originalUrl,
        title: data.title || null,
        domainId: data.domainId || null,
        sharedDomain: data.sharedDomain || null,
        categoryId: data.categoryId || null,
        workspaceId: data.workspaceId || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        password: hashedPassword,
        maxClicks: data.maxClicks || null,
        deepLinkIos: data.deepLinkIos || null,
        deepLinkAndroid: data.deepLinkAndroid || null,
        ogEnabled: data.ogEnabled ?? true,
        ogAutoReset: data.ogAutoReset ?? false,
        ogScheduledDisableAt: data.ogScheduledDisableAt ? new Date(data.ogScheduledDisableAt) : null,
        clickResetAt: data.clickResetAt ? new Date(data.clickResetAt) : null,
        ogTitle: data.ogTitle || null,
        ogDescription: data.ogDescription || null,
        ogImage: data.ogImage || null,
        deviceRules: data.deviceRules?.length ? { create: data.deviceRules } : undefined,
        countryRules: data.countryRules?.length ? { create: data.countryRules } : undefined,
        languageRules: data.languageRules?.length ? { create: data.languageRules } : undefined,
      },
      include: {
        domain: true,
        category: true,
        workspace: { select: { id: true, name: true } },
        deviceRules: true,
        countryRules: true,
        languageRules: true,
        _count: { select: { clicks: true } },
      },
    })

    // Auto-assign folders from category's folder group
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { folderGroupId: true },
      })

      if (category?.folderGroupId) {
        const folders = await prisma.linkFolder.findMany({
          where: { folderGroupId: category.folderGroupId },
          orderBy: { order: 'asc' },
          select: { id: true },
        })

        if (folders.length > 0) {
          const folderRotationStartDate = await getAlignedFolderRotationStartDateForGroup(
            user.id,
            category.folderGroupId,
            folders.length,
          )

          await prisma.linkFolderAssignment.createMany({
            data: folders.map((folder, index) => ({
              linkId: link.id,
              folderId: folder.id,
              order: index,
            })),
          })

          // Enable folder rotation and set start date
          await prisma.link.update({
            where: { id: link.id },
            data: {
              useFolderRotation: true,
              folderRotationStartDate,
            },
          })
        }
      }
    }

    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('POST /api/links error:', error)
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
