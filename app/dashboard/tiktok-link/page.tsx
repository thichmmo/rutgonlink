import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth-options'
import TikTokLinkClient from './TikTokLinkClient'

export default async function TikTokLinkPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return <TikTokLinkClient />
}
