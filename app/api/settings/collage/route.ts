import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getManagedContentActor } from '@/lib/content-management'
import {
  isAllowedTemplateImageUrl,
  MAX_COLLAGE_INPUT_BYTES,
  REACTION_CORNERS,
} from '@/lib/reaction-collage-config'
import {
  getUserCollageSettings,
  saveUserCollageSettings,
  saveUserReactionTemplateUpload,
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

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  templateImageUrl: z.string().trim().max(500).refine(isAllowedTemplateImageUrl, 'URL ảnh mẫu không hợp lệ').optional(),
  corner: z.enum(REACTION_CORNERS).optional(),
  scalePercent: z.number().min(20).max(58).optional(),
}).strict()

export async function GET() {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getUserCollageSettings(actor.id)
  return NextResponse.json(
    { settings },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function PUT(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Dữ liệu cài đặt không hợp lệ' },
      { status: 400 },
    )
  }

  const settings = await saveUserCollageSettings(actor.id, parsed.data)
  return NextResponse.json(
    { ok: true, settings },
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
      return NextResponse.json({ error: 'Chưa chọn ảnh mẫu' }, { status: 400 })
    }
    if (!SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json({ error: 'Chỉ hỗ trợ ảnh JPG, PNG, WebP, GIF hoặc AVIF' }, { status: 400 })
    }
    if (!file.size || file.size > MAX_COLLAGE_INPUT_BYTES) {
      return NextResponse.json({ error: 'Ảnh mẫu rỗng hoặc vượt quá 12MB' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const settings = await saveUserReactionTemplateUpload(actor.id, bytes)
    return NextResponse.json(
      { ok: true, settings },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể xử lý ảnh mẫu' },
      { status: 400 },
    )
  }
}
