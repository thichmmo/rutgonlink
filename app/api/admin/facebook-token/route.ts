import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getFacebookAppToken, getFacebookTokenMasked, setFacebookAppToken, triggerFbScrape, getFbDebugIntervalMinutes, setFbDebugIntervalMinutes } from '@/lib/runtime-config'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ""

function isAdminEmail(email: string | null | undefined): boolean {
    return !!email && email === ADMIN_EMAIL
}

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [data, intervalMinutes] = await Promise.all([
        getFacebookTokenMasked(),
        getFbDebugIntervalMinutes(),
    ])
    return NextResponse.json({ ...data, intervalMinutes })
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token : ''

    await setFacebookAppToken(token || null)
    return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const inputToken = typeof body?.token === 'string' ? body.token.trim() : ''
    const token = inputToken || await getFacebookAppToken()

    if (!token) {
        return NextResponse.json({
            ok: false,
            message: 'Chưa có token để test',
            debugHint: 'Hãy nhập token rồi bấm Lưu token, hoặc đảm bảo token đã được cấu hình trước đó.',
        })
    }

    const query = new URLSearchParams({
        fields: 'id,name',
        access_token: token,
    })

    try {
        const response = await fetch(`https://graph.facebook.com/app?${query.toString()}`, {
            method: 'GET',
            cache: 'no-store',
        })

        const data = await response.json().catch(() => null)
        if (!response.ok || data?.error) {
            const errorType = data?.error?.type || null
            const errorCode = data?.error?.code || null
            const errorSubcode = data?.error?.error_subcode || null
            const errorMessage = data?.error?.message || 'Token không hợp lệ hoặc đã hết hạn'

            let debugHint: string | null = null
            if (errorCode === 190) {
                debugHint = 'Token đã hết hạn hoặc sai. Tạo lại App Access Token mới từ App ID + App Secret.'
            } else if (errorCode === 10 || errorCode === 200) {
                debugHint = 'App chưa đủ quyền hoặc đang ở chế độ không cho phép. Kiểm tra App Mode, quyền ứng dụng và role tài khoản.'
            } else if (typeof errorMessage === 'string' && /disabled|Application has been disabled/i.test(errorMessage)) {
                debugHint = 'App có thể đã bị disable. Kiểm tra trạng thái app trong Facebook Developers rồi bật lại hoặc thay app khác.'
            } else {
                debugHint = 'Kiểm tra App ID/App Secret, trạng thái app và quyền truy cập trong Facebook Developers.'
            }

            return NextResponse.json({
                ok: false,
                message: errorMessage,
                errorType,
                errorCode,
                errorSubcode,
                debugHint,
            })
        }

        return NextResponse.json({
            ok: true,
            message: 'Token hợp lệ',
            appId: data?.id || null,
            appName: data?.name || null,
        })
    } catch {
        return NextResponse.json({ ok: false, message: 'Không thể kết nối Facebook Graph API' })
    }
}

export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const url = typeof body?.url === 'string' ? body.url.trim() : ''

    if (!url) {
        return NextResponse.json({ ok: false, message: 'Thiếu URL để test scrape' })
    }

    try {
        // 2 bước: GET (Debug) → POST (Scrape Again) — đúng như thao tác trên Facebook Sharing Debugger
        const result = await triggerFbScrape(url)

        if (!result.ok) {
            return NextResponse.json({
                ok: false,
                message: result.message || 'FB scrape thất bại',
                errorCode: result.errorCode ?? null,
                errorType: result.errorType ?? null,
                usedToken: result.usedToken,
                raw: result.raw,
            })
        }

        return NextResponse.json({
            ok: true,
            message: 'FB đã re-scrape thành công (GET Debug → POST Scrape Again)',
            usedToken: result.usedToken,
            title: result.title ?? null,
            description: result.description ?? null,
            image: result.image ?? null,
            raw: result.raw,
        })
    } catch {
        return NextResponse.json({ ok: false, message: 'Không thể kết nối Facebook Graph API' })
    }
}

// Dùng DELETE để lưu interval cron (tránh tạo thêm file route)
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const minutes = typeof body?.intervalMinutes === 'number' ? body.intervalMinutes : null

    if (!minutes || minutes < 1) {
        return NextResponse.json({ ok: false, message: 'Giá trị không hợp lệ' })
    }

    await setFbDebugIntervalMinutes(minutes)
    return NextResponse.json({ ok: true, intervalMinutes: minutes })
}
