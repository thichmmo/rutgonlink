import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  exchangeCodeForTokens,
  getDriveUserEmail,
  getOrCreateDriveFolder,
  getOrCreateSubFolder,
  createDriveFile,
} from '@/lib/google-drive'
import { decrypt } from '@/lib/encrypt'

export async function GET(request: Request) {
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', baseUrl))
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/dashboard/notes?drive=error', baseUrl))
  }

  try {
    const tokens = await exchangeCodeForTokens(code, baseUrl)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL('/dashboard/notes?drive=no_refresh_token', baseUrl))
    }

    const driveEmail = await getDriveUserEmail(tokens.refresh_token)

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleDriveRefreshToken: tokens.refresh_token,
        googleDriveEmail: driveEmail,
        googleDriveFolderId: null,
      },
      select: { id: true, email: true },
    })

    syncAllNotes(user.id, user.email!, tokens.refresh_token).catch(() => {})

    return NextResponse.redirect(new URL('/dashboard/notes?drive=connected', baseUrl))
  } catch (err) {
    console.error('[drive/callback]', err)
    return NextResponse.redirect(new URL('/dashboard/notes?drive=error', baseUrl))
  }
}

async function syncAllNotes(userId: string, userEmail: string, refreshToken: string) {
  const mainFolderId = await getOrCreateDriveFolder(refreshToken, userEmail, null)
  await prisma.user.update({ where: { id: userId }, data: { googleDriveFolderId: mainFolderId } })

  // --- 1. Sync note của user, nhóm theo folder app ---
  const myNotes = await prisma.note.findMany({
    where: { userId, driveFileId: null },
    select: {
      id: true,
      title: true,
      content: true,
      folder: { select: { name: true } },
    },
  })

  // Cache Drive subfolder IDs để tránh tạo trùng
  const driveFolderCache = new Map<string, string>()

  const getDriveTargetFolder = async (appFolderName: string | null) => {
    if (!appFolderName) return mainFolderId
    if (driveFolderCache.has(appFolderName)) return driveFolderCache.get(appFolderName)!
    const subId = await getOrCreateSubFolder(refreshToken, mainFolderId, appFolderName)
    driveFolderCache.set(appFolderName, subId)
    return subId
  }

  for (const note of myNotes) {
    try {
      const content = decrypt(note.content)
      const targetFolderId = await getDriveTargetFolder(note.folder?.name ?? null)
      const driveFileId = await createDriveFile(refreshToken, targetFolderId, note.title, content)
      await prisma.note.update({ where: { id: note.id }, data: { driveFileId } })
    } catch { /* bỏ qua lỗi từng note */ }
  }

  // --- 2. Sync note được chia sẻ → thư mục "Được chia sẻ" ---
  const sharedNotes = await prisma.noteShare.findMany({
    where: { userId },
    include: {
      note: {
        select: {
          title: true,
          content: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  })

  if (sharedNotes.length > 0) {
    const sharedFolderId = await getOrCreateSubFolder(refreshToken, mainFolderId, 'Được chia sẻ')

    for (const share of sharedNotes) {
      try {
        const ownerName = share.note.user.name || share.note.user.email
        const content = decrypt(share.note.content)
        const titleWithOwner = `${share.note.title} - bởi ${ownerName}`
        await createDriveFile(refreshToken, sharedFolderId, titleWithOwner, content)
      } catch { /* bỏ qua lỗi từng note */ }
    }
  }
}
