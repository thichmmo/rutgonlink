import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { paymentEmitter } from '@/lib/payment-emitter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const paymentId = searchParams.get('paymentId')
  if (!paymentId) {
    return new Response('Missing paymentId', { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      const close = () => {
        if (closed) return
        closed = true
        try { controller.close() } catch {}
      }

      // Check current status immediately (handles refresh after payment done)
      const payment = await prisma.payment.findFirst({
        where: { id: paymentId, userId: user.id },
      })

      if (!payment) {
        send({ error: 'not_found' })
        close()
        return
      }

      if (payment.status === 'completed') {
        send({ status: 'completed' })
        close()
        return
      }

      send({ status: 'pending' })

      // Listen for real-time completion from webhook
      const onCompleted = (pId: string) => {
        if (pId !== paymentId) return
        send({ status: 'completed' })
        cleanup()
        close()
      }

      // Heartbeat to keep connection alive (every 25s)
      const heartbeat = setInterval(() => {
        if (closed) { cleanup(); return }
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          cleanup()
        }
      }, 25000)

      const cleanup = () => {
        clearInterval(heartbeat)
        paymentEmitter.off('payment:completed', onCompleted)
      }

      paymentEmitter.on('payment:completed', onCompleted)

      req.signal.addEventListener('abort', () => {
        cleanup()
        close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
