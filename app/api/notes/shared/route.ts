import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encrypt'
import { getContentPreview } from '@/lib/note-content'

// GET: notes shared with current user
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shares = await prisma.noteShare.findMany({
    where: { userId: session.user.id },
    include: {
      note: {
        select: {
          id: true,
          title: true,
          content: true,
          updatedAt: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = shares.map(s => ({
    shareId: s.id,
    permission: s.permission,
    id: s.note.id,
    title: s.note.title,
    contentPreview: getContentPreview(decrypt(s.note.content), 100),
    updatedAt: s.note.updatedAt,
    createdAt: s.note.createdAt,
    ownerName: s.note.user.name || s.note.user.email,
  }))

  return NextResponse.json({ notes: result, total: result.length })
}
