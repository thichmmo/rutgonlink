import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getFolderRotationDefaultEnabled, setFolderRotationDefaultEnabled } from '@/lib/runtime-config'

// GET /api/settings/folder-rotation - Get global default setting
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const enabled = await getFolderRotationDefaultEnabled()
    return NextResponse.json({ enabled })
  } catch (error) {
    console.error('[GET /api/settings/folder-rotation]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}

// POST /api/settings/folder-rotation - Set global default setting
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled phải là boolean' }, { status: 400 })
    }

    await setFolderRotationDefaultEnabled(enabled)
    return NextResponse.json({ enabled })
  } catch (error) {
    console.error('[POST /api/settings/folder-rotation]', error)
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 })
  }
}
