import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { invalidateLinkCache } from '@/lib/link-cache'
import { syncCategoryLinksToFolderGroup } from '@/lib/folder-rotation-actions'
import { getAlignedFolderRotationStartDateForGroup } from '@/lib/folder-active-preview-actions'
import bcrypt from 'bcryptjs'

async function getUserId(session: { user?: { email?: string | null } | null } | null) {
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  return user?.id ?? null
}

// Kiểm tra user có quyền với link không (owner của link HOẶC admin/owner của workspace chứa link)
async function canAccessLink(linkId: string, userId: string) {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    include: {
      workspace: {
        include: { members: { where: { userId } } },
      },
    },
  })
  if (!link) return { allowed: false, link: null }

  // Link thuộc về user
  if (link.userId === userId) return { allowed: true, link }

  // Link trong workspace và user là owner hoặc admin
  if (link.workspace) {
    const isWorkspaceOwner = link.workspace.ownerId === userId
    const isWorkspaceAdmin = link.workspace.members.some((m) => m.role === 'admin')
    if (isWorkspaceOwner || isWorkspaceAdmin) return { allowed: true, link }
  }

  return { allowed: false, link: null }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = await getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { allowed } = await canAccessLink(id, userId)

  if (!allowed) {
    return NextResponse.json({ error: 'Không tìm thấy link' }, { status: 404 })
  }

  await prisma.link.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = await getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { allowed, link } = await canAccessLink(id, userId)

  if (!allowed || !link) {
    return NextResponse.json({ error: 'Không tìm thấy link' }, { status: 404 })
  }

  const body = await req.json()

  // null = explicitly clear password, non-empty string = set new password, empty/undefined = keep current
  if (body.password === null) {
    // keep as null to clear
  } else if (body.password && body.password.trim()) {
    body.password = await bcrypt.hash(body.password, 10)
  } else {
    body.password = undefined // exclude from update, keep current
  }

  if (body.shortCode && body.shortCode !== link.shortCode) {
    const exists = await prisma.link.findFirst({
      where: { shortCode: body.shortCode, id: { not: id } },
    })
    if (exists) {
      return NextResponse.json({ error: 'Mã rút gọn đã tồn tại' }, { status: 400 })
    }
  }

  // Validate workspaceId nếu có
  if (body.workspaceId !== undefined && body.workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: body.workspaceId },
      include: { members: { where: { userId } } },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace không tồn tại' }, { status: 404 })
    const isMember = workspace.ownerId === userId || workspace.members.length > 0
    if (!isMember) return NextResponse.json({ error: 'Bạn không phải thành viên workspace này' }, { status: 403 })
  }

  let folderRotationStartDate =
    (link as unknown as { folderRotationStartDate?: Date | null }).folderRotationStartDate ?? null
  const nextCategoryId = body.categoryId !== undefined ? body.categoryId || null : link.categoryId
  const shouldSyncCategoryFolders = !!nextCategoryId && body.categoryId !== undefined && nextCategoryId !== link.categoryId

  if (body.useFolderRotation === true && !folderRotationStartDate) {
    const assignedFolders = await prisma.linkFolderAssignment.findMany({
      where: { linkId: id },
      select: { folder: { select: { folderGroupId: true } } },
    })
    const folderGroupIds = [
      ...new Set(assignedFolders.map((assignment) => assignment.folder.folderGroupId).filter((groupId): groupId is string => !!groupId)),
    ]
    folderRotationStartDate = await getAlignedFolderRotationStartDateForGroup(
      userId,
      folderGroupIds.length === 1 ? folderGroupIds[0] : null,
      assignedFolders.length,
    )
  }

  const updated = await prisma.link.update({
    where: { id },
    data: {
      isActive: body.isActive !== undefined ? body.isActive : link.isActive,
      isArchived: body.isArchived !== undefined ? body.isArchived : link.isArchived,
      ogEnabled: body.ogEnabled !== undefined ? body.ogEnabled : link.ogEnabled,
      ogAutoReset: body.ogAutoReset !== undefined ? body.ogAutoReset : link.ogAutoReset,
      title: body.title !== undefined ? body.title : link.title,
      originalUrl: body.originalUrl !== undefined ? body.originalUrl : link.originalUrl,
      shortCode: body.shortCode !== undefined ? body.shortCode : link.shortCode,
      sharedDomain: body.sharedDomain !== undefined ? (body.sharedDomain || null) : link.sharedDomain,
      domainId: body.domainId !== undefined ? (body.domainId || null) : link.domainId,
      categoryId: nextCategoryId,
      workspaceId: body.workspaceId !== undefined ? (body.workspaceId || null) : link.workspaceId,
      ogTitle: body.ogTitle !== undefined ? (body.ogTitle || null) : link.ogTitle,
      ogDescription: body.ogDescription !== undefined ? (body.ogDescription || null) : link.ogDescription,
      ogImage: body.ogImage !== undefined ? (body.ogImage || null) : link.ogImage,
      password: body.password !== undefined ? body.password : link.password,
      expiresAt: body.expiresAt !== undefined ? (body.expiresAt ? new Date(body.expiresAt) : null) : link.expiresAt,
      maxClicks: body.maxClicks !== undefined ? (body.maxClicks || null) : link.maxClicks,
      deepLinkIos: body.deepLinkIos !== undefined ? (body.deepLinkIos || null) : link.deepLinkIos,
      deepLinkAndroid: body.deepLinkAndroid !== undefined ? (body.deepLinkAndroid || null) : link.deepLinkAndroid,
      ogScheduledDisableAt: body.ogScheduledDisableAt !== undefined
        ? (body.ogScheduledDisableAt ? new Date(body.ogScheduledDisableAt) : null)
        : (link as unknown as { ogScheduledDisableAt?: Date | null }).ogScheduledDisableAt ?? null,
      clickResetAt: body.clickResetAt !== undefined
        ? (body.clickResetAt ? new Date(body.clickResetAt) : null)
        : (link as unknown as { clickResetAt?: Date | null }).clickResetAt ?? null,
      useFolderRotation: body.useFolderRotation !== undefined ? body.useFolderRotation : (link as unknown as { useFolderRotation?: boolean }).useFolderRotation ?? false,
      folderRotationStartDate,
    },
    include: {
      domain: true,
      category: true,
      workspace: { select: { id: true, name: true } },
      _count: { select: { clicks: true } },
    },
  })

  if (shouldSyncCategoryFolders && nextCategoryId) {
    await syncCategoryLinksToFolderGroup(userId, nextCategoryId, [id])
  }

  // Plan validation for redirect rules
  if (body.deviceRules !== undefined && body.deviceRules.length > 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true } })
    if (user) {
      const { checkDeviceRedirectAllowed } = await import('@/lib/plan-limits')
      const err = checkDeviceRedirectAllowed(user.plan, user.planExpiresAt)
      if (err) return NextResponse.json({ error: err }, { status: 403 })
    }
  }

  if (body.countryRules !== undefined && body.countryRules.length > 0) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true } })
    if (user) {
      const { checkGeoRedirectAllowed } = await import('@/lib/plan-limits')
      const err = checkGeoRedirectAllowed(user.plan, user.planExpiresAt)
      if (err) return NextResponse.json({ error: err }, { status: 403 })
    }
  }

  if (body.deviceRules !== undefined) {
    await prisma.deviceRule.deleteMany({ where: { linkId: id } })
    if (body.deviceRules.length > 0) {
      await prisma.deviceRule.createMany({
        data: body.deviceRules.map((r: { deviceType: string; redirectUrl: string }) => ({
          linkId: id, deviceType: r.deviceType, redirectUrl: r.redirectUrl,
        })),
      })
    }
  }

  if (body.countryRules !== undefined) {
    await prisma.countryRule.deleteMany({ where: { linkId: id } })
    if (body.countryRules.length > 0) {
      await prisma.countryRule.createMany({
        data: body.countryRules.map((r: { countryCode: string; redirectUrl: string }) => ({
          linkId: id, countryCode: r.countryCode, redirectUrl: r.redirectUrl,
        })),
      })
    }
  }

  if (body.languageRules !== undefined) {
    await prisma.languageRule.deleteMany({ where: { linkId: id } })
    if (body.languageRules.length > 0) {
      await prisma.languageRule.createMany({
        data: body.languageRules.map((r: { languageCode: string; redirectUrl: string }) => ({
          linkId: id, languageCode: r.languageCode, redirectUrl: r.redirectUrl,
        })),
      })
    }
  }

  invalidateLinkCache(updated.shortCode)

  return NextResponse.json(updated)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = await getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { allowed } = await canAccessLink(id, userId)

  if (!allowed) {
    return NextResponse.json({ error: 'Không tìm thấy link' }, { status: 404 })
  }

  const link = await prisma.link.findUnique({
    where: { id },
    include: {
      domain: true,
      workspace: { select: { id: true, name: true } },
      deviceRules: true,
      countryRules: true,
      languageRules: true,
      _count: { select: { clicks: true } },
      clicks: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  })

  return NextResponse.json(link)
}
