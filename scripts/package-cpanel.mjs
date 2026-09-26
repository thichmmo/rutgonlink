import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

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
const packagedStandalone = resolve(packageDir, '.next/standalone')
cpSync(standalone, packagedStandalone, { recursive: true, dereference: false })
materializeSymlinks(standalone, packagedStandalone)
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

function materializeSymlinks(sourceRoot, destinationRoot) {
  for (let pass = 0; pass < 5; pass += 1) {
    const links = []
    for (const entry of walk(destinationRoot)) {
      if (lstatSync(entry).isSymbolicLink()) links.push(entry)
    }
    if (links.length === 0) return

    let changed = false
    for (const destinationLink of links) {
      const relativePath = relative(destinationRoot, destinationLink)
      const sourceLink = resolve(sourceRoot, relativePath)
      const linkTarget = readlinkSync(destinationLink)
      const sourceTarget = existsSync(sourceLink)
        ? resolve(dirname(sourceLink), linkTarget)
        : resolve(dirname(destinationLink), linkTarget)

      rmSync(destinationLink, { recursive: true, force: true })
      if (!existsSync(sourceTarget)) {
        // Some pnpm optional dependencies are intentionally pruned from standalone.
        changed = true
        continue
      }
      cpSync(sourceTarget, destinationLink, { recursive: true, dereference: false })
      changed = true
    }
    if (!changed) return
  }

  const remaining = [...walk(packagedStandalone)].filter(entry => lstatSync(entry).isSymbolicLink())
  if (remaining.length > 0) throw new Error(`Unresolved standalone symlinks: ${remaining.slice(0, 5).join(', ')}`)
}

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    yield path
    if (entry.isDirectory()) yield* walk(path)
  }
}
