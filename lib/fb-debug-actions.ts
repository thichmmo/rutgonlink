import { prisma } from '@/lib/prisma'
import { triggerFbScrape } from '@/lib/runtime-config'
import { getVietnamDayBoundaries } from '@/lib/vn-time'
import { getSiteUrl } from '@/lib/site-config'
import {
  FB_DEBUG_BATCH_RETRY_MS,
  FB_DEBUG_BATCH_RETRY_MINUTES,
  FB_DEBUG_BLOCK_BACKOFF_MINUTES,
  FB_DEBUG_BLOCK_BACKOFF_MS,
  FB_DEBUG_INVALID_PARAMETER_RETRY_LIMIT,
  FB_DEBUG_MAX_LINKS_PER_RUN,
  FB_DEBUG_URL_COOLDOWN_MINUTES,
  FB_DEBUG_URL_COOLDOWN_MS,
  clampFbDebugRunLimit,
} from '@/lib/fb-debug-limits'

type FbTokenStatus = 'live' | 'die' | 'unknown'

type FbTokenRecord = {
  id: string
  label: string
  token: string
  status: string
  createdAt: Date
  lastChecked: Date | null
}

type FbDebugRunnableLink = {
  id: string
  shortCode: string
  lastFbDebug: Date | null
  domain: { domain: string } | null
  sharedDomain: string | null
}

type FbDebugJobItemState = {
  id: string
  order: number
  attempts: number
}

type FbDebugProcessResult = {
  linkId: string
  shortCode: string
  shortUrl: string
  ok: boolean
  usedToken: boolean
  primaryTokenIndex?: number | null
  tokenIndexUsed?: number | null
  tokenAttempts?: number
  skipped?: boolean
  message: string | null
  errorCode: number | null
  willRetry?: boolean
}

const userScrapeTokenStartIndex = new Map<string, number>()

export function maskFbToken(token: string) {
  if (token.length <= 8) return '***'
  return token.slice(0, 4) + '...' + token.slice(-4)
}

export function formatFbToken(token: FbTokenRecord) {
  return {
    id: token.id,
    label: token.label,
    masked: maskFbToken(token.token),
    addedAt: token.createdAt.toISOString(),
    status: token.status as FbTokenStatus,
    lastChecked: token.lastChecked?.toISOString(),
  }
}

function parseBulkLine(line: string, index: number) {
  const trimmed = line.trim()
  if (!trimmed) return null

  let label = `Token ${index + 1}`
  let token = trimmed
  const colonIndex = trimmed.indexOf(':')

  if (colonIndex > 0 && colonIndex < 80) {
    const left = trimmed.slice(0, colonIndex).trim()
    const right = trimmed.slice(colonIndex + 1).trim()
    if (left && right) {
      label = left
      token = right
    }
  }

  if (!token) return null
  return { label, token }
}

async function getFbDebugLinkCount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fbDebugAllActiveLinks: true, fbDebugMinClicksPerDay: true },
  })

  const where = buildFbDebugLinkWhere(userId, { allActiveLinks: user?.fbDebugAllActiveLinks ?? false })
  if (user?.fbDebugAllActiveLinks || !user?.fbDebugMinClicksPerDay) {
    return prisma.link.count({ where })
  }

  const candidateLinks = await prisma.link.findMany({
    where,
    select: { id: true },
  })
  const qualifiedIds = await getLinkIdsMeetingMinClicks(
    candidateLinks.map((link) => link.id),
    user.fbDebugMinClicksPerDay,
  )

  return qualifiedIds.size
}

async function getActiveLinkCount(userId: string) {
  return prisma.link.count({
    where: { userId, isActive: true },
  })
}

async function getDailyPendingLinkCount(userId: string) {
  const { startOfToday } = getVietnamDayBoundaries()
  return prisma.link.count({
    where: {
      userId,
      isActive: true,
      OR: [
        { lastFbDebug: null },
        { lastFbDebug: { lt: startOfToday } },
      ],
    },
  })
}

async function getLinkIdsMeetingMinClicks(linkIds: string[], minClicksPerDay: number) {
  if (minClicksPerDay <= 0) return new Set(linkIds)
  if (linkIds.length === 0) return new Set<string>()

  const { startOfToday } = getVietnamDayBoundaries()
  const clickGroups = await prisma.click.groupBy({
    by: ['linkId'],
    where: { linkId: { in: linkIds }, createdAt: { gte: startOfToday } },
    _count: { _all: true },
  })

  return new Set(
    clickGroups
      .filter((group) => group._count._all >= minClicksPerDay)
      .map((group) => group.linkId),
  )
}

async function getTodayClickCounts(linkIds: string[]) {
  if (linkIds.length === 0) return new Map<string, number>()

  const { startOfToday } = getVietnamDayBoundaries()
  const clickGroups = await prisma.click.groupBy({
    by: ['linkId'],
    where: { linkId: { in: linkIds }, createdAt: { gte: startOfToday } },
    _count: { _all: true },
  })

  return new Map(clickGroups.map((group) => [group.linkId, group._count._all]))
}

function buildShortUrl(link: {
  shortCode: string
  domain: { domain: string } | null
  sharedDomain: string | null
}) {
  const baseUrl = getSiteUrl()
  const host = link.domain?.domain
    ? `https://${link.domain.domain}`
    : link.sharedDomain
      ? `https://${link.sharedDomain}`
      : baseUrl
  return `${host}/${link.shortCode}`
}

function buildFbDebugLinkWhere(
  userId: string,
  options: { allActiveLinks?: boolean; onlyNotDebuggedToday?: boolean } = {},
) {
  const where: Record<string, unknown> = {
    userId,
    isActive: true,
  }

  if (!options.allActiveLinks) {
    where.AND = [
      {
        OR: [
          { originalUrl: { contains: '\n' } },
          { useFolderRotation: true, folderAssignments: { some: {} } },
        ],
      },
      {
        OR: [
          { ogEnabled: false },
          { ogEnabled: true, ogTitle: null, ogDescription: null, ogImage: null },
        ],
      },
    ]
  }

  if (options.onlyNotDebuggedToday) {
    const { startOfToday } = getVietnamDayBoundaries()
    where.OR = [
      { lastFbDebug: null },
      { lastFbDebug: { lt: startOfToday } },
    ]
  }

  return where
}

export async function getUserFbDebugSettings(userId: string) {
  const [user, tokens, debugLinkCount, dailyActiveLinkCount, dailyPendingLinkCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        fbDebugIntervalMinutes: true,
        fbDebugMinClicksPerDay: true,
        fbDebugAllActiveLinks: true,
        fbDebugDailyAllActiveLinks: true,
      },
    }),
    prisma.fbToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    getFbDebugLinkCount(userId),
    getActiveLinkCount(userId),
    getDailyPendingLinkCount(userId),
  ])

  if (!user) return null

  return {
    tokens: tokens.map(formatFbToken),
    intervalMinutes: user.fbDebugIntervalMinutes,
    minClicksPerDay: user.fbDebugMinClicksPerDay,
    debugAllActiveLinks: user.fbDebugAllActiveLinks,
    debugDailyAllActiveLinks: user.fbDebugDailyAllActiveLinks,
    debugLinkCount,
    dailyActiveLinkCount,
    dailyPendingLinkCount,
  }
}

export async function addUserFbToken(userId: string, label: string, token: string) {
  const cleanToken = token.trim()
  if (!cleanToken) {
    return { ok: false as const, status: 400, error: 'Token khong duoc de trong' }
  }

  const created = await prisma.fbToken.create({
    data: {
      userId,
      label: label.trim() || 'Token',
      token: cleanToken,
      status: 'unknown',
    },
  })

  const settings = await getUserFbDebugSettings(userId)
  return {
    ok: true as const,
    token: formatFbToken(created),
    tokens: settings?.tokens ?? [],
  }
}

export async function addUserFbTokensBulk(userId: string, bulkText: string) {
  const entries = bulkText
    .split('\n')
    .map((line, index) => parseBulkLine(line, index))
    .filter((entry): entry is { label: string; token: string } => !!entry)

  if (entries.length === 0) {
    return { ok: false as const, status: 400, error: 'Khong co token hop le' }
  }

  await prisma.fbToken.createMany({
    data: entries.map((entry) => ({
      userId,
      label: entry.label,
      token: entry.token,
      status: 'unknown',
    })),
  })

  const settings = await getUserFbDebugSettings(userId)
  return {
    ok: true as const,
    added: entries.length,
    tokens: settings?.tokens ?? [],
  }
}

export async function deleteUserFbToken(userId: string, tokenId: string) {
  if (!tokenId) {
    return { ok: false as const, status: 400, error: 'Thieu tokenId' }
  }

  const result = await prisma.fbToken.deleteMany({
    where: { id: tokenId, userId },
  })

  if (result.count === 0) {
    return { ok: false as const, status: 404, error: 'Token not found' }
  }

  const settings = await getUserFbDebugSettings(userId)
  return {
    ok: true as const,
    tokens: settings?.tokens ?? [],
  }
}

export async function updateUserFbDebugSettings(
  userId: string,
  input: {
    intervalMinutes?: unknown
    minClicksPerDay?: unknown
    debugAllActiveLinks?: unknown
    debugDailyAllActiveLinks?: unknown
  },
) {
  const data: {
    fbDebugIntervalMinutes?: number
    fbDebugMinClicksPerDay?: number
    fbDebugAllActiveLinks?: boolean
    fbDebugDailyAllActiveLinks?: boolean
  } = {}

  if (typeof input.intervalMinutes === 'number' && input.intervalMinutes >= 1) {
    data.fbDebugIntervalMinutes = Math.floor(input.intervalMinutes)
  }
  if (typeof input.minClicksPerDay === 'number' && input.minClicksPerDay >= 0) {
    data.fbDebugMinClicksPerDay = Math.floor(input.minClicksPerDay)
  }
  if (typeof input.debugAllActiveLinks === 'boolean') {
    data.fbDebugAllActiveLinks = input.debugAllActiveLinks
  }
  if (typeof input.debugDailyAllActiveLinks === 'boolean') {
    data.fbDebugDailyAllActiveLinks = input.debugDailyAllActiveLinks
  }

  if (Object.keys(data).length === 0) {
    return { ok: false as const, status: 400, error: 'Khong co gi de cap nhat' }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      fbDebugIntervalMinutes: true,
      fbDebugMinClicksPerDay: true,
      fbDebugAllActiveLinks: true,
      fbDebugDailyAllActiveLinks: true,
    },
  })

  const [debugLinkCount, dailyActiveLinkCount, dailyPendingLinkCount] = await Promise.all([
    getFbDebugLinkCount(userId),
    getActiveLinkCount(userId),
    getDailyPendingLinkCount(userId),
  ])

  return {
    ok: true as const,
    intervalMinutes: updated.fbDebugIntervalMinutes,
    minClicksPerDay: updated.fbDebugMinClicksPerDay,
    debugAllActiveLinks: updated.fbDebugAllActiveLinks,
    debugDailyAllActiveLinks: updated.fbDebugDailyAllActiveLinks,
    debugLinkCount,
    dailyActiveLinkCount,
    dailyPendingLinkCount,
  }
}

export async function verifyFbTokenValue(token: string) {
  const query = new URLSearchParams({ fields: 'id,name', access_token: token })

  try {
    const res = await fetch(`https://graph.facebook.com/app?${query.toString()}`, { cache: 'no-store' })
    const data = await res.json().catch(() => null)

    if (!res.ok || data?.error) {
      return {
        ok: false as const,
        status: 'die' as FbTokenStatus,
        message: data?.error?.message || 'Token khong hop le',
        errorCode: data?.error?.code ?? null,
        errorType: data?.error?.type ?? null,
      }
    }

    const appInfo = [data?.name, data?.id ? `(${data.id})` : ''].filter(Boolean).join(' ')
    return {
      ok: true as const,
      status: 'live' as FbTokenStatus,
      message: `Live${appInfo ? ` - ${appInfo}` : ''}`,
      appId: data?.id ?? null,
      appName: data?.name ?? null,
    }
  } catch {
    return {
      ok: false as const,
      status: 'die' as FbTokenStatus,
      message: 'Khong the ket noi Facebook API',
      errorCode: null,
      errorType: null,
    }
  }
}

export async function checkAllUserFbTokens(userId: string) {
  const tokens = await prisma.fbToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  const updated = await Promise.all(
    tokens.map(async (token) => {
      const result = await verifyFbTokenValue(token.token)
      return prisma.fbToken.update({
        where: { id: token.id },
        data: {
          status: result.status,
          lastChecked: new Date(),
        },
      })
    }),
  )

  return {
    ok: true,
    checked: updated.length,
    tokens: updated.map(formatFbToken),
  }
}

export async function testUserFbToken(userId: string, tokenId: string) {
  if (!tokenId) {
    return { ok: false as const, status: 400, message: 'Thieu tokenId' }
  }

  const token = await prisma.fbToken.findFirst({
    where: { id: tokenId, userId },
  })

  if (!token) {
    return { ok: false as const, status: 404, message: 'Khong tim thay token' }
  }

  const result = await verifyFbTokenValue(token.token)
  await prisma.fbToken.update({
    where: { id: token.id },
    data: {
      status: result.status,
      lastChecked: new Date(),
    },
  })

  return {
    ...result,
    status: result.ok ? 200 : 200,
  }
}

async function getUserScrapeTokenList(userId: string) {
  const tokenRows = await prisma.fbToken.findMany({
    where: { userId, status: { not: 'die' } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    select: { token: true },
  })
  const tokens = tokenRows.map((token) => token.token)
  const envToken = process.env.FACEBOOK_APP_TOKEN?.trim()
  if (tokens.length === 0 && envToken) tokens.push(envToken)
  return tokens
}

async function getUserScrapeTokens(userId: string) {
  const tokenRows = await prisma.fbToken.findMany({
    where: { userId, status: { not: 'die' } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    select: { token: true },
  })
  const tokens = tokenRows.map((token) => token.token)
  const envToken = process.env.FACEBOOK_APP_TOKEN?.trim()
  if (tokens.length === 0 && envToken) tokens.push(envToken)
  return tokens
}

function normalizeFbTokenIndex(index: number | undefined, tokenCount: number) {
  if (tokenCount <= 0) return null
  if (!Number.isFinite(index)) return 0
  return ((Math.floor(index ?? 0) % tokenCount) + tokenCount) % tokenCount
}

function buildFbTokenAttemptOrder(tokenCount: number, startIndex?: number) {
  const normalizedStartIndex = normalizeFbTokenIndex(startIndex, tokenCount)
  if (normalizedStartIndex === null) return { primaryTokenIndex: null, order: [] as number[] }

  return {
    primaryTokenIndex: normalizedStartIndex,
    order: Array.from({ length: tokenCount }, (_, offset) => (normalizedStartIndex + offset) % tokenCount),
  }
}

function getNextUserScrapeStartIndex(userId: string, tokenCount: number) {
  if (tokenCount <= 0) return undefined
  const currentIndex = userScrapeTokenStartIndex.get(userId) ?? 0
  userScrapeTokenStartIndex.set(userId, currentIndex + 1)
  return currentIndex
}

export async function scrapeWithFbTokens(
  url: string,
  tokens: string[],
  options: { startIndex?: number } = {},
) {
  if (tokens.length === 0) {
    return {
      ...(await triggerFbScrape(url, undefined)),
      allTokensBlocked: false,
      primaryTokenIndex: null,
      tokenIndexUsed: null,
      tokenAttempts: 0,
    }
  }

  const { primaryTokenIndex, order } = buildFbTokenAttemptOrder(tokens.length, options.startIndex)
  let lastResult = await triggerFbScrape(url, tokens[order[0]])
  let lastTokenIndex = order[0]
  let blockedCount = lastResult.errorCode === 368 ? 1 : 0
  if (lastResult.ok) {
    return {
      ...lastResult,
      allTokensBlocked: false,
      primaryTokenIndex,
      tokenIndexUsed: lastTokenIndex,
      tokenAttempts: 1,
    }
  }

  for (let i = 1; i < order.length; i++) {
    lastTokenIndex = order[i]
    const result = await triggerFbScrape(url, tokens[lastTokenIndex])
    if (result.ok) {
      return {
        ...result,
        allTokensBlocked: false,
        primaryTokenIndex,
        tokenIndexUsed: lastTokenIndex,
        tokenAttempts: i + 1,
      }
    }
    if (result.errorCode === 368) blockedCount++
    lastResult = result
  }

  return {
    ...lastResult,
    allTokensBlocked: blockedCount === tokens.length,
    primaryTokenIndex,
    tokenIndexUsed: lastTokenIndex,
    tokenAttempts: order.length,
  }
}

function getNextFbDebugBatchTime() {
  return new Date(Date.now() + FB_DEBUG_BATCH_RETRY_MS)
}

function getBlockedFbDebugBatchTime() {
  return new Date(Date.now() + FB_DEBUG_BLOCK_BACKOFF_MS)
}

function isRecentlyFbDebugged(lastFbDebug: Date | null | undefined) {
  return !!lastFbDebug && Date.now() - lastFbDebug.getTime() < FB_DEBUG_URL_COOLDOWN_MS
}

async function findLinkByShortUrl(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const shortCode = parsed.pathname.split('/').filter(Boolean)[0]
  if (!shortCode) return null

  return prisma.link.findFirst({
    where: {
      shortCode,
      OR: [
        { sharedDomain: parsed.hostname },
        { domain: { domain: parsed.hostname } },
      ],
    },
    select: {
      id: true,
      shortCode: true,
      lastFbDebug: true,
      domain: { select: { domain: true } },
      sharedDomain: true,
    },
  })
}

async function getQualifiedFbDebugLinks(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fbDebugMinClicksPerDay: true, fbDebugAllActiveLinks: true },
  })

  if (!user) return null

  const where = buildFbDebugLinkWhere(userId, { allActiveLinks: user.fbDebugAllActiveLinks })
  if (!user.fbDebugAllActiveLinks && user.fbDebugMinClicksPerDay > 0) {
    const candidateLinks = await prisma.link.findMany({
      where,
      select: { id: true },
    })
    const qualifiedIds = await getLinkIdsMeetingMinClicks(
      candidateLinks.map((link) => link.id),
      user.fbDebugMinClicksPerDay,
    )

    if (qualifiedIds.size === 0) return { user, links: [] as FbDebugRunnableLink[] }
    where.id = { in: [...qualifiedIds] }
  }

  const links = await prisma.link.findMany({
    where,
    select: {
      id: true,
      shortCode: true,
      lastFbDebug: true,
      domain: { select: { domain: true } },
      sharedDomain: true,
    },
    orderBy: [
      { lastFbDebug: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return { user, links }
}

async function processFbDebugLinks(
  userId: string,
  links: FbDebugRunnableLink[],
  options: { jobItemsByLinkId?: Map<string, FbDebugJobItemState> } = {},
) {
  const tokens = await getUserScrapeTokens(userId)
  const results: FbDebugProcessResult[] = []
  let blockedByFacebook = false
  let scrapeIndex = 0

  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    const shortUrl = buildShortUrl(link)
    if (isRecentlyFbDebugged(link.lastFbDebug)) {
      const processedAt = new Date()
      const result = {
        linkId: link.id,
        shortCode: link.shortCode,
        shortUrl,
        ok: true,
        usedToken: false,
        skipped: true,
        message: `Skipped: scraped trong ${FB_DEBUG_URL_COOLDOWN_MINUTES} phut gan day`,
        errorCode: null,
      }
      const jobItem = options.jobItemsByLinkId?.get(link.id)
      if (jobItem) {
        await prisma.fbDebugJobItem.update({
          where: { id: jobItem.id },
          data: {
            status: 'success',
            attempts: { increment: 1 },
            shortUrl,
            message: result.message,
            errorCode: null,
            processedAt,
          },
        }).catch(() => {})
      }
      results.push(result)
      continue
    }

    const processedAt = new Date()

    // Assign a primary token per actual scrape so batch traffic is spread across live tokens.
    const jobItem = options.jobItemsByLinkId?.get(link.id)
    const result = await scrapeWithFbTokens(shortUrl, tokens, { startIndex: jobItem?.order ?? scrapeIndex })
    scrapeIndex++
    const nextAttempts = (jobItem?.attempts ?? 0) + 1
    // Code 100 can be transient for a short URL, so keep the job item pending until a bounded retry limit.
    const shouldRetryInvalidParameter =
      !!jobItem &&
      !result.ok &&
      result.errorCode === 100 &&
      nextAttempts < FB_DEBUG_INVALID_PARAMETER_RETRY_LIMIT

    if (result.ok) {
      await prisma.link.update({ where: { id: link.id }, data: { lastFbDebug: processedAt } }).catch(() => {})
    }

    if (jobItem) {
      let jobItemStatus = 'failed'
      if (result.ok) jobItemStatus = 'success'
      else if (shouldRetryInvalidParameter) jobItemStatus = 'pending'
      const usedDifferentToken =
        result.tokenIndexUsed !== null &&
        result.tokenIndexUsed !== undefined &&
        result.tokenIndexUsed !== result.primaryTokenIndex
      const tokenMessage = result.primaryTokenIndex !== null && result.primaryTokenIndex !== undefined
        ? `primary token #${result.primaryTokenIndex + 1}${
          usedDifferentToken
            ? `, ${result.ok ? 'succeeded with' : 'last tried'} token #${(result.tokenIndexUsed ?? 0) + 1}`
            : ''
        }`
        : null
      const resultMessage = result.message ?? 'Facebook scrape failed'
      const retryMessage = shouldRetryInvalidParameter
        ? `${resultMessage}; retry ${nextAttempts}/${FB_DEBUG_INVALID_PARAMETER_RETRY_LIMIT}${
          tokenMessage ? `; ${tokenMessage}` : ''
        }`
        : result.ok
          ? tokenMessage
          : tokenMessage
            ? `${resultMessage}; ${tokenMessage}`
            : result.message ?? null
      await prisma.fbDebugJobItem.update({
        where: { id: jobItem.id },
        data: {
          status: jobItemStatus,
          attempts: { increment: 1 },
          shortUrl,
          message: retryMessage,
          errorCode: result.errorCode ?? null,
          processedAt,
        },
      }).catch(() => {})
    }

    results.push({
      linkId: link.id,
      shortCode: link.shortCode,
      shortUrl,
      ok: result.ok,
      usedToken: result.usedToken,
      primaryTokenIndex: result.primaryTokenIndex,
      tokenIndexUsed: result.tokenIndexUsed,
      tokenAttempts: result.tokenAttempts,
      message: result.message ?? null,
      errorCode: result.errorCode ?? null,
      willRetry: shouldRetryInvalidParameter,
    })

    if (result.allTokensBlocked) {
      blockedByFacebook = true
      break
    }
  }

  return { results, blockedByFacebook }
}

async function refreshFbDebugJobStats(jobId: string) {
  const [pending, success, failed] = await Promise.all([
    prisma.fbDebugJobItem.count({ where: { jobId, status: 'pending' } }),
    prisma.fbDebugJobItem.count({ where: { jobId, status: 'success' } }),
    prisma.fbDebugJobItem.count({ where: { jobId, status: 'failed' } }),
  ])
  const processed = success + failed
  const completed = pending === 0

  return prisma.fbDebugJob.update({
    where: { id: jobId },
    data: {
      status: completed ? 'completed' : 'running',
      processed,
      success,
      failed,
      nextRunAt: completed ? null : getNextFbDebugBatchTime(),
      completedAt: completed ? new Date() : null,
    },
  })
}

export async function processFbDebugJobBatch(jobId: string, limit = FB_DEBUG_MAX_LINKS_PER_RUN) {
  const batchLimit = clampFbDebugRunLimit(limit)
  const job = await prisma.fbDebugJob.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true, status: true, total: true, processed: true },
  })

  if (!job || job.status === 'completed' || job.status === 'cancelled') {
    return null
  }

  await prisma.fbDebugJob.update({
    where: { id: job.id },
    data: {
      status: 'running',
      startedAt: new Date(),
      nextRunAt: null,
    },
  })

  const items = await prisma.fbDebugJobItem.findMany({
    where: { jobId: job.id, status: 'pending' },
    select: {
      id: true,
      linkId: true,
      attempts: true,
      order: true,
      link: {
        select: {
          id: true,
          shortCode: true,
          lastFbDebug: true,
          domain: { select: { domain: true } },
          sharedDomain: true,
        },
      },
    },
    orderBy: { order: 'asc' },
    take: batchLimit,
  })

  const jobItemsByLinkId = new Map<string, FbDebugJobItemState>(
    items.map((item): [string, FbDebugJobItemState] => [
      item.linkId,
      { id: item.id, order: item.order, attempts: item.attempts },
    ]),
  )
  const links = items.map((item) => item.link)
  const { results, blockedByFacebook } = await processFbDebugLinks(job.userId, links, { jobItemsByLinkId })
  const updatedJob = await refreshFbDebugJobStats(job.id)
  const effectiveJob = blockedByFacebook && updatedJob.status !== 'completed'
    ? await prisma.fbDebugJob.update({
      where: { id: job.id },
      data: { status: 'running', nextRunAt: getBlockedFbDebugBatchTime() },
    })
    : updatedJob

  return {
    ok: true as const,
    jobId: job.id,
    total: results.length,
    success: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok && !result.willRetry).length,
    retrying: results.filter((result) => result.willRetry).length,
    batchLimit: FB_DEBUG_MAX_LINKS_PER_RUN,
    queued: Math.max(0, effectiveJob.total - effectiveJob.processed),
    jobTotal: effectiveJob.total,
    jobProcessed: effectiveJob.processed,
    jobStatus: effectiveJob.status,
    blockedByFacebook,
    nextBatchInMinutes: effectiveJob.status === 'completed'
      ? null
      : blockedByFacebook
        ? FB_DEBUG_BLOCK_BACKOFF_MINUTES
        : FB_DEBUG_BATCH_RETRY_MINUTES,
    results,
  }
}

export async function processDueFbDebugJobs() {
  const now = new Date()
  const jobs = await prisma.fbDebugJob.findMany({
    where: {
      status: { in: ['pending', 'running'] },
      OR: [
        { nextRunAt: null },
        { nextRunAt: { lte: now } },
      ],
    },
    select: { id: true, userId: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  const seenUsers = new Set<string>()
  for (const job of jobs) {
    if (seenUsers.has(job.userId)) continue
    seenUsers.add(job.userId)
    await processFbDebugJobBatch(job.id).catch((error) => {
      console.error('[FB debug job] batch error', job.id, error)
    })
  }

  return seenUsers
}

export async function scrapeUrlForUser(userId: string, url: string) {
  const cleanUrl = url.trim()
  if (!cleanUrl) {
    return { ok: false as const, status: 400, message: 'Thieu URL' }
  }

  const link = await findLinkByShortUrl(cleanUrl)
  const tokens = await getUserScrapeTokenList(userId)
  const result = await scrapeWithFbTokens(cleanUrl, tokens, {
    startIndex: getNextUserScrapeStartIndex(userId, tokens.length),
  })

  if (link && result.ok) {
    await prisma.link.update({ where: { id: link.id }, data: { lastFbDebug: new Date() } }).catch(() => { })
  }
  return { ...result, status: 200 }
}

export async function previewUserFbDebugNow(userId: string, limit = 200) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fbDebugMinClicksPerDay: true, fbDebugAllActiveLinks: true },
  })

  if (!user) {
    return { ok: false as const, status: 404, error: 'User not found' }
  }

  const candidateLinks = await prisma.link.findMany({
    where: buildFbDebugLinkWhere(userId, { allActiveLinks: user.fbDebugAllActiveLinks }),
    select: {
      id: true,
      title: true,
      shortCode: true,
      domain: { select: { domain: true } },
      sharedDomain: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
  const todayClicks = await getTodayClickCounts(candidateLinks.map((link) => link.id))
  const limitedCount = Math.min(Math.max(1, limit), 200)
  const links = candidateLinks
    .map((link) => {
      const clicksToday = todayClicks.get(link.id) ?? 0
      return {
        linkId: link.id,
        title: link.title,
        shortCode: link.shortCode,
        shortUrl: buildShortUrl(link),
        clicksToday,
        willDebug: user.fbDebugAllActiveLinks || user.fbDebugMinClicksPerDay <= 0 || clicksToday >= user.fbDebugMinClicksPerDay,
      }
    })
    .filter((link) => link.willDebug)
    .slice(0, limitedCount)

  return {
    ok: true as const,
    minClicksPerDay: user.fbDebugMinClicksPerDay,
    debugAllActiveLinks: user.fbDebugAllActiveLinks,
    candidateCount: candidateLinks.length,
    total: links.length,
    links,
  }
}

export async function runUserFbDebugNow(
  userId: string,
  limit = FB_DEBUG_MAX_LINKS_PER_RUN,
  options: { deferBatch?: boolean } = {},
) {
  const qualified = await getQualifiedFbDebugLinks(userId)
  if (!qualified) {
    return { ok: false as const, status: 404, error: 'User not found' }
  }

  const batchLimit = clampFbDebugRunLimit(limit)
  if (qualified.links.length === 0) {
    return {
      ok: true as const,
      total: 0,
      success: 0,
      failed: 0,
      batchLimit: FB_DEBUG_MAX_LINKS_PER_RUN,
      queued: 0,
      jobId: null,
      jobTotal: 0,
      jobProcessed: 0,
      jobStatus: 'completed',
      nextBatchInMinutes: null,
      results: [],
    }
  }

  await prisma.fbDebugJob.updateMany({
    where: { userId, status: { in: ['pending', 'running'] } },
    data: { status: 'cancelled', nextRunAt: null, completedAt: new Date() },
  })

  const job = await prisma.fbDebugJob.create({
    data: {
      userId,
      mode: 'manual',
      status: 'pending',
      total: qualified.links.length,
      batchLimit,
      nextRunAt: null,
      items: {
        create: qualified.links.map((link, index) => ({
          linkId: link.id,
          order: index,
        })),
      },
    },
    select: { id: true },
  })

  if (options.deferBatch) {
    return {
      ok: true as const,
      jobId: job.id,
      total: 0,
      success: 0,
      failed: 0,
      batchLimit: FB_DEBUG_MAX_LINKS_PER_RUN,
      queued: qualified.links.length,
      jobTotal: qualified.links.length,
      jobProcessed: 0,
      jobStatus: 'pending',
      blockedByFacebook: false,
      nextBatchInMinutes: 0,
      results: [],
    }
  }

  const result = await processFbDebugJobBatch(job.id, batchLimit)
  if (result) return result

  return {
    ok: false as const,
    status: 500,
    error: 'Khong the xu ly FB debug job',
  }
}
