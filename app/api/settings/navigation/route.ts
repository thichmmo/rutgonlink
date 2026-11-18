import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getManagedContentActor } from '@/lib/content-management'
import {
  getUserDashboardNavVisibility,
  saveUserDashboardNavVisibility,
} from '@/lib/dashboard-nav-visibility-server'

const updateNavSchema = z
  .object({
    links: z.boolean().optional(),
    folders: z.boolean().optional(),
    analytics: z.boolean().optional(),
    notes: z.boolean().optional(),
    fbDebug: z.boolean().optional(),
  })
  .strict()

export async function GET() {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const visibility = await getUserDashboardNavVisibility(actor.id)
  return NextResponse.json({ visibility })
}

export async function PUT(req: NextRequest) {
  const actor = await getManagedContentActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = updateNavSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' },
      { status: 400 },
    )
  }

  const visibility = await saveUserDashboardNavVisibility(actor.id, parsed.data)
  return NextResponse.json({ visibility })
}
