import { NextRequest, NextResponse } from 'next/server'
import { getManagedContentUserId } from '@/lib/content-management'
import { getPopupClickCounts, getPopupClickList, getPopupClickTotals } from '@/lib/popup-analytics-server'

export async function GET(req: NextRequest) {
  const userId = await getManagedContentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = req.nextUrl.searchParams
  const now = new Date()
  const headers = { 'Cache-Control': 'private, no-store' }
  const group = params.get('group')
  if (group) {
    if (group !== 'post' && group !== 'popup') return NextResponse.json({ error: 'Invalid group' }, { status: 400 })
    const ids = [...new Set((params.get('ids') || '').split(',').filter(Boolean))]
    if (ids.length > 50 || ids.some(id => !/^[a-zA-Z0-9_-]{1,191}$/.test(id))) return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 })
    const [totals, counts] = await Promise.all([getPopupClickTotals(userId, now), getPopupClickCounts(userId, group, ids, now)])
    return NextResponse.json({ totals, counts, generatedAt: now.toISOString() }, { headers })
  }
  const integer = (key: string, fallback: number, max: number) => {
    const value = Number(params.get(key))
    return Number.isInteger(value) && value >= 1 ? Math.min(value, max) : fallback
  }
  const pageSize = integer('pageSize', 10, 25)
  const [totals, posts, popups] = await Promise.all([
    getPopupClickTotals(userId, now),
    getPopupClickList(userId, 'post', (params.get('postQuery') || '').trim().slice(0, 120), params.get('postSort') || 'today', integer('postPage', 1, 10000), pageSize, now),
    getPopupClickList(userId, 'popup', (params.get('popupQuery') || '').trim().slice(0, 120), params.get('popupSort') || 'today', integer('popupPage', 1, 10000), pageSize, now),
  ])
  return NextResponse.json({ totals, posts, popups, generatedAt: now.toISOString(), timezone: 'Asia/Ho_Chi_Minh' }, { headers })
}
