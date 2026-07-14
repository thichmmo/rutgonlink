import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { NextResponse } from 'next/server'
import { getDriveAuthUrl } from '@/lib/google-drive'
import { getSiteUrl } from '@/lib/site-config'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = getSiteUrl()
  const url = getDriveAuthUrl(origin)
  return NextResponse.json({ url })
}
