'use client'

import { useState, useEffect } from 'react'

export default function DashboardClock() {
    const [now, setNow] = useState<Date | null>(null)

    useEffect(() => {
        setNow(new Date())
        const id = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(id)
    }, [])

    if (!now) return null

    const time = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const date = now.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })

    return (
        <div className="hidden lg:flex flex-col items-center leading-tight select-none">
            <span className="text-base font-semibold text-gray-800 tabular-nums">{time}</span>
            <span className="text-xs text-gray-400">{date}</span>
        </div>
    )
}
