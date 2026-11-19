import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BookOpen, CalendarDays } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { prisma } from '@/lib/prisma'
import { getSiteHostname } from '@/lib/site-config'
import { getPostPreviewImageUrl } from '@/lib/post-preview'
import { normalizeSettings, sanitizeRichHtml } from '@/lib/content-management'
import { preparePopupSettingsForRequest } from '@/lib/popup-settings-server'
import { MANAGED_MEDIA_CSS } from '@/lib/video-embed'
import { normalizeTelegramSettings } from '@/lib/telegram-settings'
import { renderTelegramHeader, renderTelegramFooter, TELEGRAM_POST_CSS } from '@/lib/telegram-render'
import { createPopupClickToken } from '@/lib/popup-click-token'
import { PUBLIC_POST_GUARD_CSS, PUBLIC_POST_NOSCRIPT_HTML } from '@/lib/public-post-guard'
import DesktopDevToolsGuard from './DesktopDevToolsGuard'
import PostPopup from './PostPopup'
import RawHtml from './RawHtml'
import TrancoDomainBooster from './TrancoDomainBooster'
import { getPopupStep } from '@/lib/popup-settings'
import { getPublicPostPath, isNumericPostSlug } from '@/lib/public-post-link'
import { resolveSystemPostFallback } from '@/lib/post-fallback-config'
import { resolveTrancoPingTargets } from '@/lib/tranco-boost-config'
import { MESALE_REDIRECT_URL } from '@/lib/traffic-source'
import { createFacebookHandoffToken, isServerFacebookTrafficSource, shouldRedirectToMesale } from '@/lib/facebook-handoff-token'

type Context = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

async function findPost(slug: string) {
  const include = {
    popup: true,
    domain: { select: { domain: true } },
    user: {
      select: {
        status: true,
        deletedAt: true,
        managedContentBlocks: { where: { isActive: true }, orderBy: [{ placement: 'asc' as const }, { sortOrder: 'asc' as const }] },
      },
    },
  }
  const exact = await prisma.managedPost.findFirst({
    where: { slug, isPublished: true, user: { status: 'active', deletedAt: null } },
    include,
  })
  if (exact) return { kind: 'post' as const, post: exact, isFallback: false }

  // Missing /posts/<slug> routes resolve the Admin-configured global fallback across the system.
  const fallback = await resolveSystemPostFallback((targetSlug) =>
    prisma.managedPost.findFirst({
      where: { slug: targetSlug, isPublished: true, user: { status: 'active', deletedAt: null } },
      include,
    }),
  )
  if (!fallback) return null
  return fallback.kind === 'post'
    ? { kind: 'post' as const, post: fallback.post, isFallback: true }
    : { kind: 'redirect' as const, redirectUrl: fallback.redirectUrl }
}

type LoadedPost = Extract<NonNullable<Awaited<ReturnType<typeof findPost>>>, { kind: 'post' }>['post']

function publicUrl(post: LoadedPost) {
  const domain = post?.domain?.domain || post?.sharedDomain || getSiteHostname()
  return `https://${domain}${getPublicPostPath(post?.slug || '')}`
}

const FACEBOOK_CRAWLER_UA_REGEX = /facebookexternalhit|facebookcatalog|Facebot|meta-externalagent|meta-externalfetcher|meta-webindexer/i

export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const { slug } = await params
  const match = await findPost(slug)
  if (!match || match.kind === 'redirect') return { title: 'Không tìm thấy bài viết', robots: { index: false } }
  const { post } = match
  const canonical = publicUrl(post)
  const plainText = (post.content || '').replace(/<[^>]+>/g, '').trim().slice(0, 160)
  // Fallback to post.title on video-only or direct-wrapper posts so og:description is never empty.
  const description = post.excerpt || plainText || post.title
  const image = getPostPreviewImageUrl(post)
  return {
    title: { absolute: post.title },
    description,
    referrer: 'no-referrer',
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      url: canonical,
      images: image ? [{ url: image, width: 1200, height: 630, alt: post.title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: post.title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

function RenderContent({ content, format }: { content: string; format: string }) {
  if (format === 'raw-html') return <RawHtml html={content} />
  if (format === 'rich') return <div className="managed-rich-content prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }} />
  const blocks = content.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean)
  return <>{blocks.map((block, index) => block.startsWith('## ')
    ? <h2 key={index} className="pt-4 text-2xl font-bold leading-snug text-gray-950">{block.slice(3)}</h2>
    : block.startsWith('# ')
      ? <h2 key={index} className="pt-4 text-3xl font-bold leading-snug text-gray-950">{block.slice(2)}</h2>
      : <p key={index} className="whitespace-pre-wrap">{block}</p>)}</>
}

export default async function ManagedPostPage({ params, searchParams }: Context) {
  const { slug } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const requestHeaders = await headers()
  const userAgent = requestHeaders.get('user-agent') || ''
  const referer = requestHeaders.get('referer') || ''
  const requestHost = (requestHeaders.get('host') || getSiteHostname()).split(':')[0].toLowerCase()
  if (shouldRedirectToMesale({ userAgent, referer, url: resolvedSearchParams, host: requestHost })) {
    redirect(MESALE_REDIRECT_URL)
  }
  const match = await findPost(slug)
  if (!match) notFound()
  if (match.kind === 'redirect') redirect(match.redirectUrl)
  const { post, isFallback } = match
  const fallbackCanonicalPath = isNumericPostSlug(post.slug) ? getPublicPostPath(post.slug) : `/posts/${encodeURIComponent(post.slug)}`
  const telegram = normalizeTelegramSettings(post.telegramSettings)
  const isDirectWrapper = Boolean(post.isDirectWrapper)
  const blocks = post.user.managedContentBlocks
  const before = blocks.filter(block => block.placement === 'before')
  const after = blocks.filter(block => block.placement !== 'before')
  const isFacebookCrawler = FACEBOOK_CRAWLER_UA_REGEX.test(userAgent)
  const isFacebookSource = isServerFacebookTrafficSource({
    userAgent,
    referer,
    url: resolvedSearchParams,
    host: requestHost,
  })
  const trancoTargets = isFacebookCrawler ? [] : await resolveTrancoPingTargets(requestHost)
  const tracking = post.popup ? { postId: post.id, popupId: post.popup.id, token: createPopupClickToken(post.id, post.popup.id, requestHeaders.get('host') || getSiteHostname()) } : undefined
  const normalizedSettings = post.popup ? normalizeSettings(post.popup.settings, post.popup.firstUrl, post.popup.secondUrl) : null
  const settings = !isFacebookCrawler && post.popup?.isActive && normalizedSettings
    ? await preparePopupSettingsForRequest(normalizedSettings, userAgent, { isFacebookSource })
    : normalizedSettings
  const fbHandoffToken = !isFacebookCrawler && isFacebookSource
    ? createFacebookHandoffToken(requestHost)
    : ''
  const directSteps = !isFacebookCrawler && isDirectWrapper && settings
    ? [getPopupStep(settings, 0, userAgent), getPopupStep(settings, 1, userAgent)].filter(item => item.url)
    : []

  return <>
    {!isFacebookCrawler && <noscript dangerouslySetInnerHTML={{ __html: PUBLIC_POST_NOSCRIPT_HTML }} />}
    <div className="managed-public-post min-h-screen bg-[#f8fafc] text-gray-900">
    {!isFacebookCrawler && <DesktopDevToolsGuard userAgent={userAgent} />}
    {!isFacebookCrawler && isFallback && <script dangerouslySetInnerHTML={{ __html: `try{if(window.history&&window.history.replaceState)window.history.replaceState(null,"",${JSON.stringify(fallbackCanonicalPath)}+window.location.search+window.location.hash)}catch(_){}` }} />}
    {isFacebookCrawler ? <main /> : isDirectWrapper ? <main data-direct-wrapper="" className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
        <h1 className="text-xl font-bold leading-snug text-gray-950">{post.title}</h1>
        <p className="mt-2.5 text-sm text-gray-500">Chọn liên kết bên dưới nếu ứng dụng chưa tự mở.</p>
        {directSteps.length > 0 && <div className="mt-5 grid gap-3">
          {directSteps.map(item => <a key={item.platform} href={item.launchUrl || item.url} rel="noopener noreferrer" referrerPolicy="no-referrer" className="block rounded-full bg-[#19181d] px-5 py-3.5 text-base font-bold text-white no-underline hover:bg-black">Mở {item.platform}</a>)}
        </div>}
      </div>
    </main> : telegram.enabled ? <main className="telegram-post-page">
      <article className="telegram-post">
        {before.map(block => <div key={block.id}><RenderContent content={block.content} format={block.contentFormat} /></div>)}
        <div dangerouslySetInnerHTML={{ __html: renderTelegramHeader(telegram) }} />
        <div className="managed-rich-content"><RenderContent content={post.content} format={post.contentFormat} /></div>
        {after.map(block => <div key={block.id}><RenderContent content={block.content} format={block.contentFormat} /></div>)}
        <div dangerouslySetInnerHTML={{ __html: renderTelegramFooter() }} />
      </article>
    </main> : <><Navbar />
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-32 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-sky-700"><BookOpen className="h-4 w-4" /> Bài viết</div>
      <article className="rounded-3xl border border-gray-200 bg-white px-5 py-9 shadow-sm sm:px-10 sm:py-12">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-950 sm:text-5xl">{post.title}</h1>
        <div className="mt-5 flex items-center gap-2 text-sm text-gray-500"><CalendarDays className="h-4 w-4" /> {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(post.createdAt)}</div>
        {post.excerpt && <p className="mt-8 border-l-4 border-sky-500 pl-5 text-lg leading-relaxed text-gray-600">{post.excerpt}</p>}
        {before.map(block => <div key={block.id} className="mt-8 border-y border-gray-100 py-5"><RenderContent content={block.content} format={block.contentFormat} /></div>)}
        <div className="mt-10 space-y-5 border-t border-gray-100 pt-9 text-base leading-8 text-gray-800"><RenderContent content={post.content} format={post.contentFormat} /></div>
        {after.map(block => <div key={block.id} className="mt-8 border-y border-gray-100 py-5"><RenderContent content={block.content} format={block.contentFormat} /></div>)}
      </article>
      <Link href="/" className="mt-8 inline-block text-sm font-medium text-sky-700 hover:underline">Về trang chủ</Link>
    </main>
    <Footer /></>}
    {!isFacebookCrawler && <style>{MANAGED_MEDIA_CSS + PUBLIC_POST_GUARD_CSS + TELEGRAM_POST_CSS}</style>}
    {!isFacebookCrawler && trancoTargets.length > 0 && <TrancoDomainBooster targets={trancoTargets} />}
    {!isFacebookCrawler && post.popup && settings && <PostPopup postId={post.id} userAgent={userAgent} isFacebookSource={isFacebookSource} fbHandoffToken={fbHandoffToken} tracking={tracking} popup={{ imageUrl: post.popup.imageUrl, firstUrl: post.popup.firstUrl, secondUrl: post.popup.secondUrl, updatedAt: post.popup.updatedAt.toISOString(), isActive: post.popup.isActive, settings }} />}
  </div></>
}
