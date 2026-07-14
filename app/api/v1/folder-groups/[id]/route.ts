import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiKey } from '@/lib/api-v1-auth'

// DELETE /api/v1/folder-groups/[id] - Delete a folder group owned by the API user.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { user } = auth
  const { id } = await params

  const group = await prisma.folderGroup.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  })

  if (!group) {
    return NextResponse.json({ error: 'Folder group not found' }, { status: 404 })
  }

  await prisma.folderGroup.delete({ where: { id } })

  return NextResponse.json({ success: true, message: 'Folder group deleted' })
}
