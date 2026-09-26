import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

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
copyTreeMaterialized(standalone, packagedStandalone)

// Next traces Prisma's external package below `.next/node_modules`; mirror the
// generated client there because its `default.js` resolves `.prisma/client` from
// that directory rather than from the standalone root.
const generatedPrisma = resolve(realpathSync(resolve(root, 'node_modules/@prisma/client')), '../../.prisma')
if (!existsSync(resolve(generatedPrisma, 'client/default.js'))) {
  throw new Error('Missing generated Prisma client; run prisma generate before building')
}
for (const runtimePath of ['node_modules/.prisma', '.next/node_modules/.prisma']) {
  const runtimePrisma = resolve(packagedStandalone, runtimePath)
  rmSync(runtimePrisma, { recursive: true, force: true })
  mkdirSync(dirname(runtimePrisma), { recursive: true })
  cpSync(generatedPrisma, runtimePrisma, { recursive: true, dereference: false })
}

cpSync(migrations, resolve(packageDir, 'prisma/migrations'), { recursive: true })
writeFileSync(resolve(packageDir, 'RELEASE_COMMIT'), process.env.GITHUB_SHA || 'local\n')

for (const required of [
  '.next/standalone/server.js',
  '.next/standalone/.next/BUILD_ID',
  '.next/standalone/.next/static',
  '.next/standalone/.next/node_modules/.prisma/client/default.js',
  '.next/standalone/node_modules/nanoid/non-secure/index.js',
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

function copyTreeMaterialized(source, destination, seen = new Set()) {
  const realSource = realpathSync(source)
  if (seen.has(realSource)) return
  seen.add(realSource)
  mkdirSync(destination, { recursive: true })
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = resolve(source, entry.name)
    const destinationPath = resolve(destination, entry.name)
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      let target
      try { target = realpathSync(sourcePath) } catch { continue }
      if (existsSync(target)) copyTreeMaterialized(target, destinationPath, seen)
      continue
    }
    cpSync(sourcePath, destinationPath, { dereference: true })
  }
}
