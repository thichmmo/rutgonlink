import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { enableAllFolderRotationForUser } from '@/lib/folder-rotation-actions'

// POST /api/v1/folders/enable-all-rotation - Enable folder rotation for active links via API key.
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth.ok) return auth.response

    const result = await enableAllFolderRotationForUser(auth.user.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      success: true,
      updated: result.updated,
      skipped: result.skipped,
      message: result.message,
    })
  } catch (error) {
    console.error('[POST /api/v1/folders/enable-all-rotation]', error)
    return NextResponse.json({ error: 'Da xay ra loi' }, { status: 500 })
  }
}
