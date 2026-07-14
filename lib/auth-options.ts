import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

const THIRTY_DAYS = 30 * 24 * 60 * 60 // 30 ngày tính bằng giây
const isProduction = process.env.NODE_ENV === 'production'
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
const isGoogleAuthConfigured = Boolean(googleClientId && googleClientSecret)

if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
  console.error('[auth] err google oauth config incomplete')
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Google OAuth — requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env
    ...(isGoogleAuthConfigured
      ? [
          GoogleProvider({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
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

        if (!user || !user.password) return null

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
        await prisma.user.upsert({
          where: { email: user.email },
          update: {},
          create: {
            email: user.email,
            name: user.name || user.email.split('@')[0],
            password: null,
          },
        })
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
        // Đánh dấu admin
        token.isAdmin = user.email === process.env.ADMIN_EMAIL
      }
      // Tự sửa token cũ bị lưu Google OAuth ID (chuỗi số thuần)
      // Google OAuth IDs là số nguyên dài (~21 chữ số), DB cuids bắt đầu bằng chữ cái
      if (token.id && typeof token.id === 'string' && /^\d+$/.test(token.id) && token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email as string } })
        if (dbUser) token.id = dbUser.id
      }
      // Fallback: nếu vẫn chưa có id, tìm theo email
      if (!token.id && token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email as string } })
        if (dbUser) token.id = dbUser.id
      }
      // Sliding refresh: gia hạn thêm 30 ngày mỗi khi user còn active
      token.exp = Math.floor(Date.now() / 1000) + THIRTY_DAYS
      return token
    },

    async session({ session, token }) {
      if (token.id && session.user) {
        (session.user as { id?: string; isAdmin?: boolean }).id = token.id as string
        ;(session.user as { id?: string; isAdmin?: boolean }).isAdmin = token.isAdmin as boolean
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
}
