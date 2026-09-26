import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const outputDir = resolve(process.env.CPANEL_ARTIFACT_DIR || resolve(root, '.artifacts/cpanel'))
const standalone = resolve(root, '.next/standalone')
const migrations = resolve(root, 'prisma/migrations')
const packageDir = resolve(outputDir, 'release')

if (!existsSync(resolve(standalone, 'server.js'))) {
  throw new Error('Missing .next/standalone/server.js; build the app first')
}
if (!existsSync(migrations)) throw new Error('Missing prisma/migrations')

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(packageDir, { recursive: true })

// Dereference standalone symlinks so cPanel does not depend on local pnpm paths.
cpSync(standalone, resolve(packageDir, '.next/standalone'), { recursive: true, dereference: true })
cpSync(migrations, resolve(packageDir, 'prisma/migrations'), { recursive: true })
writeFileSync(resolve(packageDir, 'RELEASE_COMMIT'), process.env.GITHUB_SHA || 'local\n')

for (const required of [
  '.next/standalone/server.js',
  '.next/standalone/.next/BUILD_ID',
  '.next/standalone/.next/static',
  '.next/standalone/public',
  'prisma/migrations',
]) {
  if (!existsSync(resolve(packageDir, required))) throw new Error(`Missing packaged path: ${required}`)
}

console.log(`Packaged cPanel release at ${packageDir}`)
console.log(`Build ID: ${readFileSync(resolve(packageDir, '.next/standalone/.next/BUILD_ID'), 'utf8').trim()}`)
console.log(`Migration files: ${countMigrationFiles(resolve(packageDir, 'prisma/migrations'))}`)

function countMigrationFiles(path) {
  return readdirSync(path, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(resolve(path, entry.name, 'migration.sql'))).length
}
