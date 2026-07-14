import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { advanceFolderRotationForUser } from '@/lib/folder-rotation-actions'

// POST /api/folders/advance-rotation - Advance folder rotation by 1 day for all rotating links.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const result = await advanceFolderRotationForUser(user.id)

    return NextResponse.json({
      success: true,
      updated: result.updated,
      message: result.message,
    })
  } catch (error) {
    console.error('[POST /api/folders/advance-rotation]', error)
    return NextResponse.json({ error: 'Da xay ra loi' }, { status: 500 })
  }
}
