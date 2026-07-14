import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { getActiveFolderForLink } from '@/lib/link-active-folder-actions'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const result = await getActiveFolderForLink(auth.user.id, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json(result)
}
