import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'
import { getDynamicAuthOptions } from '@/lib/auth-options'

const handler = async (
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) => NextAuth(await getDynamicAuthOptions())(request, context)

export { handler as GET, handler as POST }
