import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { getFolderActivePreviewForUser } from '@/lib/folder-active-preview-actions'

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const dayOffset = parseInt(searchParams.get('dayOffset') || '0', 10) || 0
  const data = await getFolderActivePreviewForUser(auth.user.id, dayOffset)

  return NextResponse.json({ data })
}
