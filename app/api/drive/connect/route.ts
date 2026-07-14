import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { NextResponse } from 'next/server'
import { getDriveAuthUrl } from '@/lib/google-drive'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin
  const url = getDriveAuthUrl(origin)
  return NextResponse.json({ url })
}
