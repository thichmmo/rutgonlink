import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getUserCollageHistory, getUserCollageSettings } from '@/lib/reaction-collage-server'
import ReactionCollageStudio from './ReactionCollageStudio'

export default async function DashboardCollagePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, status: true, deletedAt: true },
  })
  if (!user || user.status !== 'active' || user.deletedAt) redirect('/login')

  const [settings, items] = await Promise.all([
    getUserCollageSettings(user.id),
    getUserCollageHistory(user.id),
  ])

  return (
    <ReactionCollageStudio
      initialSettings={settings}
      initialItems={items}
    />
  )
}
