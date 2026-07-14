import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

function randomPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function planExpiryDate(period: string): Date | null {
  if (period === 'lifetime') return null
  const months = period === '1m' ? 1 : period === '6m' ? 6 : 12
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { action } = body

  if (action === 'reset-password') {
    const newPassword = randomPassword()
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id }, data: { password: hashed } })
    return NextResponse.json({ success: true, newPassword })
  }

  if (action === 'upgrade-plan') {
    const { plan, period } = body as { plan: string; period: string }
    if (!plan || !period) {
      return NextResponse.json({ error: 'Thiếu plan hoặc period' }, { status: 400 })
    }

    const expiresAt = planExpiryDate(period)

    // Update user plan
    await prisma.user.update({
      where: { id },
      data: { plan, planExpiresAt: expiresAt },
    })

    // Record subscription for history
    await prisma.subscription.create({
      data: {
        userId: id,
        plan,
        period,
        status: 'gifted',
        startDate: new Date(),
        endDate: expiresAt,
      },
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
