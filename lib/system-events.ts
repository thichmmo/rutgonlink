import { prisma } from '@/lib/prisma'

export async function recordSystemEvent(input: {
  type: string
  source: string
  status: 'ok' | 'warning' | 'error'
  message?: string | null
  details?: unknown
}) {
  await prisma.systemEvent.create({
    data: {
      type: input.type,
      source: input.source,
      status: input.status,
      message: input.message || null,
      details: input.details === undefined ? null : JSON.stringify(input.details),
    },
  })
}
