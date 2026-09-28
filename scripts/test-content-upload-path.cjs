/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const moduleUrl = pathToFileURL(path.join(root, 'lib/content-upload.ts')).href
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rutgonlink-upload-'))

function run(code, cwd, extraEnv = {}) {
  const result = spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', '--input-type=module', '-e', code], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv, TEST_MODULE: moduleUrl },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim()
}

const app = path.join(temp, 'app')
const live = path.join(app, '.next', 'standalone')
const staged = path.join(app, '.deploy', 'release-1', 'unpacked', '.next', 'standalone')
fs.mkdirSync(live, { recursive: true })
fs.mkdirSync(staged, { recursive: true })

const importDirectory = "const { getContentUploadDirectory } = await import(process.env.TEST_MODULE); console.log(getContentUploadDirectory())"
assert.equal(run(importDirectory, app), path.join(app, 'uploads', 'content'))
assert.equal(run(importDirectory, live), path.join(app, 'uploads', 'content'))
assert.equal(run(importDirectory, staged), path.join(app, 'uploads', 'content'))

const configured = path.join(temp, 'configured-media')
assert.equal(run(importDirectory, live, { CONTENT_UPLOAD_DIR: configured }), configured)

const roundTrip = "const { saveContentUpload, resolveContentUploadPath } = await import(process.env.TEST_MODULE); const saved = await saveContentUpload(new Uint8Array([1, 2, 3, 4]).buffer, 'image/png'); const file = resolveContentUploadPath(saved.filename); console.log(JSON.stringify({ ...saved, file }))"
const saved = JSON.parse(run(roundTrip, live, { CONTENT_UPLOAD_DIR: configured }))
assert.equal(saved.kind, 'image')
assert.equal(saved.size, 4)
assert.equal(fs.statSync(saved.file).size, 4)
assert.deepEqual([...fs.readFileSync(saved.file)], [1, 2, 3, 4])

fs.rmSync(temp, { recursive: true, force: true })
console.log('RESULT=PASS scenarios=5 round-trip=1')
