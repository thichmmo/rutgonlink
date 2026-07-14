import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/encrypt'
import bcrypt from 'bcryptjs'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// GET: get public note info (no auth needed)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const note = await prisma.note.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      title: true,
      content: true,
      isPublic: true,
      publicPassword: true,
      updatedAt: true,
      user: { select: { name: true, email: true } },
    },
  })

  if (!note || !note.isPublic) {
    return NextResponse.json({ error: 'Ghi chú không tồn tại hoặc đã bị ẩn' }, { status: 404 })
  }

  const hasPassword = !!note.publicPassword

  if (hasPassword) {
    // Return only metadata, not content
    return NextResponse.json({
      title: note.title,
      hasPassword: true,
      ownerName: note.user.name || note.user.email,
      updatedAt: note.updatedAt,
    })
  }

  return NextResponse.json({
    title: note.title,
    content: decrypt(note.content),
    hasPassword: false,
    ownerName: note.user.name || note.user.email,
    updatedAt: note.updatedAt,
  })
}

// POST: verify password and get content
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limit: 5 lần / 60 giây theo IP để chặn brute force
  const ip = getClientIp(request)
  if (!checkRateLimit(`note_unlock:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Quá nhiều lần thử sai. Vui lòng đợi 1 phút rồi thử lại.' }, { status: 429 })
  }

  const { token } = await params
  const { password } = await request.json()

  const note = await prisma.note.findUnique({
    where: { publicToken: token },
    select: {
      title: true,
      content: true,
      isPublic: true,
      publicPassword: true,
      updatedAt: true,
      user: { select: { name: true, email: true } },
    },
  })

  if (!note || !note.isPublic) {
    return NextResponse.json({ error: 'Ghi chú không tồn tại hoặc đã bị ẩn' }, { status: 404 })
  }

  const isValid = await bcrypt.compare(password, note.publicPassword ?? '')
  if (!isValid) {
    return NextResponse.json({ error: 'Mật khẩu không đúng' }, { status: 403 })
  }

  return NextResponse.json({
    title: note.title,
    content: decrypt(note.content),
    ownerName: note.user.name || note.user.email,
    updatedAt: note.updatedAt,
  })
}
