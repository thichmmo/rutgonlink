import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name } = await req.json()

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Tên phải có ít nhất 2 ký tự' }, { status: 400 })
  }

  if (name.trim().length > 50) {
    return NextResponse.json({ error: 'Tên không được vượt quá 50 ký tự' }, { status: 400 })
  }

  await prisma.user.update({
    where: { email: session.user.email },
    data: { name: name.trim() },
  })

  return NextResponse.json({ success: true })
}
