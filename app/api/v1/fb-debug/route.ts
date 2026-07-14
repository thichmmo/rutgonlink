import { NextRequest, NextResponse, after } from 'next/server'
import { authenticateApiKey } from '@/lib/api-v1-auth'
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

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const settings = await getUserFbDebugSettings(auth.user.id)
  if (!settings) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(settings)
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))

  if (typeof body?.bulkText === 'string') {
    const result = await addUserFbTokensBulk(auth.user.id, body.bulkText)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result, { status: 201 })
  }

  const label = typeof body?.label === 'string' ? body.label : ''
  const token = typeof body?.token === 'string' ? body.token : ''
  const result = await addUserFbToken(auth.user.id, label, token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json(result, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const tokenId = typeof body?.tokenId === 'string' ? body.tokenId : ''
  const result = await deleteUserFbToken(auth.user.id, tokenId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json(result)
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const result = await updateUserFbDebugSettings(auth.user.id, {
    intervalMinutes: body?.intervalMinutes,
    minClicksPerDay: body?.minClicksPerDay,
    debugAllActiveLinks: body?.debugAllActiveLinks,
    debugDailyAllActiveLinks: body?.debugDailyAllActiveLinks,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const action = body?.action

  if (action === 'check-all') {
    return NextResponse.json(await checkAllUserFbTokens(auth.user.id))
  }

  if (action === 'scrape') {
    const url = typeof body?.url === 'string' ? body.url : ''
    const result = await scrapeUrlForUser(auth.user.id, url)
    return NextResponse.json(result, { status: result.status })
  }

  if (action === 'test') {
    const tokenId = typeof body?.tokenId === 'string' ? body.tokenId : ''
    const result = await testUserFbToken(auth.user.id, tokenId)
    return NextResponse.json(result, { status: result.status })
  }

  if (action === 'run-now') {
    const limit = typeof body?.limit === 'number' ? body.limit : FB_DEBUG_MAX_LINKS_PER_RUN
    const result = await runUserFbDebugNow(auth.user.id, limit, { deferBatch: true })
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
    const result = await previewUserFbDebugNow(auth.user.id, limit)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Action khong hop le' }, { status: 400 })
}
