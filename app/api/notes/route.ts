import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { encrypt, decrypt } from '@/lib/encrypt'
import { getContentPreview } from '@/lib/note-content'
import { getOrCreateDriveFolder, getOrCreateSubFolder, createDriveFile } from '@/lib/google-drive'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const folderId = searchParams.get('folderId') || ''

  const notes = await prisma.note.findMany({
    where: {
      userId: session.user.id,
      ...(search ? { title: { contains: search } } : {}),
      ...(folderId ? { folderId } : {}),
    },
    orderBy: [{ pinned: 'desc' }, { starred: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true, title: true, content: true, starred: true, pinned: true,
      folderId: true, createdAt: true, updatedAt: true,
      folder: { select: { id: true, name: true, color: true } },
    },
  })

  const result = notes.map(({ content, ...n }) => ({
    ...n,
    contentPreview: getContentPreview(decrypt(content), 100),
  }))

  return NextResponse.json({ notes: result, total: result.length })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, content, folderId } = await request.json()
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Tiêu đề không được để trống' }, { status: 400 })
  }

  let appFolderName: string | null = null
  if (folderId) {
    const folder = await prisma.noteFolder.findUnique({ where: { id: folderId } })
    if (!folder || folder.userId !== session.user.id) {
      return NextResponse.json({ error: 'Thư mục không hợp lệ' }, { status: 400 })
    }
    appFolderName = folder.name
  }

  try {
    const note = await prisma.note.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        content: encrypt(content || ''),
        folderId: folderId || null,
      },
      include: { folder: { select: { id: true, name: true, color: true } } },
    })

    syncNoteToNewDriveFile(session.user.id, note.id, title.trim(), content || '', appFolderName).catch(() => {})

    return NextResponse.json({ ...note, content: content || '' }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/notes]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function syncNoteToNewDriveFile(
  userId: string,
  noteId: string,
  title: string,
  content: string,
  appFolderName: string | null,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, googleDriveRefreshToken: true, googleDriveFolderId: true },
  })
  if (!user?.googleDriveRefreshToken || !user.email) return

  const mainFolderId = await getOrCreateDriveFolder(user.googleDriveRefreshToken, user.email, user.googleDriveFolderId)
  if (mainFolderId !== user.googleDriveFolderId) {
    await prisma.user.update({ where: { id: userId }, data: { googleDriveFolderId: mainFolderId } })
  }

  // Nếu note có folder app → tạo subfolder tương ứng trên Drive
  const targetFolderId = appFolderName
    ? await getOrCreateSubFolder(user.googleDriveRefreshToken, mainFolderId, appFolderName)
    : mainFolderId

  const driveFileId = await createDriveFile(user.googleDriveRefreshToken, targetFolderId, title, content)
  await prisma.note.update({ where: { id: noteId }, data: { driveFileId } })
}
