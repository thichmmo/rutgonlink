import { NextRequest, NextResponse } from 'next/server'
import { getManagedContentUserId } from '@/lib/content-management'
import { getContentUploadPolicy, saveContentUpload } from '@/lib/content-upload'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!(await getManagedContentUserId())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Chưa chọn tệp' }, { status: 400 })
    const policy = getContentUploadPolicy(file.type)
    if (!policy) return NextResponse.json({ error: 'Chỉ hỗ trợ ảnh PNG/JPG/WebP/GIF/AVIF hoặc video MP4/WebM/OGG' }, { status: 400 })
    if (!file.size) return NextResponse.json({ error: 'Tệp rỗng' }, { status: 400 })
    if (file.size > policy.maxBytes) return NextResponse.json({ error: `${policy.kind === 'image' ? 'Ảnh' : 'Video'} vượt quá ${policy.kind === 'image' ? '8MB' : '50MB'}` }, { status: 400 })
    const saved = await saveContentUpload(await file.arrayBuffer(), file.type)
    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể tải tệp lên' }, { status: 400 })
  }
}
