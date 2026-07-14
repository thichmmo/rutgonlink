import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encrypt'
import { getContentPreview } from '@/lib/note-content'

// GET: notes owned by current user that are shared (public link or shared with users)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notes = await prisma.note.findMany({
    where: {
      userId: session.user.id,
      OR: [
        { isPublic: true },
        { shares: { some: {} } },
      ],
    },
    select: {
      id: true,
      title: true,
      content: true,
      starred: true,
      pinned: true,
      folderId: true,
      createdAt: true,
      updatedAt: true,
      isPublic: true,
      publicToken: true,
      folder: { select: { id: true, name: true, color: true } },
      shares: {
        select: {
          id: true,
          permission: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: [{ pinned: 'desc' }, { starred: 'desc' }, { updatedAt: 'desc' }],
  })

  const result = notes.map(({ content, shares, ...n }) => ({
    ...n,
    contentPreview: getContentPreview(decrypt(content), 100),
    sharesCount: shares.length,
    sharedWith: shares.map(s => ({
      id: s.id,
      permission: s.permission,
      name: s.user.name || s.user.email,
      email: s.user.email,
    })),
  }))

  return NextResponse.json({ notes: result, total: result.length })
}
