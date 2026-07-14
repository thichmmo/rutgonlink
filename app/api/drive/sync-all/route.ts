import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encrypt'
import {
  getOrCreateDriveFolder,
  getOrCreateSubFolder,
  createDriveFile,
  updateDriveFile,
} from '@/lib/google-drive'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, googleDriveRefreshToken: true, googleDriveFolderId: true },
  })

  if (!user?.googleDriveRefreshToken || !user.email) {
    return NextResponse.json({ error: 'Chưa kết nối Google Drive' }, { status: 400 })
  }

  const refreshToken = user.googleDriveRefreshToken

  // Đảm bảo thư mục gốc tồn tại
  const mainFolderId = await getOrCreateDriveFolder(refreshToken, user.email, user.googleDriveFolderId)
  if (mainFolderId !== user.googleDriveFolderId) {
    await prisma.user.update({ where: { id: session.user.id }, data: { googleDriveFolderId: mainFolderId } })
  }

  // Lấy tất cả note của user (cả có và chưa có driveFileId)
  const myNotes = await prisma.note.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      title: true,
      content: true,
      driveFileId: true,
      folder: { select: { name: true } },
    },
  })

  const driveFolderCache = new Map<string, string>()

  const getDriveTargetFolder = async (appFolderName: string | null) => {
    if (!appFolderName) return mainFolderId
    if (driveFolderCache.has(appFolderName)) return driveFolderCache.get(appFolderName)!
    const subId = await getOrCreateSubFolder(refreshToken, mainFolderId, appFolderName)
    driveFolderCache.set(appFolderName, subId)
    return subId
  }

  let synced = 0
  let errors = 0

  for (const note of myNotes) {
    try {
      const content = decrypt(note.content)
      const targetFolderId = await getDriveTargetFolder(note.folder?.name ?? null)

      if (note.driveFileId) {
        // Đã có file → cập nhật nội dung
        await updateDriveFile(refreshToken, note.driveFileId, note.title, content)
      } else {
        // Chưa có file → tạo mới
        const driveFileId = await createDriveFile(refreshToken, targetFolderId, note.title, content)
        await prisma.note.update({ where: { id: note.id }, data: { driveFileId } })
      }
      synced++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ synced, errors })
}
