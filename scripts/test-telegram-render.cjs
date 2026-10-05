/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
// Render both public post paths using real helpers; database and request context are fixtures.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

process.env.NEXTAUTH_URL = 'https://rutgonlink.site'
const sourceRoot = path.resolve(process.env.POPUP_TEST_ROOT || '.')
const baseline = process.argv.includes('--baseline')
const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140'
const cache = new Map()
let currentPost
let passed = 0

function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  let source = fs.readFileSync(path.join(sourceRoot, file), 'utf8')
  if (file === 'app/[shortCode]/route.ts') source += '\nexports.buildManagedPostPage = buildManagedPostPage;'
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const localRequire = id => {
    if (id === '@/lib/prisma') return { prisma: { managedPost: { findFirst: async () => currentPost } } }
    if (id === 'next/headers') return { headers: async () => new Headers({ 'user-agent': desktop, host: 'fixture.example' }) }
    if (id === 'next/navigation') return { notFound: () => { throw new Error('Fixture post not found') } }
    if (id === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children)
    if (id === '@/components/Navbar' || id === '@/components/Footer') return () => null
    if (id === '@/lib/popup-click-token') return { createPopupClickToken: () => 'fixture-token' }
    if (id.startsWith('./') || id.startsWith('../')) {
      const relative = path.posix.join(path.posix.dirname(file), id)
      const extension = ['.ts', '.tsx'].find(ext => fs.existsSync(path.join(sourceRoot, relative + ext)))
      assert.ok(extension, 'Local test import is resolvable: ' + id)
      return load(relative + extension)
    }
    if (id.startsWith('@/lib/')) {
      const allowed = ['popup-settings', 'popup-link', 'popup-settings-server', 'popup-click-client',
        'tiktok-link', 'content-management', 'intermediate-image', 'site-config', 'video-embed',
        'post-preview', 'public-post-guard', 'telegram-settings', 'telegram-render']
      return allowed.includes(id.slice(6)) ? load(id.slice(2) + '.ts') : {}
    }
    if (id === 'next/server' || id === 'next-auth') return {}
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}

const savedSettings = {
  enabled: true,
  url: 'https://t.me/+SavedGroupInvite',
  buttonText: '✈️ VÀO NHÓM TELEGRAM NGAY',
  disclaimer: 'Nội dung tham khảo.\nLiên hệ để yêu cầu chỉnh sửa hoặc gỡ bỏ.',
}
function fixture(settings = savedSettings) {
  return {
    id: 'telegram-post-1', slug: 'telegram-fixture', title: 'SEO fixture title',
    excerpt: 'SEO fixture excerpt', createdAt: new Date('2026-10-05T00:00:00.000Z'),
    content: '<figure class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Fixture video" width="560" height="315" allowfullscreen></iframe></figure>',
    contentFormat: 'rich', telegramSettings: settings, popup: null, domain: null,
    user: { managedContentBlocks: [
      { id: 'before', placement: 'before', content: '<p>Fixed before content</p>', contentFormat: 'rich' },
      { id: 'after', placement: 'after', content: '<p>Fixed after content</p>', contentFormat: 'rich' },
    ], telegramSettings: { ...savedSettings, url: 'https://t.me/ChangedAccountDefault', buttonText: 'New account default' } },
  }
}

const buildPage = load('app/[shortCode]/route.ts').buildManagedPostPage
const reactPage = load('app/posts/[slug]/page.tsx')
async function render(kind, post) {
  currentPost = post
  return kind === 'route' ? buildPage(post, 'fixture.example', desktop)
    : renderToStaticMarkup(await reactPage.default({ params: Promise.resolve({ slug: post.slug }) }))
}
function documentFor(html) { return new JSDOM(html).window.document }
function cta(doc) {
  return Array.from(doc.querySelectorAll('a[href]')).find(a => /^(?:t\.me|telegram\.me)$/.test(new URL(a.href, 'https://fixture.example').hostname))
}
function before(a, b, label) {
  assert.ok(a && b, label + ': both nodes exist')
  assert.ok(a.compareDocumentPosition(b) & 4, label)
}
async function check(name, fn) {
  await fn()
  passed += 1
  console.log('PASS ' + name)
}

async function main() {
  if (baseline) {
    for (const kind of ['route', 'react']) await check(kind + ': baseline ignores Telegram settings', async () => {
      const doc = documentFor(await render(kind, fixture()))
      assert.equal(cta(doc), undefined)
      assert.equal(doc.querySelector('h1')?.textContent, 'SEO fixture title')
      assert.ok(doc.querySelector('iframe'))
    })
    console.log(`BASELINE_OK ${passed} scenarios: Telegram settings ignored before feature`)
    return
  }

  const { renderTelegramHeader, renderTelegramFooter, TELEGRAM_POST_CSS } = load('lib/telegram-render.ts')
  await check('shared header matches CTA and plain text disclaimer', () => {
    const doc = documentFor(renderTelegramHeader(savedSettings))
    const button = cta(doc)
    assert.equal(button?.href, savedSettings.url)
    assert.equal(button.textContent, savedSettings.buttonText)
    assert.equal(button.target, '_blank')
    assert.ok(button.relList.contains('noopener'))
    assert.ok(button.relList.contains('noreferrer'))
    assert.ok(doc.body.textContent.includes(savedSettings.disclaimer))
    assert.match(TELEGRAM_POST_CSS, /#229ed9/i)
    assert.match(TELEGRAM_POST_CSS, /border-radius\s*:\s*50px/i)
    assert.match(TELEGRAM_POST_CSS, /text-align\s*:\s*center/i)
  })
  await check('shared footer targets main site privacy policy', () => {
    const doc = documentFor(renderTelegramFooter())
    const link = doc.querySelector('a')
    assert.equal(link?.href, 'https://rutgonlink.site/chinh-sach-bao-mat')
    assert.equal(link.textContent, 'Chính sách bảo mật')
  })
  for (const input of [null, undefined, {}, { ...savedSettings, enabled: false }]) {
    await check('shared header absent for disabled or missing settings ' + JSON.stringify(input), () => {
      assert.equal(renderTelegramHeader(input), '')
    })
  }

  const invalidUrls = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'https://t.me.attacker.example/group', 'https://t.me@attacker.example/group',
    'https://attacker.example/group', 'https://user:password@t.me/group', ''];
  for (const url of invalidUrls) await check('shared header rejects URL ' + url, () => {
    const doc = documentFor(renderTelegramHeader({ ...savedSettings, url }))
    assert.equal(cta(doc), undefined)
    assert.equal(doc.querySelector('a[href]'), null)
  })
  for (const url of ['https://t.me/example_group', 'https://telegram.me/example_group']) {
    await check('shared header accepts Telegram URL ' + url, () => {
      assert.equal(cta(documentFor(renderTelegramHeader({ ...savedSettings, url })))?.href, url)
    })
  }

  const malicious = { ...savedSettings, buttonText: '<img src=x onerror="alert(1)"> & "button"',
    disclaimer: '</p><script>telegram_settings_xss</script><img src=x onerror="alert(1)">\nSecond line & text' }
  await check('shared header escapes all user controlled text', () => {
    const doc = documentFor(renderTelegramHeader(malicious))
    assert.equal(cta(doc)?.textContent, malicious.buttonText)
    assert.ok(doc.body.textContent.includes(malicious.disclaimer))
    assert.equal(doc.querySelector('script,img,[onerror],[onclick]'), null)
  })

  await check('blank disclaimer is optional without an empty paragraph', () => {
    const doc = documentFor(renderTelegramHeader({ ...savedSettings, disclaimer: '' }))
    assert.equal(cta(doc)?.href, savedSettings.url)
    assert.equal(doc.querySelector('p'), null)
  })

  for (const kind of ['route', 'react']) {
    await check(kind + ': enabled template keeps CTA, text, media and policy order', async () => {
      const doc = documentFor(await render(kind, fixture()))
      const button = cta(doc)
      const media = doc.querySelector('iframe')
      const disclaimer = Array.from(doc.querySelectorAll('p,div')).find(node => node.textContent === savedSettings.disclaimer)
      const policy = Array.from(doc.querySelectorAll('a')).find(node => node.textContent === 'Chính sách bảo mật')
      assert.equal(button?.href, savedSettings.url)
      assert.equal(button.target, '_blank')
      assert.ok(button.relList.contains('noopener') && button.relList.contains('noreferrer'))
      before(button, disclaimer, 'CTA precedes disclaimer')
      before(disclaimer, media, 'Disclaimer precedes media')
      before(media, policy, 'Media precedes privacy policy')
      assert.equal(policy.href, 'https://rutgonlink.site/chinh-sach-bao-mat')
      assert.equal(doc.querySelector('h1'), null, 'Minimal Telegram page has no visual SEO title')
      const fixedBefore = Array.from(doc.querySelectorAll('p')).find(node => node.textContent === 'Fixed before content')
      const fixedAfter = Array.from(doc.querySelectorAll('p')).find(node => node.textContent === 'Fixed after content')
      before(fixedBefore, button, 'Fixed before block precedes Telegram header')
      before(media, fixedAfter, 'Fixed after block follows media')
      before(fixedAfter, policy, 'Policy follows fixed after block')
      assert.equal(doc.querySelector('.managed-popup,[role="dialog"]'), null, 'Fixture does not open affiliate popups')
    })
    for (const settings of [undefined, null, { ...savedSettings, enabled: false }]) {
      await check(kind + ': original layout survives ' + JSON.stringify(settings), async () => {
        const post = fixture(settings)
        // Passing undefined to fixture uses its default; delete it to represent a pre-migration row.
        if (settings === undefined) delete post.telegramSettings
        const doc = documentFor(await render(kind, post))
        assert.equal(cta(doc), undefined, 'Account defaults must not retroactively enable a saved post')
        assert.equal(doc.querySelector('h1')?.textContent, post.title)
        assert.ok(doc.querySelector('iframe'))
        assert.ok(doc.body.textContent.includes('Fixed before content'))
        assert.ok(doc.body.textContent.includes('Fixed after content'))
      })
    }
    await check(kind + ': post snapshot wins over changed account defaults', async () => {
      const post = fixture()
      const oldHtml = await render(kind, post)
      post.user.telegramSettings = { enabled: false, url: 'https://t.me/new_group', buttonText: 'Changed', disclaimer: 'Changed' }
      const newHtml = await render(kind, post)
      assert.equal(newHtml, oldHtml)
      assert.equal(cta(documentFor(newHtml))?.href, savedSettings.url)
    })
    await check(kind + ': Telegram rendering adds no navigation or tracking scripts', async () => {
      const enabled = documentFor(await render(kind, fixture()))
      const disabled = documentFor(await render(kind, fixture({ ...savedSettings, enabled: false })))
      const scripts = doc => Array.from(doc.querySelectorAll('script')).map(node => node.outerHTML)
      assert.deepEqual(scripts(enabled), scripts(disabled))
      assert.equal(enabled.querySelector('[onclick],[onmousedown],[onmouseup]'), null)
    })
    await check(kind + ': saved text is escaped without executable elements', async () => {
      const doc = documentFor(await render(kind, fixture(malicious)))
      assert.equal(cta(doc)?.textContent, malicious.buttonText)
      assert.ok(doc.body.textContent.includes(malicious.disclaimer))
      assert.equal(doc.querySelector('[onerror],[onclick]'), null)
      assert.ok(Array.from(doc.querySelectorAll('script')).every(script => !script.textContent.includes('telegram_settings_xss')))
    })
    await check(kind + ': invalid saved Telegram destination emits no CTA', async () => {
      const doc = documentFor(await render(kind, fixture({ ...savedSettings, url: 'javascript:alert(1)' })))
      assert.equal(cta(doc), undefined)
      assert.equal(doc.querySelector('a[href^="javascript:"]'), null)
      assert.ok(doc.querySelector('iframe'), 'Invalid Telegram settings must not remove article media')
    })
    await check(kind + ': uploaded video and image content survive minimal template', async () => {
      const post = fixture()
      post.content = '<video src="/uploads/content/fixture-video.mp4" controls playsinline></video><img src="/uploads/content/fixture-image.webp" alt="Image fixture">'
      const doc = documentFor(await render(kind, post))
      assert.equal(doc.querySelector('video')?.getAttribute('src'), '/uploads/content/fixture-video.mp4')
      assert.equal(doc.querySelector('img')?.getAttribute('src'), '/uploads/content/fixture-image.webp')
      before(cta(doc), doc.querySelector('video'), 'CTA stays above uploaded video')
    })
  }
  await check('SEO metadata retains title, excerpt and canonical', async () => {
    currentPost = fixture()
    const metadata = await reactPage.generateMetadata({ params: Promise.resolve({ slug: currentPost.slug }) })
    assert.equal(metadata.title.absolute, currentPost.title)
    assert.equal(metadata.description, currentPost.excerpt)
    assert.equal(metadata.alternates.canonical, 'https://rutgonlink.site/telegram-fixture')
    const doc = documentFor(await render('route', currentPost))
    assert.equal(doc.title, currentPost.title)
    assert.equal(doc.querySelector('meta[property="og:title"]')?.content, currentPost.title)
    assert.equal(doc.querySelector('meta[property="og:description"]')?.content, currentPost.excerpt)
    assert.equal(doc.querySelector('link[rel="canonical"]')?.href, 'https://fixture.example/telegram-fixture')
  })
  const exportIndex = process.argv.indexOf('--export-fixture')
  if (exportIndex >= 0) {
    const destination = process.argv[exportIndex + 1]
    assert.ok(destination, '--export-fixture requires an output directory')
    fs.mkdirSync(destination, { recursive: true })
    const doc = documentFor(await render('route', fixture()))
    // Static visual QA must not execute redirects, contact affiliate URLs or require third-party media.
    doc.querySelectorAll('script,noscript').forEach(node => node.remove())
    const media = doc.querySelector('iframe')
    media.removeAttribute('src')
    media.setAttribute('srcdoc', '<body style="margin:0;background:#101827;color:#fff;display:grid;place-items:center;height:100vh;font:20px system-ui">Video xem trước</body>')
    const output = path.resolve(destination, 'telegram-fixture.html')
    fs.writeFileSync(output, '<!doctype html>\n' + doc.documentElement.outerHTML)
    console.log('FIXTURE ' + output)
  }
  console.log(`TELEGRAM_RENDER_OK ${passed} scenarios`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
