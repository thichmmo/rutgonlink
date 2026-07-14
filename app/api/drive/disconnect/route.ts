import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      googleDriveRefreshToken: null,
      googleDriveEmail: null,
      googleDriveFolderId: null,
    },
  })

  // Xóa driveFileId khỏi tất cả note của user
  // để lần kết nối lại sẽ backup toàn bộ
  await prisma.note.updateMany({
    where: { userId: session.user.id },
    data: { driveFileId: null },
  })

  return NextResponse.json({ success: true })
}
