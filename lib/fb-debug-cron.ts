import { prisma } from './prisma'
import { getVietnamDayBoundaries } from './vn-time'
import { FB_DEBUG_BLOCK_BACKOFF_MS, FB_DEBUG_MAX_LINKS_PER_RUN } from './fb-debug-limits'
import { processDueFbDebugJobs, scrapeWithFbTokens } from './fb-debug-actions'
import { getSiteUrl } from './site-config'

interface FbDebugLink {
  id: string
  userId: string
  shortCode: string
  originalUrl: string
  ogEnabled: boolean
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  lastFbDebug: Date | null
  useFolderRotation: boolean
  folderAssignments: { id: string }[]
  domain: { domain: string } | null
  sharedDomain: string | null
  user: {
    fbDebugIntervalMinutes: number
    fbDebugMinClicksPerDay: number
    fbDebugAllActiveLinks: boolean
    fbDebugDailyAllActiveLinks: boolean
  }
}

interface ScheduledDisableLink {
  id: string
  userId: string
  shortCode: string
  domain: { domain: string } | null
  sharedDomain: string | null
}

const JITTER_MS = 2 * 60 * 1000

// Tắt OG, FB debug và reset click theo thứ tự cho mỗi link đến hạn.
export async function runScheduledActions() {
  const now = new Date()
  const baseUrl = getSiteUrl()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const links = (await (prisma.link as any).findMany({
    where: {
      OR: [
        { ogScheduledDisableAt: { lte: now } },
        { clickResetAt: { lte: now } },
      ],
    },
    select: {
      id: true,
      userId: true,
      shortCode: true,
      ogScheduledDisableAt: true,
      clickResetAt: true,
      domain: { select: { domain: true } },
      sharedDomain: true,
    },
  })) as (ScheduledDisableLink & { ogScheduledDisableAt: Date | null; clickResetAt: Date | null })[]

  if (links.length === 0) return

  const userTokensMap = new Map<string, string[]>()
  for (const link of links) {
    if (!userTokensMap.has(link.userId)) {
      const tokens = await prisma.fbToken.findMany({
        where: { userId: link.userId, status: { not: 'die' } },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        select: { token: true },
      })
      userTokensMap.set(link.userId, tokens.map((token) => token.token))
    }
  }

  const scheduledDebugCountByUser = new Map<string, number>()

  for (const link of links) {
    const host = link.domain?.domain
      ? `https://${link.domain.domain}`
      : link.sharedDomain ? `https://${link.sharedDomain}` : baseUrl
    const shortUrl = `${host}/${link.shortCode}`

    if (link.ogScheduledDisableAt && link.ogScheduledDisableAt <= now) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.link as any).update({
        where: { id: link.id },
        data: { ogEnabled: false, ogScheduledDisableAt: null },
      }).catch((error: unknown) => {
        console.error('[scheduled-action] err og disable', link.id, error)
      })
    }

    const debugCount = scheduledDebugCountByUser.get(link.userId) ?? 0
    if (debugCount >= FB_DEBUG_MAX_LINKS_PER_RUN) {
      console.log('[scheduled-action] fb debug queued by user batch limit', shortUrl)
    } else {
      scheduledDebugCountByUser.set(link.userId, debugCount + 1)
      const userTokens = userTokensMap.get(link.userId) || []
      const envToken = process.env.FACEBOOK_APP_TOKEN?.trim()
      if (userTokens.length === 0 && envToken) userTokens.push(envToken)

      const result = await scrapeWithFbTokens(shortUrl, userTokens, { startIndex: debugCount }).catch((error: unknown) => {
        console.error('[scheduled-action] err fb scrape', shortUrl, error)
        return null
      })

      if (!result) {
        console.error('[scheduled-action] err fb scrape no result', shortUrl)
      } else if (!result.ok) {
        console.error('[scheduled-action] err fb scrape failed', shortUrl, result.message)
        if (result.allTokensBlocked) {
          console.error('[scheduled-action] fb tokens blocked, stop user batch', link.userId)
          scheduledDebugCountByUser.set(link.userId, FB_DEBUG_MAX_LINKS_PER_RUN)
        }
      } else {
        console.log('[scheduled-action] fb debug ok', shortUrl, result.usedToken ? '(token)' : '(no token)')
      }
    }

    if (link.clickResetAt && link.clickResetAt <= now) {
      await prisma.click.deleteMany({ where: { linkId: link.id } })
        .catch((error: unknown) => {
          console.error('[scheduled-action] err click reset', link.id, error)
        })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.link as any).update({
        where: { id: link.id },
        data: { clickResetAt: null },
      }).catch((error: unknown) => {
        console.error('[scheduled-action] err clear click reset', link.id, error)
      })
      console.log('[scheduled-action] clicks reset', link.shortCode)
    }
  }
}

export async function runFbDebugBatch() {
  const usersProcessedByJobs = await processDueFbDebugJobs()

  const links = (await prisma.link.findMany({
    where: { isActive: true },
    select: {
      id: true,
      userId: true,
      shortCode: true,
      originalUrl: true,
      ogEnabled: true,
      ogTitle: true,
      ogDescription: true,
      ogImage: true,
      lastFbDebug: true,
      useFolderRotation: true,
      folderAssignments: { select: { id: true } },
      domain: { select: { domain: true } },
      sharedDomain: true,
      user: {
        select: {
          fbDebugIntervalMinutes: true,
          fbDebugMinClicksPerDay: true,
          fbDebugAllActiveLinks: true,
          fbDebugDailyAllActiveLinks: true,
        },
      },
    },
  })) as unknown as FbDebugLink[]

  if (links.length === 0) return

  const linksByUser = new Map<string, FbDebugLink[]>()
  for (const link of links) {
    const userLinks = linksByUser.get(link.userId) || []
    userLinks.push(link)
    linksByUser.set(link.userId, userLinks)
  }

  const baseUrl = getSiteUrl()
  const now = Date.now()
  const { startOfToday } = getVietnamDayBoundaries()

  for (const [userId, userLinks] of linksByUser) {
    if (usersProcessedByJobs.has(userId)) continue

    const user = userLinks[0]?.user
    if (!user) continue

    const intervalMs = user.fbDebugIntervalMinutes * 60 * 1000
    const minClicksPerDay = user.fbDebugMinClicksPerDay
    const eligibleLinks = user.fbDebugAllActiveLinks
      ? userLinks
      : userLinks.filter((link) => {
        const hasRotatingUrls = link.useFolderRotation && link.folderAssignments.length > 0
        const hasMultiUrls = link.originalUrl.includes('\n')
        const needsOgDebug = !link.ogEnabled || (link.ogEnabled && !link.ogTitle && !link.ogDescription && !link.ogImage)
        return (hasMultiUrls || hasRotatingUrls) && needsOgDebug
      })

    let qualifiedIds: Set<string> | null = null
    if (minClicksPerDay > 0) {
      const clickGroups = await prisma.click.groupBy({
        by: ['linkId'],
        where: { linkId: { in: eligibleLinks.map((link) => link.id) }, createdAt: { gte: startOfToday } },
        _count: { _all: true },
      })
      qualifiedIds = new Set(
        clickGroups.filter((click) => click._count._all >= minClicksPerDay).map((click) => click.linkId),
      )
    }

    const linksToDebugMap = new Map<string, FbDebugLink>()
    if (user.fbDebugDailyAllActiveLinks) {
      for (const link of userLinks) {
        if (!link.lastFbDebug || link.lastFbDebug < startOfToday) {
          linksToDebugMap.set(link.id, link)
        }
      }
    }

    for (const link of eligibleLinks) {
      if (qualifiedIds && !qualifiedIds.has(link.id)) continue
      const lastDebug = link.lastFbDebug ? link.lastFbDebug.getTime() : 0
      const jitter = Math.random() * JITTER_MS
      if (now - lastDebug < intervalMs + jitter) continue
      linksToDebugMap.set(link.id, link)
    }

    const allLinksToDebug = [...linksToDebugMap.values()].sort((first, second) => {
      const firstTime = first.lastFbDebug?.getTime() ?? 0
      const secondTime = second.lastFbDebug?.getTime() ?? 0
      return firstTime - secondTime
    })
    const linksToDebug = allLinksToDebug.slice(0, FB_DEBUG_MAX_LINKS_PER_RUN)

    if (linksToDebug.length === 0) continue

    const userTokens = await prisma.fbToken.findMany({
      where: { userId, status: { not: 'die' } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: { token: true },
    })
    const tokenList = userTokens.map((token) => token.token)
    const envToken = process.env.FACEBOOK_APP_TOKEN?.trim()
    if (tokenList.length === 0 && envToken) tokenList.push(envToken)

    for (let index = 0; index < linksToDebug.length; index++) {
      const link = linksToDebug[index]
      const host = link.domain?.domain
        ? `https://${link.domain.domain}`
        : link.sharedDomain ? `https://${link.sharedDomain}` : baseUrl
      const shortUrl = `${host}/${link.shortCode}`

      const result = await scrapeWithFbTokens(shortUrl, tokenList, { startIndex: index }).catch((error: unknown) => {
        console.error('[FB cron] err scrape', shortUrl, error)
        return null
      })

      if (result?.ok) {
        // Chỉ cập nhật cooldown khi Facebook chấp nhận scrape.
        await prisma.link.update({
          where: { id: link.id },
          data: { lastFbDebug: new Date() },
        }).catch(() => {})
      } else if (result && !result.ok) {
        console.error('[FB cron] scrape failed', shortUrl, result.message, result.errorCode)
        if (result.allTokensBlocked) {
          console.error('[FB cron] tokens blocked, pause user batch', userId)
          await prisma.link.update({
            where: { id: link.id },
            data: { lastFbDebug: new Date(Date.now() + FB_DEBUG_BLOCK_BACKOFF_MS) },
          }).catch(() => {})
          break
        }
      }
    }

    if (tokenList.length > 0) {
      const perToken = Math.ceil(linksToDebug.length / tokenList.length)
      const queued = Math.max(0, allLinksToDebug.length - linksToDebug.length)
      console.log(`[FB cron] user ${userId}: ${linksToDebug.length} links / ${tokenList.length} tokens = ~${perToken} links/token, queued=${queued}`)
    }
  }
}
