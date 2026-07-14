import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import {
  getEnvironmentGoogleOAuthCredentials,
  getGoogleOAuthCredentials,
  type GoogleOAuthCredentials,
} from '@/lib/google-oauth-config'

const THIRTY_DAYS = 30 * 24 * 60 * 60 // 30 ngày tính bằng giây
const isProduction = process.env.NODE_ENV === 'production'

export const buildAuthOptions = (googleOAuth: GoogleOAuthCredentials | null): NextAuthOptions => ({
  providers: [
      // Cấu hình DB từ admin được ưu tiên; biến môi trường là fallback an toàn.
      ...(googleOAuth
        ? [
            GoogleProvider({
              clientId: googleOAuth.clientId,
              clientSecret: googleOAuth.clientSecret,
            }),
          ]
      : []),

    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || user.status !== 'active' || !user.password) return null

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

        return { id: user.id, email: user.email, name: user.name ?? undefined }
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        if (!user.email) return false

        // Upsert tránh lỗi unique email khi hai callback Google đến gần nhau.
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: {},
          create: {
            email: user.email,
            name: user.name || user.email.split('@')[0],
            password: null,
          },
        })
        if (dbUser.status !== 'active') return false
      }
      return true
    },

    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google') {
          // user.id từ Google là OAuth ID (số dài), không phải DB cuid
          // Phải tìm DB user theo email để lấy đúng ID
          const dbUser = await prisma.user.findUnique({ where: { email: user.email! } })
          token.id = dbUser?.id ?? user.id
        } else {
          token.id = user.id
        }
          // Ghi lại thời điểm tạo token để tính sliding refresh
          token.createdAt = Math.floor(Date.now() / 1000)
          token.sessionIssuedAtMs = Date.now()
        // Đánh dấu admin
        token.isAdmin = user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.trim().toLowerCase()
      }

      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: {
            id: true,
            status: true,
            adminRole: true,
            deletedAt: true,
            sessionsRevokedAt: true,
          },
        })
        const issuedAtMs = Number(token.sessionIssuedAtMs || 0) || Number(token.createdAt || token.iat || 0) * 1000
        const wasRevoked = Boolean(
          dbUser?.sessionsRevokedAt &&
          (!issuedAtMs || dbUser.sessionsRevokedAt.getTime() >= issuedAtMs),
        )

        // Mọi getServerSession đều kiểm tra DB để khóa user/thu hồi phiên có hiệu lực ngay.
        token.invalid = !dbUser || dbUser.status !== 'active' || Boolean(dbUser.deletedAt) || wasRevoked
        if (dbUser && !token.invalid) {
          token.id = dbUser.id
          token.status = dbUser.status
          token.adminRole = dbUser.adminRole
          token.isAdmin =
            token.email.toLowerCase() === process.env.ADMIN_EMAIL?.trim().toLowerCase() || Boolean(dbUser.adminRole)
        }
      }
      // Sliding refresh: gia hạn thêm 30 ngày mỗi khi user còn active
      token.exp = Math.floor(Date.now() / 1000) + THIRTY_DAYS
      return token
    },

    async session({ session, token }) {
      if (token.invalid) {
        return { ...session, user: undefined }
      }

      if (token.id && session.user) {
        session.user.id = token.id as string
        session.user.isAdmin = token.isAdmin as boolean
        session.user.status = (token.status as string) || 'active'
        session.user.adminRole = (token.adminRole as string | null) || null
      }
      // Đồng bộ thời hạn session với token
      session.expires = new Date(Date.now() + THIRTY_DAYS * 1000).toISOString()
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: THIRTY_DAYS,     // Session sống 30 ngày
    updateAge: 60 * 60,      // Cập nhật cookie mỗi 1 giờ khi user còn active
  },

  jwt: {
    maxAge: THIRTY_DAYS,
  },

  cookies: {
    sessionToken: {
      name: isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: isProduction,
        maxAge: THIRTY_DAYS,
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  events: {
    async signIn({ user }) {
      if (!user.email) return
      await prisma.user.updateMany({
        where: { email: user.email, status: 'active' },
        data: { lastLoginAt: new Date() },
      })
    },
  },
})

// Các getServerSession chỉ cần callbacks/JWT; auth route dùng bản động bên dưới.
export const authOptions = buildAuthOptions(getEnvironmentGoogleOAuthCredentials())

export const getDynamicAuthOptions = async () => buildAuthOptions(await getGoogleOAuthCredentials())
