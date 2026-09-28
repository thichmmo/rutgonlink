/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

const source = fs.readFileSync('lib/video-embed.ts', 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const fixtureModule = { exports: {} }
new Function('module', 'exports', code)(fixtureModule, fixtureModule.exports)
const { normalizeVideoEmbedUrl } = fixtureModule.exports

const youtube = normalizeVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=12')
assert.equal(youtube.kind, 'iframe')
assert.equal(youtube.url, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=12')

const tiktok = normalizeVideoEmbedUrl('https://www.tiktok.com/@creator/video/1234567890123456789')
assert.equal(tiktok.url, 'https://www.tiktok.com/player/v1/1234567890123456789?lang=vi-VN')

const facebook = normalizeVideoEmbedUrl('https://www.facebook.com/watch/?v=123')
assert.match(facebook.url, /^https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=/)

const file = normalizeVideoEmbedUrl('https://cdn.example.com/video.mp4?token=abc')
assert.equal(file.kind, 'video')
assert.equal(file.url, 'https://cdn.example.com/video.mp4?token=abc')

assert.equal(normalizeVideoEmbedUrl('https://www.tiktok.com/view/product/123'), null)
assert.equal(normalizeVideoEmbedUrl('javascript:alert(1)'), null)
console.log('RESULT=PASS video-cases=6')
