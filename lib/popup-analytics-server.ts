import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSiteHostname } from '@/lib/site-config'
import { getPublicPostPath } from '@/lib/public-post-link'
import { popupClickStats, popupClickWindows, type ClickGroup, type ClickStatsList } from '@/lib/popup-analytics'

function aggregates(now: Date) {
  const w = popupClickWindows(now)
  const ranges = [
    ['hour', w.hour, now], ['today', w.today, now],
    ['yesterday', w.yesterday, w.today], ['dayBefore', w.dayBefore, w.yesterday],
  ] as const
  return Prisma.join(ranges.flatMap(([key, start, end]) => ['Shopee', 'Tiktok'].map(platform => Prisma.sql`
    SUM(CASE WHEN createdAt >= ${start} AND createdAt ${key === 'hour' || key === 'today' ? Prisma.sql`<=` : Prisma.sql`<`} ${end}
      AND platform = ${platform.toUpperCase()} THEN 1 ELSE 0 END) AS ${Prisma.raw(`\`${key}${platform}\``)}`)))
}

export async function getPopupClickTotals(userId: string, now: Date) {
  const w = popupClickWindows(now)
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    SELECT ${aggregates(now)} FROM PopupClick WHERE userId = ${userId} AND createdAt >= ${w.dayBefore} AND createdAt <= ${now}`)
  return popupClickStats(rows[0])
}

export async function getPopupClickCounts(userId: string, group: ClickGroup, ids: string[], now: Date) {
  const counts = Object.fromEntries(ids.map(id => [id, popupClickStats()]))
  if (!ids.length) return counts
  const key = group === 'post' ? Prisma.sql`postId` : Prisma.sql`popupId`
  const w = popupClickWindows(now)
  const rows = await prisma.$queryRaw<(Record<string, unknown> & { id: string })[]>(Prisma.sql`
    SELECT ${key} AS id, ${aggregates(now)} FROM PopupClick
    WHERE userId = ${userId} AND ${key} IN (${Prisma.join(ids)}) AND createdAt >= ${w.dayBefore} AND createdAt <= ${now}
    GROUP BY ${key}`)
  for (const row of rows) counts[row.id] = popupClickStats(row)
  return counts
}

export async function getPopupClickList(userId: string, group: ClickGroup, query: string, sort: string, page: number, pageSize: number, now: Date): Promise<ClickStatsList> {
  const isPost = group === 'post'
  const table = isPost ? Prisma.sql`ManagedPost` : Prisma.sql`PopupTemplate`
  const key = isPost ? Prisma.sql`postId` : Prisma.sql`popupId`
  const title = isPost ? Prisma.sql`m.title` : Prisma.sql`m.name`
  const filter = Prisma.sql`m.userId = ${userId} ${query ? Prisma.sql`AND ${title} LIKE ${`%${query.replace(/[\\%_]/g, '\\$&')}%`}` : Prisma.empty}`
  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS count FROM ${table} m WHERE ${filter}`)
  const total = Number(count)
  page = Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
  const w = popupClickWindows(now)
  const order = sort === 'newest' ? Prisma.empty : sort === 'yesterday'
    ? Prisma.sql`COALESCE(c.yesterdayShopee, 0) + COALESCE(c.yesterdayTiktok, 0) DESC,`
    : Prisma.sql`COALESCE(c.todayShopee, 0) + COALESCE(c.todayTiktok, 0) DESC,`
  const metadata = isPost
    ? Prisma.sql`m.previewImage AS image, m.slug, m.sharedDomain, d.domain AS customDomain, p.name AS popupName`
    : Prisma.sql`m.imageUrl AS image, (SELECT COUNT(*) FROM ManagedPost mp WHERE mp.popupId = m.id AND mp.userId = ${userId}) AS postCount`
  const joins = isPost ? Prisma.sql`LEFT JOIN Domain d ON d.id = m.domainId LEFT JOIN PopupTemplate p ON p.id = m.popupId AND p.userId = ${userId}` : Prisma.empty
  type Row = Record<string, unknown> & { id: string; title: string; image: string | null; slug: string; sharedDomain: string | null; customDomain: string | null; popupName: string | null; postCount: bigint; createdAt: Date }
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT m.id, ${title} AS title, m.createdAt, ${metadata}, c.* FROM ${table} m
    LEFT JOIN (SELECT ${key} AS entityId, ${aggregates(now)} FROM PopupClick
      WHERE userId = ${userId} AND createdAt >= ${w.dayBefore} AND createdAt <= ${now} GROUP BY ${key}) c ON c.entityId = m.id
    ${joins} WHERE ${filter} ORDER BY ${order} m.createdAt DESC, m.id ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`)
  return { total, page, pageSize, items: rows.map(row => ({
    id: row.id, title: row.title, image: row.image, createdAt: row.createdAt.toISOString(), stats: popupClickStats(row),
    ...(isPost ? { slug: row.slug, publicUrl: `https://${row.customDomain || row.sharedDomain || getSiteHostname()}${getPublicPostPath(row.slug)}`, popupName: row.popupName } : { postCount: Number(row.postCount) }),
  })) }
}
