import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getFolderActivePreviewForUser } from '@/lib/folder-active-preview-actions'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const dayOffset = parseInt(searchParams.get('dayOffset') || '0', 10) || 0
    const data = await getFolderActivePreviewForUser(user.id, dayOffset)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[GET /api/folders/active-preview]', error)
    return NextResponse.json({ error: 'Da xay ra loi' }, { status: 500 })
  }
}
