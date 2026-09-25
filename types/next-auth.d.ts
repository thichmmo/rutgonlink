import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user?: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isAdmin?: boolean
      status?: string
      adminRole?: string | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    createdAt?: number
    sessionIssuedAtMs?: number
    isAdmin?: boolean
    invalid?: boolean
    status?: string
    adminRole?: string | null
  }
}
