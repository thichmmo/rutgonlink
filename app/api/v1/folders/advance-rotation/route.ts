import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-v1-auth'
import { advanceFolderRotationForUser } from '@/lib/folder-rotation-actions'

// POST /api/v1/folders/advance-rotation - Advance folder rotation by 1 day via API key.
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth.ok) return auth.response

    const result = await advanceFolderRotationForUser(auth.user.id)

    return NextResponse.json({
      success: true,
      updated: result.updated,
      message: result.message,
    })
  } catch (error) {
    console.error('[POST /api/v1/folders/advance-rotation]', error)
    return NextResponse.json({ error: 'Da xay ra loi' }, { status: 500 })
  }
}
