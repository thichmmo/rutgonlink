import { NextRequest, NextResponse } from 'next/server'
import { runFbDebugBatch, runScheduledActions } from '@/lib/fb-debug-cron'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CronResult = {
  task: string
  status: 'ok' | 'error'
  message?: string
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

async function handleCronRun(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/run] err: CRON_SECRET missing')
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 })
  }

  // cPanel có thể truyền secret bằng header hoặc query parameter.
  const providedSecret = request.headers.get('x-cron-secret') ?? request.nextUrl.searchParams.get('secret')
  if (providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const results: CronResult[] = []

  try {
    await runScheduledActions()
    results.push({ task: 'runScheduledActions', status: 'ok' })
  } catch (error) {
    const message = getErrorMessage(error)
    console.error('[cron/run] err scheduled actions', message)
    results.push({ task: 'runScheduledActions', status: 'error', message })
  }

  try {
    await runFbDebugBatch()
    results.push({ task: 'runFbDebugBatch', status: 'ok' })
  } catch (error) {
    const message = getErrorMessage(error)
    console.error('[cron/run] err fb debug batch', message)
    results.push({ task: 'runFbDebugBatch', status: 'error', message })
  }

  const ok = results.every((result) => result.status === 'ok')

  return NextResponse.json(
    {
      ok,
      startedAt,
      completedAt: new Date().toISOString(),
      results,
    },
    { status: ok ? 200 : 207 },
  )
}

export async function GET(request: NextRequest) {
  return handleCronRun(request)
}

export async function POST(request: NextRequest) {
  return handleCronRun(request)
}
