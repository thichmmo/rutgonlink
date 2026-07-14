import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

const THEMES: Record<string, { bg: string; card: string; text: string; subtext: string; btn: string }> = {
  default: {
    bg: 'bg-gradient-to-br from-blue-50 to-indigo-100',
    card: 'bg-white/80 backdrop-blur border border-white/60 shadow-md',
    text: 'text-gray-900',
    subtext: 'text-gray-500',
    btn: 'bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-800',
  },
  dark: {
    bg: 'bg-gray-950',
    card: 'bg-gray-900/80 border border-gray-800',
    text: 'text-white',
    subtext: 'text-gray-400',
    btn: 'bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white',
  },
  gradient: {
    bg: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400',
    card: 'bg-white/10 backdrop-blur border border-white/20',
    text: 'text-white',
    subtext: 'text-white/70',
    btn: 'bg-white/20 border border-white/30 hover:bg-white/30 text-white backdrop-blur',
  },
  nature: {
    bg: 'bg-gradient-to-br from-sky-50 to-emerald-100',
    card: 'bg-white/80 backdrop-blur border border-emerald-100 shadow-md',
    text: 'text-gray-900',
    subtext: 'text-gray-500',
    btn: 'bg-white border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-gray-800',
  },
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const page = await prisma.bioPage.findUnique({ where: { username } })
  if (!page) return { title: 'Not Found' }
  return {
    title: page.title || `@${username}`,
    description: page.description || `Xem tất cả links của @${username}`,
  }
}

export default async function BioPublicPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const page = await prisma.bioPage.findUnique({
    where: { username },
    include: { links: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }, user: true },
  })

  if (!page || !page.isPublic) notFound()

  const theme = THEMES[page.theme] || THEMES.default

  return (
    <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-start px-4 py-12`}>
      <div className="w-full max-w-md space-y-6">
        {/* Profile */}
        <div className="flex flex-col items-center gap-3 text-center">
          {page.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.avatar}
              alt={page.title || username}
              className="w-20 h-20 rounded-full object-cover border-4 border-white/50 shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white">{(page.title || username)[0]?.toUpperCase()}</span>
            </div>
          )}
          <div>
            <h1 className={`text-xl font-bold ${theme.text}`}>{page.title || `@${username}`}</h1>
            {page.description && (
              <p className={`text-sm mt-1 max-w-xs ${theme.subtext}`}>{page.description}</p>
            )}
            <p className={`text-xs mt-1 ${theme.subtext}`}>@{username}</p>
          </div>
        </div>

        {/* Links */}
        <div className="space-y-3">
          {page.links.length === 0 ? (
            <p className={`text-center text-sm ${theme.subtext}`}>Chưa có link nào</p>
          ) : (
            page.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between w-full px-5 py-3.5 rounded-2xl font-medium text-sm transition-all duration-200 cursor-pointer ${theme.btn}`}
              >
                <div className="flex items-center gap-3">
                  {link.icon && <span className="text-lg">{link.icon}</span>}
                  <span>{link.title}</span>
                </div>
                <ExternalLink className="w-4 h-4 opacity-50 shrink-0" />
              </a>
            ))
          )}
        </div>

        {/* Footer */}
        <p className={`text-center text-xs ${theme.subtext} opacity-60`}>
          Powered by{' '}
          <Link href="/" className="underline hover:opacity-100">LinkShort</Link>
        </p>
      </div>
    </div>
  )
}
