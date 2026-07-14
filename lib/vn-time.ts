const VN_OFFSET_MINUTES = 7 * 60
const VN_OFFSET_MS = VN_OFFSET_MINUTES * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function getVietnamDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
    }).formatToParts(date)

    const year = Number(parts.find((p) => p.type === 'year')?.value ?? '1970')
    const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1')
    const day = Number(parts.find((p) => p.type === 'day')?.value ?? '1')

    return { year, month, day }
}

export function getVietnamStartOfDayUtc(date = new Date()) {
    const { year, month, day } = getVietnamDateParts(date)
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - VN_OFFSET_MS)
}

export function getVietnamDayBoundaries(date = new Date()) {
    const startOfToday = getVietnamStartOfDayUtc(date)
    return {
        startOfYesterday: new Date(startOfToday.getTime() - DAY_MS),
        startOfToday,
        startOfTomorrow: new Date(startOfToday.getTime() + DAY_MS),
    }
}

export function getVietnamStartOfRange(days: number, date = new Date()) {
    const safeDays = Math.max(1, Math.floor(days || 1))
    const startOfToday = getVietnamStartOfDayUtc(date)
    return new Date(startOfToday.getTime() - (safeDays - 1) * DAY_MS)
}

export function getVietnamStartOfMonthUtc(date = new Date()) {
    const { year, month } = getVietnamDateParts(date)
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - VN_OFFSET_MS)
}
