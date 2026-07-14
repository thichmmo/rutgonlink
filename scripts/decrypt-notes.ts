// Script để decrypt note content khi cần đọc thẳng từ DB
// Chạy: ENCRYPTION_KEY="..." npx tsx scripts/decrypt-notes.ts

import { createDecipheriv, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = process.env.ENCRYPTION_KEY || ''

function getKey(): Buffer {
  return createHash('sha256').update(KEY).digest()
}

function decrypt(data: string): string {
  try {
    const parts = data.split(':')
    if (parts.length !== 3) return data
    const [ivHex, authTagHex, encryptedHex] = parts
    const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch {
    return data
  }
}

// Dán chuỗi encrypted từ DB vào đây
const encryptedFromDB = process.argv[2] || ''

if (!encryptedFromDB) {
  console.log('Usage: ENCRYPTION_KEY="your-key" npx tsx scripts/decrypt-notes.ts "<encrypted_string>"')
  process.exit(1)
}

console.log('Decrypted:', decrypt(encryptedFromDB))
