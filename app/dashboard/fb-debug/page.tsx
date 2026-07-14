import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth-options'
import FbDebugClient from './FbDebugClient'

export default async function FbDebugPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  return <FbDebugClient />
}
