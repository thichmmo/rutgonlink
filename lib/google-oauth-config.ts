import { decrypt, encrypt } from '@/lib/encrypt'
import { prisma } from '@/lib/prisma'

const GOOGLE_CLIENT_ID_KEY = 'google_oauth_client_id'
const GOOGLE_CLIENT_SECRET_KEY = 'google_oauth_client_secret'

export type GoogleOAuthCredentials = {
  clientId: string
  clientSecret: string
  source: 'database' | 'environment'
}

const getEnvironmentCredentials = (): GoogleOAuthCredentials | null => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, source: 'environment' }
}

const decryptStoredSecret = (value: string) => {
  const decrypted = decrypt(value)
  const looksEncrypted = /^[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/i.test(value)
  if (looksEncrypted && decrypted === value)
    throw new Error('Stored Google OAuth secret cannot be decrypted')
  return decrypted.trim()
}

export const getGoogleOAuthCredentials =
  async (): Promise<GoogleOAuthCredentials | null> => {
    try {
      const rows = await prisma.appSetting.findMany({
        where: {
          key: { in: [GOOGLE_CLIENT_ID_KEY, GOOGLE_CLIENT_SECRET_KEY] },
        },
        select: { key: true, value: true },
      })
      const settings = new Map(rows.map(({ key, value }) => [key, value]))
      const clientId = settings.get(GOOGLE_CLIENT_ID_KEY)?.trim()
      const encryptedSecret = settings.get(GOOGLE_CLIENT_SECRET_KEY)
      const clientSecret = encryptedSecret
        ? decryptStoredSecret(encryptedSecret)
        : ''
      if (clientId && clientSecret)
        return { clientId, clientSecret, source: 'database' }
    } catch (error) {
      console.error(
        '[oauth] err loading google config',
        error instanceof Error ? error.message : 'unknown',
      )
    }

    return getEnvironmentCredentials()
  }

export const getGoogleOAuthStatus = async () => {
  const credentials = await getGoogleOAuthCredentials()
  const storedSecret = await prisma.appSetting.findUnique({
    where: { key: GOOGLE_CLIENT_SECRET_KEY },
    select: { id: true },
  })

  return {
    configured: Boolean(credentials),
    source: credentials?.source || 'none',
    clientId: credentials?.clientId || '',
    hasStoredSecret: Boolean(storedSecret),
  } as const
}

export const saveGoogleOAuthCredentials = async (input: {
  clientId: string
  clientSecret?: string
}) => {
  const existingSecret = await prisma.appSetting.findUnique({
    where: { key: GOOGLE_CLIENT_SECRET_KEY },
    select: { value: true },
  })
  const submittedSecret = input.clientSecret?.trim()
  const fallbackSecret = getEnvironmentCredentials()?.clientSecret
  const encryptedSecret = submittedSecret
    ? encrypt(submittedSecret)
    : existingSecret?.value || (fallbackSecret ? encrypt(fallbackSecret) : null)

  if (!encryptedSecret) throw new Error('Google Client Secret is required')

  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: GOOGLE_CLIENT_ID_KEY },
      update: { value: input.clientId.trim() },
      create: { key: GOOGLE_CLIENT_ID_KEY, value: input.clientId.trim() },
    }),
    prisma.appSetting.upsert({
      where: { key: GOOGLE_CLIENT_SECRET_KEY },
      update: { value: encryptedSecret },
      create: { key: GOOGLE_CLIENT_SECRET_KEY, value: encryptedSecret },
    }),
  ])

  return getGoogleOAuthStatus()
}

export const clearStoredGoogleOAuthCredentials = async () => {
  await prisma.appSetting.deleteMany({
    where: { key: { in: [GOOGLE_CLIENT_ID_KEY, GOOGLE_CLIENT_SECRET_KEY] } },
  })
  return getGoogleOAuthStatus()
}

export const getEnvironmentGoogleOAuthCredentials = getEnvironmentCredentials
