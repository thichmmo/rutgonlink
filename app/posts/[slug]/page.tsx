import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, CalendarDays } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { prisma } from '@/lib/prisma'
import { getSiteHostname } from '@/lib/site-config'
import { sanitizeRichHtml } from '@/lib/content-management'
import { normalizePopupSettings } from '@/lib/popup-settings'
import PostPopup from './PostPopup'

type Context = { params: Promise<{ slug: string }> }

async function findPost(slug: string) {
  return prisma.managedPost.findFirst({
    where: { slug, isPublished: true, user: { status: 'active', deletedAt: null } },
    include: {
      popup: true,
      domain: { select: { domain: true } },
      user: { select: { managedContentBlocks: { where: { isActive: true }, orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] } } },
    },
  })
}

function publicUrl(post: Awaited<ReturnType<typeof findPost>>) {
  const domain = post?.domain?.domain || post?.sharedDomain || getSiteHostname()
  return `https://${domain}/${post?.slug || ''}`
}

export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const { slug } = await params
  const post = await findPost(slug)
  if (!post) return { title: 'Không tìm thấy bài viết', robots: { index: false } }
  const image = post.previewImage || undefined
  return {
    title: post.title,
    description: post.excerpt || post.content.replace(/<[^>]+>/g, '').slice(0, 160),
    alternates: { canonical: publicUrl(post) },
    openGraph: { title: post.title, description: post.excerpt || undefined, type: 'article', url: publicUrl(post), images: image ? [{ url: image }] : undefined },
  }
}

function RenderContent({ content, format }: { content: string; format: string }) {
  if (format === 'rich' || format === 'raw-html') return <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: format === 'rich' ? sanitizeRichHtml(content) : content }} />
  const blocks = content.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean)
  return <>{blocks.map((block, index) => block.startsWith('## ')
    ? <h2 key={index} className="pt-4 text-2xl font-bold leading-snug text-gray-950">{block.slice(3)}</h2>
    : block.startsWith('# ')
      ? <h2 key={index} className="pt-4 text-3xl font-bold leading-snug text-gray-950">{block.slice(2)}</h2>
      : <p key={index} className="whitespace-pre-wrap">{block}</p>)}</>
}

export default async function ManagedPostPage({ params }: Context) {
  const { slug } = await params
  const post = await findPost(slug)
  if (!post) notFound()
  const blocks = post.user.managedContentBlocks
  const before = blocks.filter(block => block.placement === 'before')
  const after = blocks.filter(block => block.placement !== 'before')
  const settings = post.popup ? normalizePopupSettings(post.popup.settings, post.popup.firstUrl, post.popup.secondUrl) : null

  return <div className="min-h-screen bg-[#f8fafc] text-gray-900">
    <Navbar />
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-32 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-sky-700"><BookOpen className="h-4 w-4" /> Bài viết</div>
      <article className="rounded-3xl border border-gray-200 bg-white px-5 py-9 shadow-sm sm:px-10 sm:py-12">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-950 sm:text-5xl">{post.title}</h1>
        <div className="mt-5 flex items-center gap-2 text-sm text-gray-500"><CalendarDays className="h-4 w-4" /> {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(post.createdAt)}</div>
        {post.previewImage && <img src={post.previewImage} alt="" className="mt-8 max-h-96 w-full rounded-2xl object-cover" />}
        {post.excerpt && <p className="mt-8 border-l-4 border-sky-500 pl-5 text-lg leading-relaxed text-gray-600">{post.excerpt}</p>}
        {before.map(block => <div key={block.id} className="mt-8 border-y border-gray-100 py-5"><RenderContent content={block.content} format={block.contentFormat} /></div>)}
        <div className="mt-10 space-y-5 border-t border-gray-100 pt-9 text-base leading-8 text-gray-800"><RenderContent content={post.content} format={post.contentFormat} /></div>
        {after.map(block => <div key={block.id} className="mt-8 border-y border-gray-100 py-5"><RenderContent content={block.content} format={block.contentFormat} /></div>)}
      </article>
      <Link href="/" className="mt-8 inline-block text-sm font-medium text-sky-700 hover:underline">Về trang chủ</Link>
    </main>
    <Footer />
    {post.popup && settings && <PostPopup postId={post.id} popup={{ imageUrl: post.popup.imageUrl, firstUrl: post.popup.firstUrl, secondUrl: post.popup.secondUrl, updatedAt: post.popup.updatedAt.toISOString(), isActive: post.popup.isActive, settings }} />}
  </div>
}
