import { NextRequest, NextResponse } from 'next/server'
import { getManagedContentActor } from '@/lib/content-management'
import {
  MAX_COLLAGE_INPUT_BYTES,
  REACTION_CORNERS,
  type ReactionCorner,
} from '@/lib/reaction-collage-config'
import {
  canActorUseFbViralCollage,
  clearUserCollageHistory,
  createUserCollageAndPruneHistory,
  deleteUserCollageHistoryItem,
  getUserCollageHistory,
  getUserCollageSettings,
} from '@/lib/reaction-collage-server'

export const runtime = 'nodejs'

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

export async function GET() {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [settings, items] = await Promise.all([
    getUserCollageSettings(actor.id),
    getUserCollageHistory(actor.id),
  ])

  return NextResponse.json(
    { settings, items },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Chưa có ảnh để ghép' }, { status: 400 })
    }
    if (!SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json({ error: 'Chỉ hỗ trợ ảnh JPG, PNG, WebP, GIF hoặc AVIF' }, { status: 400 })
    }
    if (!file.size || file.size > MAX_COLLAGE_INPUT_BYTES) {
      return NextResponse.json({ error: 'Ảnh rỗng hoặc vượt quá 12MB' }, { status: 400 })
    }

    const rawCorner = String(formData.get('corner') || '').trim()
    const corner = (REACTION_CORNERS as readonly string[]).includes(rawCorner)
      ? (rawCorner as ReactionCorner)
      : undefined

    const rawScale = formData.get('scalePercent')
    const scalePercent = rawScale !== null && rawScale !== '' && Number.isFinite(Number(rawScale))
      ? Number(rawScale)
      : undefined

    // Admin permission is checked silently server-side and never exposed to user UI/JSON.
    const canUseFbViral = await canActorUseFbViralCollage(actor)
    const bytes = Buffer.from(await file.arrayBuffer())
    const { item, items } = await createUserCollageAndPruneHistory(actor.id, bytes, canUseFbViral, {
      corner,
      scalePercent,
    })

    return NextResponse.json(
      { item, items },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể ghép ảnh' },
      { status: 400 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clearAll = req.nextUrl.searchParams.get('all') === '1'
  const id = req.nextUrl.searchParams.get('id')?.trim() || ''

  if (clearAll) {
    const items = await clearUserCollageHistory(actor.id)
    return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  if (!id) {
    return NextResponse.json({ error: 'Thiếu ID ảnh cần xóa' }, { status: 400 })
  }

  const items = await deleteUserCollageHistoryItem(actor.id, id)
  return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'private, no-store' } })
}
