import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { customAlphabet } from 'nanoid'
import { SHARED_DOMAINS } from '@/lib/shared-domains'
import { getSiteHostname } from '@/lib/site-config'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6)

function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  return lines.map(line => {
    const result: string[] = []
    let inQuotes = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)

  if (rows.length < 2) return NextResponse.json({ error: 'File CSV không có dữ liệu' }, { status: 400 })

  // Skip header row, process max 500 rows
  const dataRows = rows.slice(1, 501)
  const appHost = getSiteHostname()

  // Load user's verified domains once
  const userDomains = await prisma.domain.findMany({
    where: { userId: user.id, verified: true },
  })

  const created: string[] = []
  const errors: { row: number; error: string }[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    // Expected columns (from our export format):
    // [shortCode, originalUrl, title, domain, category, clicks, status, expiresAt, maxClicks, createdAt]
    // Minimal required: column 0 (shortCode optional), column 1 (originalUrl required)
    const rawUrl = (row[1] || row[0] || '').trim()
    if (!rawUrl || !rawUrl.startsWith('http')) {
      errors.push({ row: i + 2, error: 'URL không hợp lệ' })
      continue
    }

    try {
      const targetHost = new URL(rawUrl).hostname
      if (targetHost === appHost) {
        errors.push({ row: i + 2, error: 'Không dùng domain app' })
        continue
      }

      const title = (row[2] || '').trim() || null
      const csvDomain = (row[3] || '').trim().toLowerCase()
      const maxClicksRaw = (row[8] || '').trim()
      const maxClicks = maxClicksRaw ? parseInt(maxClicksRaw) || null : null

      // Resolve domain: use CSV domain if valid, else random shared domain. Never use root domain.
      let domainId: string | null = null
      let sharedDomain: string | null = null

      if (csvDomain && csvDomain !== appHost) {
        const matchedUserDomain = userDomains.find(d => d.domain === csvDomain)
        if (matchedUserDomain) {
          domainId = matchedUserDomain.id
        } else if (SHARED_DOMAINS.includes(csvDomain)) {
          sharedDomain = csvDomain
        }
      }

      // If no domain resolved, pick a random shared domain
      if (!domainId && !sharedDomain) {
        sharedDomain = SHARED_DOMAINS[Math.floor(Math.random() * SHARED_DOMAINS.length)]
      }

      // Generate unique shortCode
      let shortCode = nanoid()
      let tries = 0
      while (tries < 5) {
        const exists = await prisma.link.findUnique({ where: { shortCode } })
        if (!exists) break
        shortCode = nanoid()
        tries++
      }

      await prisma.link.create({
        data: {
          userId: user.id,
          shortCode,
          originalUrl: rawUrl,
          title,
          maxClicks,
          ...(domainId ? { domainId } : {}),
          ...(sharedDomain ? { sharedDomain } : {}),
        },
      })
      created.push(shortCode)
    } catch {
      errors.push({ row: i + 2, error: 'Lỗi tạo link' })
    }
  }

  return NextResponse.json({
    created: created.length,
    errors: errors.length,
    details: errors.slice(0, 20),
  })
}
