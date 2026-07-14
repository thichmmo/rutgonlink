import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

async function getUser(session: { user?: { email?: string | null } | null } | null) {
  if (!session?.user?.email) return null
  return prisma.user.findUnique({ where: { email: session.user.email } })
}

const workspaceInclude = {
  members: { include: { user: { select: { id: true, name: true, email: true } } } },
  _count: { select: { links: true } },
}

// PATCH: rename workspace or invite/remove/change-role member
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const user = await getUser(session)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Find workspace including members to check roles
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: { members: true },
  })
  if (!workspace) return NextResponse.json({ error: 'Không tìm thấy workspace' }, { status: 404 })

  const isOwner = workspace.ownerId === user.id
  const myMembership = workspace.members.find((m) => m.userId === user.id)
  const isAdmin = myMembership?.role === 'admin'

  // Must be owner or admin to manage workspace
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Không có quyền quản lý workspace này' }, { status: 403 })
  }

  const body = await req.json()

  // Rename — owner only
  if (body.name) {
    if (!isOwner) return NextResponse.json({ error: 'Chỉ owner mới có thể đổi tên workspace' }, { status: 403 })
    const updated = await prisma.workspace.update({
      where: { id },
      data: { name: body.name.trim() },
      include: workspaceInclude,
    })
    return NextResponse.json(updated)
  }

  // Invite member
  if (body.inviteEmail) {
    const invitee = await prisma.user.findUnique({ where: { email: body.inviteEmail } })
    if (!invitee) return NextResponse.json({ error: 'Không tìm thấy người dùng với email này' }, { status: 404 })
    if (invitee.id === user.id) return NextResponse.json({ error: 'Không thể mời chính mình' }, { status: 400 })
    if (invitee.id === workspace.ownerId) return NextResponse.json({ error: 'Người dùng đã là owner của workspace' }, { status: 400 })

    const existing = await prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId: invitee.id },
    })
    if (existing) return NextResponse.json({ error: 'Người dùng đã là thành viên' }, { status: 400 })

    const role = body.role || 'member'
    // Admin chỉ được mời member thông thường, không được mời admin
    if (!isOwner && role === 'admin') {
      return NextResponse.json({ error: 'Chỉ owner mới có thể mời admin' }, { status: 403 })
    }

    await prisma.workspaceMember.create({
      data: { workspaceId: id, userId: invitee.id, role },
    })

    const updated = await prisma.workspace.findFirst({ where: { id }, include: workspaceInclude })
    return NextResponse.json(updated)
  }

  // Remove member
  if (body.removeMemberId) {
    if (body.removeMemberId === workspace.ownerId) {
      return NextResponse.json({ error: 'Không thể xóa owner khỏi workspace' }, { status: 400 })
    }
    // Admin không thể xóa admin khác
    const targetMember = workspace.members.find((m) => m.userId === body.removeMemberId)
    if (!isOwner && targetMember?.role === 'admin') {
      return NextResponse.json({ error: 'Admin không thể xóa admin khác' }, { status: 403 })
    }

    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: id, userId: body.removeMemberId },
    })
    const updated = await prisma.workspace.findFirst({ where: { id }, include: workspaceInclude })
    return NextResponse.json(updated)
  }

  // Change role — owner only
  if (body.changeRoleMemberId) {
    if (!isOwner) return NextResponse.json({ error: 'Chỉ owner mới có thể thay đổi quyền thành viên' }, { status: 403 })
    if (body.changeRoleMemberId === workspace.ownerId) {
      return NextResponse.json({ error: 'Không thể thay đổi quyền của owner' }, { status: 400 })
    }
    const validRoles = ['member', 'admin']
    if (!validRoles.includes(body.newRole)) {
      return NextResponse.json({ error: 'Vai trò không hợp lệ' }, { status: 400 })
    }

    await prisma.workspaceMember.updateMany({
      where: { workspaceId: id, userId: body.changeRoleMemberId },
      data: { role: body.newRole },
    })
    const updated = await prisma.workspace.findFirst({ where: { id }, include: workspaceInclude })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Không có thao tác hợp lệ' }, { status: 400 })
}

// DELETE: delete workspace — owner only
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const user = await getUser(session)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const workspace = await prisma.workspace.findFirst({ where: { id, ownerId: user.id } })
  if (!workspace) return NextResponse.json({ error: 'Không tìm thấy workspace' }, { status: 404 })

  await prisma.workspace.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
