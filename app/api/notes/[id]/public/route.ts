import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'

// POST: toggle public link or update password
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { isPublic, password } = await request.json()

  const note = await prisma.note.findUnique({ where: { id } })
  if (!note || note.userId !== session.user.id) {
    return NextResponse.json({ error: 'Không tìm thấy ghi chú' }, { status: 404 })
  }

  let publicToken = note.publicToken

  if (isPublic && !publicToken) {
    // Generate a new public token
    publicToken = nanoid(16)
  }

  const updated = await prisma.note.update({
    where: { id },
    data: {
      isPublic: Boolean(isPublic),
      publicToken: isPublic ? publicToken : note.publicToken, // keep token even if disabled
      publicPassword: isPublic && password?.trim()
        ? await bcrypt.hash(password.trim(), 10)
        : isPublic ? null : null,
    },
    select: {
      id: true,
      isPublic: true,
      publicToken: true,
      publicPassword: true,
    },
  })

  return NextResponse.json({
    isPublic: updated.isPublic,
    publicToken: updated.publicToken,
    hasPassword: !!updated.publicPassword,
  })
}
