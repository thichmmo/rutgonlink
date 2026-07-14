import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const standaloneDir = resolve(root, '.next/standalone')
const staticSource = resolve(root, '.next/static')
const staticTarget = resolve(standaloneDir, '.next/static')
const publicSource = resolve(root, 'public')
const publicTarget = resolve(standaloneDir, 'public')

if (!existsSync(resolve(standaloneDir, 'server.js'))) {
  throw new Error('err: .next/standalone/server.js not found; run next build first')
}

// Xóa bản cũ để artifact không giữ static/public đã lỗi thời từ lần build trước.
rmSync(staticTarget, { recursive: true, force: true })
rmSync(publicTarget, { recursive: true, force: true })
cpSync(staticSource, staticTarget, { recursive: true })
cpSync(publicSource, publicTarget, { recursive: true })

// Secrets phải được cấu hình trong cPanel Node.js App, không đóng gói cùng artifact.
for (const envFile of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  rmSync(resolve(standaloneDir, envFile), { force: true })
}

console.log('[cpanel] standalone bundle prepared')
