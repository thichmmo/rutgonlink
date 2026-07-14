import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { encrypt, decrypt } from '@/lib/encrypt'
import { getContentPreview } from '@/lib/note-content'
import {
  getOrCreateDriveFolder,
  getOrCreateSubFolder,
  createDriveFile,
  updateDriveFile,
  moveFileBetweenFolders,
  moveFileToDeletedFolder,
} from '@/lib/google-drive'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const note = await prisma.note.findUnique({
    where: { id },
    select: {
      id: true, userId: true, title: true, content: true, starred: true,
      isPublic: true, publicToken: true, publicPassword: true, createdAt: true, updatedAt: true,
      shares: { where: { userId: session.user.id }, select: { permission: true } },
    },
  })

  if (!note) {
    return NextResponse.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })
  }

  const isOwner = note.userId === session.user.id
  const hasAccess = note.shares.length > 0
  if (!isOwner && !hasAccess) {
    return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 })
  }

  return NextResponse.json({
    id: note.id, userId: note.userId, title: note.title,
    content: decrypt(note.content),
    starred: note.starred, isPublic: note.isPublic, publicToken: note.publicToken,
    createdAt: note.createdAt, updatedAt: note.updatedAt,
    hasPassword: !!note.publicPassword,
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { title, content } = await request.json()
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Tiêu đề không được để trống' }, { status: 400 })
  }

  const existing = await prisma.note.findUnique({
    where: { id },
    include: { shares: { where: { userId: session.user.id } } },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })
  }
  const isOwner = existing.userId === session.user.id
  const isAdmin = existing.shares[0]?.permission === 'admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Không có quyền chỉnh sửa' }, { status: 403 })
  }

  const note = await prisma.note.update({
    where: { id },
    data: { title: title.trim(), content: encrypt(content || '') },
  })

  syncNoteUpdate(existing.userId, id, existing.driveFileId, existing.folderId, title.trim(), content || '').catch(() => {})

  return NextResponse.json({ ...note, content: content || '' })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { starred, pinned, folderId } = await request.json()

  const existing = await prisma.note.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })
  }

  const data: Record<string, boolean | string | null> = {}
  if (starred !== undefined) data.starred = starred
  if (pinned !== undefined) data.pinned = pinned
  if (folderId !== undefined) data.folderId = folderId

  const note = await prisma.note.update({
    where: { id },
    data,
    include: { folder: { select: { id: true, name: true, color: true } } },
  })

  // Nếu folder thay đổi → sync di chuyển file trên Drive
  if (folderId !== undefined && existing.driveFileId) {
    const newFolderName = folderId
      ? (await prisma.noteFolder.findUnique({ where: { id: folderId }, select: { name: true } }))?.name ?? null
      : null
    syncFolderMove(existing.userId, existing.driveFileId, newFolderName).catch(() => {})
  }

  const { content: encContent, ...noteData } = note
  return NextResponse.json({
    ...noteData,
    contentPreview: getContentPreview(decrypt(encContent), 200),
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.note.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })
  }

  await prisma.note.delete({ where: { id } })

  if (existing.driveFileId) {
    syncNoteDeletion(existing.userId, existing.driveFileId).catch(() => {})
  }

  return NextResponse.json({ success: true })
}

// --- Drive sync helpers ---

async function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, googleDriveRefreshToken: true, googleDriveFolderId: true },
  })
}

async function ensureMainFolder(user: Awaited<ReturnType<typeof getUser>>, userId: string) {
  if (!user?.googleDriveRefreshToken || !user.email) return null
  const mainFolderId = await getOrCreateDriveFolder(user.googleDriveRefreshToken, user.email, user.googleDriveFolderId)
  if (mainFolderId !== user.googleDriveFolderId) {
    await prisma.user.update({ where: { id: userId }, data: { googleDriveFolderId: mainFolderId } })
  }
  return { token: user.googleDriveRefreshToken, mainFolderId }
}

// PUT: cập nhật nội dung note
async function syncNoteUpdate(
  userId: string,
  noteId: string,
  existingDriveFileId: string | null,
  appFolderId: string | null,
  title: string,
  content: string,
) {
  const user = await getUser(userId)
  const drive = await ensureMainFolder(user, userId)
  if (!drive) return

  if (existingDriveFileId) {
    await updateDriveFile(drive.token, existingDriveFileId, title, content)
  } else {
    // Note chưa có file Drive → tạo mới trong đúng subfolder
    const appFolderName = appFolderId
      ? (await prisma.noteFolder.findUnique({ where: { id: appFolderId }, select: { name: true } }))?.name ?? null
      : null
    const targetFolderId = appFolderName
      ? await getOrCreateSubFolder(drive.token, drive.mainFolderId, appFolderName)
      : drive.mainFolderId
    const driveFileId = await createDriveFile(drive.token, targetFolderId, title, content)
    await prisma.note.update({ where: { id: noteId }, data: { driveFileId } })
  }
}

// PATCH: di chuyển file sang subfolder mới trên Drive
async function syncFolderMove(
  userId: string,
  driveFileId: string,
  newAppFolderName: string | null,
) {
  const user = await getUser(userId)
  const drive = await ensureMainFolder(user, userId)
  if (!drive) return

  const targetFolderId = newAppFolderName
    ? await getOrCreateSubFolder(drive.token, drive.mainFolderId, newAppFolderName)
    : drive.mainFolderId

  await moveFileBetweenFolders(drive.token, driveFileId, targetFolderId)
}

// DELETE: chuyển file vào "Đã xóa"
async function syncNoteDeletion(userId: string, driveFileId: string) {
  const user = await getUser(userId)
  const drive = await ensureMainFolder(user, userId)
  if (!drive) return
  await moveFileToDeletedFolder(drive.token, driveFileId, drive.mainFolderId)
}
