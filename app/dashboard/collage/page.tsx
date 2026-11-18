import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import {
  canActorUseFbViralCollage,
  getUserCollageHistory,
  getUserCollageSettings,
  isImplicitFbViralAdminUser,
} from '@/lib/reaction-collage-server'
import ReactionCollageStudio from './ReactionCollageStudio'

export default async function DashboardCollagePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, status: true, deletedAt: true, adminRole: true },
  })
  if (!user || user.status !== 'active' || user.deletedAt) redirect('/login')

  const isAdmin = isImplicitFbViralAdminUser(user)
  const [settings, canUseFbViral, items] = await Promise.all([
    getUserCollageSettings(user.id),
    canActorUseFbViralCollage({ id: user.id, isAdmin }),
    getUserCollageHistory(user.id),
  ])

  return (
    <ReactionCollageStudio
      initialSettings={settings}
      initialCanUseFbViral={canUseFbViral}
      initialItems={items}
    />
  )
}
