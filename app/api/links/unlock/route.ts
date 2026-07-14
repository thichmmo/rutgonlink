import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createUnlockToken } from '@/lib/unlock-token'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Rate limit: 5 lần / 60 giây theo IP để chặn brute force
  const ip = getClientIp(request)
  if (!checkRateLimit(`unlock:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Quá nhiều lần thử sai. Vui lòng đợi 1 phút rồi thử lại.' }, { status: 429 })
  }

  const { shortCode, password } = await request.json()

  if (!shortCode || !password) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  const link = await prisma.link.findFirst({
    where: { shortCode, domainId: null },
    select: { id: true, password: true, isActive: true },
  })

  if (!link || !link.isActive) {
    return NextResponse.json({ error: 'Link không tồn tại' }, { status: 404 })
  }

  if (!link.password) {
    return NextResponse.json({ error: 'Link không có mật khẩu' }, { status: 400 })
  }

  const isValid = await bcrypt.compare(password, link.password)
  if (!isValid) {
    return NextResponse.json({ error: 'Mật khẩu không đúng' }, { status: 403 })
  }

  // Lưu HMAC token vào cookie thay vì plaintext password
  const token = createUnlockToken(shortCode)
  const res = NextResponse.json({ success: true })
  res.cookies.set(`link_pw_${shortCode}`, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60,
    path: '/',
  })
  return res
}
