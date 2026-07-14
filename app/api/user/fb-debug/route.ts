import { NextRequest, NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import {
  addUserFbToken,
  addUserFbTokensBulk,
  checkAllUserFbTokens,
  deleteUserFbToken,
  getUserFbDebugSettings,
  previewUserFbDebugNow,
  processFbDebugJobBatch,
  runUserFbDebugNow,
  scrapeUrlForUser,
  testUserFbToken,
  updateUserFbDebugSettings,
} from '@/lib/fb-debug-actions'
import { FB_DEBUG_MAX_LINKS_PER_RUN } from '@/lib/fb-debug-limits'

async function getSessionUserId() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })

  return user?.id ?? null
}

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getUserFbDebugSettings(userId)
  if (!settings) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(settings)
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  if (typeof body?.bulkText === 'string') {
    const result = await addUserFbTokensBulk(userId, body.bulkText)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result)
  }

  const label = typeof body?.label === 'string' ? body.label : ''
  const token = typeof body?.token === 'string' ? body.token : ''
  const result = await addUserFbToken(userId, label, token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tokenId = typeof body?.tokenId === 'string' ? body.tokenId : ''
  const result = await deleteUserFbToken(userId, tokenId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json(result)
}

export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const result = await updateUserFbDebugSettings(userId, {
    intervalMinutes: body?.intervalMinutes,
    minClicksPerDay: body?.minClicksPerDay,
    debugAllActiveLinks: body?.debugAllActiveLinks,
    debugDailyAllActiveLinks: body?.debugDailyAllActiveLinks,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const action = body?.action

  if (action === 'check-all') {
    return NextResponse.json(await checkAllUserFbTokens(userId))
  }

  if (action === 'scrape') {
    const url = typeof body?.url === 'string' ? body.url : ''
    const result = await scrapeUrlForUser(userId, url)
    return NextResponse.json(result, { status: result.status })
  }

  if (action === 'test') {
    const tokenId = typeof body?.tokenId === 'string' ? body.tokenId : ''
    const result = await testUserFbToken(userId, tokenId)
    return NextResponse.json(result, { status: result.status })
  }

  if (action === 'run-now') {
    const limit = typeof body?.limit === 'number' ? body.limit : FB_DEBUG_MAX_LINKS_PER_RUN
    const result = await runUserFbDebugNow(userId, limit, { deferBatch: true })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    if (result.jobId) {
      after(async () => {
        await processFbDebugJobBatch(result.jobId, limit).catch(console.error)
      })
    }
    return NextResponse.json(result)
  }

  if (action === 'preview-run') {
    const limit = typeof body?.limit === 'number' ? body.limit : 200
    const result = await previewUserFbDebugNow(userId, limit)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Action khong hop le' }, { status: 400 })
}
