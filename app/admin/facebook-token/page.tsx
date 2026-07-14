'use client';

import {useEffect, useState} from 'react';
import {KeyRound, Link2, RefreshCw, Timer} from 'lucide-react';

interface FbTokenState {
    hasToken: boolean;
    masked: string | null;
}

export default function AdminFacebookTokenPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [status, setStatus] = useState<FbTokenState>({hasToken: false, masked: null});
    const [token, setToken] = useState('');
    const [message, setMessage] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [testOk, setTestOk] = useState<boolean | null>(null);
    const [testDebugHint, setTestDebugHint] = useState('');

    // Interval cron state
    const [intervalMinutes, setIntervalMinutes] = useState(20);
    const [intervalInput, setIntervalInput] = useState('20');
    const [savingInterval, setSavingInterval] = useState(false);
    const [intervalMessage, setIntervalMessage] = useState('');

    // Scrape test state
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [scraping, setScraping] = useState(false);
    const [scrapeOk, setScrapeOk] = useState<boolean | null>(null);
    const [scrapeMessage, setScrapeMessage] = useState('');
    const [scrapeData, setScrapeData] = useState<{
        title?: string | null;
        description?: string | null;
        image?: string | null;
        usedToken?: boolean;
        raw?: unknown;
    } | null>(null);

    const load = async () => {
        setLoading(true);
        setMessage('');
        const res = await fetch('/api/admin/facebook-token', {cache: 'no-store'});
        if (!res.ok) {
            setMessage('Không tải được trạng thái token');
            setLoading(false);
            return;
        }
        const data = await res.json();
        setStatus({hasToken: !!data?.hasToken, masked: data?.masked || null});
        if (data?.intervalMinutes) {
            setIntervalMinutes(data.intervalMinutes);
            setIntervalInput(String(data.intervalMinutes));
        }
        setLoading(false);
    };

    const saveInterval = async (minutes: number) => {
        setSavingInterval(true);
        setIntervalMessage('');
        const res = await fetch('/api/admin/facebook-token', {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({intervalMinutes: minutes}),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.ok) {
            setIntervalMinutes(minutes);
            setIntervalInput(String(minutes));
            setIntervalMessage('Đã lưu');
        } else {
            setIntervalMessage('Lưu thất bại');
        }
        setSavingInterval(false);
        setTimeout(() => setIntervalMessage(''), 2000);
    };

    const save = async () => {
        setSaving(true);
        setMessage('');

        const res = await fetch('/api/admin/facebook-token', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token}),
        });

        if (res.ok) {
            setToken('');
            setMessage('Đã cập nhật Facebook token');
            await load();
        } else {
            setMessage('Lưu token thất bại');
        }

        setSaving(false);
    };

    const testToken = async () => {
        setTesting(true);
        setTestMessage('');
        setTestOk(null);
        setTestDebugHint('');

        const res = await fetch('/api/admin/facebook-token', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token}),
        });

        const data = await res.json().catch(() => ({}));
        if (data?.ok) {
            const appMeta = data?.appName ? ` (${data.appName}${data?.appId ? ` - ${data.appId}` : ''})` : '';
            setTestOk(true);
            setTestMessage(`Token hợp lệ${appMeta}`);
        } else {
            setTestOk(false);
            setTestMessage(data?.message || 'Token không hợp lệ');
            const hintPrefix = data?.errorCode ? `Mã lỗi ${data.errorCode}` : '';
            const hintBody = data?.debugHint || '';
            setTestDebugHint([hintPrefix, hintBody].filter(Boolean).join(' · '));
        }

        setTesting(false);
    };

    const scrapeLink = async () => {
        if (!scrapeUrl.trim()) return;
        setScraping(true);
        setScrapeOk(null);
        setScrapeMessage('');
        setScrapeData(null);

        const res = await fetch('/api/admin/facebook-token', {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({url: scrapeUrl.trim()}),
        });

        const data = await res.json().catch(() => ({}));
        setScrapeOk(!!data?.ok);
        setScrapeMessage(data?.message || (data?.ok ? 'Thành công' : 'Thất bại'));
        setScrapeData(
            data?.ok
                ? {
                      title: data.title,
                      description: data.description,
                      image: data.image,
                      usedToken: data.usedToken,
                      raw: data.raw,
                  }
                : {usedToken: data.usedToken, raw: data.raw},
        );
        setScraping(false);
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="space-y-5 max-w-2xl">
            <div>
                <h1 className="text-xl font-bold text-white">Facebook Token</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                    Dùng cho tính năng Facebook scrape lại khi link chạm ngưỡng click/đổi slot.
                </p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-gray-300">
                    <KeyRound className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium">Trạng thái token</span>
                </div>

                {loading ? (
                    <div className="text-sm text-gray-500">Đang tải...</div>
                ) : (
                    <div className="text-sm text-gray-300">
                        {status.hasToken ? (
                            <span>
                                Đã cấu hình: <span className="font-mono text-sky-400">{status.masked}</span>
                            </span>
                        ) : (
                            <span className="text-yellow-400">
                                Chưa cấu hình token (hệ thống sẽ fallback gọi không token)
                            </span>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="block text-xs text-gray-400">Facebook App Access Token</label>
                    <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Nhập token mới (để trống để xóa token)"
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    />
                    <p className="text-xs text-gray-500">
                        Token được lưu trong database và ưu tiên dùng hơn biến môi trường.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
                    >
                        {saving ? 'Đang lưu...' : 'Lưu token'}
                    </button>
                    <button
                        onClick={testToken}
                        disabled={testing}
                        className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
                    >
                        {testing ? 'Đang test...' : 'Test token'}
                    </button>
                    {message ? <span className="text-sm text-gray-400">{message}</span> : null}
                </div>

                {testMessage ? (
                    <div className={`text-sm ${testOk ? 'text-sky-400' : 'text-yellow-400'}`}>{testMessage}</div>
                ) : null}

                {!testOk && testDebugHint ? (
                    <div className="rounded-lg border border-yellow-700/40 bg-yellow-900/20 p-3 text-sm text-yellow-200">
                        <div className="font-semibold mb-1">Cảnh báo debug token</div>
                        <div>{testDebugHint}</div>
                    </div>
                ) : null}

                <div className="border-t border-gray-800 pt-4 space-y-3">
                    <h2 className="text-sm font-semibold text-white">Cách lấy Facebook App Access Token</h2>
                    <ol className="list-decimal pl-5 text-sm text-gray-300 space-y-1.5">
                        <li>Mở Facebook for Developers và đăng nhập tài khoản.</li>
                        <li>Tạo app mới (hoặc dùng app đã có), sau đó lấy App ID và App Secret.</li>
                        <li>
                            Gọi URL sau trên trình duyệt để lấy token:
                            <div className="mt-1 break-all rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs font-mono text-gray-300">
                                https://graph.facebook.com/oauth/access_token?client_id=APP_ID&amp;client_secret=APP_SECRET&amp;grant_type=client_credentials
                            </div>
                        </li>
                        <li>Copy giá trị access_token trả về và dán vào ô nhập bên trên.</li>
                    </ol>
                    <p className="text-xs text-gray-500">
                        Mẹo: hệ thống ưu tiên token lưu trong database. Nếu để trống token, hệ thống sẽ fallback gọi
                        scrape không token.
                    </p>
                    <a
                        href="https://developers.facebook.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                        Mở Facebook Developers
                    </a>
                </div>
            </div>

            {/* Interval cron section */}
            <div className="border-t border-gray-800 pt-4 space-y-3">
                <div className="flex items-center gap-2 text-gray-300">
                    <Timer className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium">Tần suất debug tự động</span>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        min={1}
                        value={intervalInput}
                        onChange={(e) => setIntervalInput(e.target.value)}
                        onBlur={() => {
                            const v = parseInt(intervalInput, 10);
                            if (!isNaN(v) && v >= 1) saveInterval(v);
                            else setIntervalInput(String(intervalMinutes));
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const v = parseInt(intervalInput, 10);
                                if (!isNaN(v) && v >= 1) saveInterval(v);
                            }
                        }}
                        className="w-20 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                    <span className="text-sm text-gray-400">phút / lần</span>
                    {intervalMessage ? <span className="text-xs text-gray-400">{intervalMessage}</span> : null}
                    {savingInterval ? <span className="text-xs text-gray-500">Đang lưu...</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                    {[15, 30, 60, 120, 360].map((m) => (
                        <button
                            key={m}
                            onClick={() => saveInterval(m)}
                            disabled={savingInterval}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                intervalMinutes === m
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            {m < 60 ? `${m} phút` : `${m / 60} giờ`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Test scrape link section */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-gray-300">
                    <Link2 className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium">Test scrape link (gọi FB debug)</span>
                </div>
                <p className="text-xs text-gray-500">
                    Nhập URL short link hoặc URL đầy đủ để yêu cầu Facebook re-scrape lại meta tag ngay lập tức. Tương
                    đương bấm &quot;Debug&quot; trên Facebook Sharing Debugger.
                </p>

                <div className="space-y-2">
                    <label className="block text-xs text-gray-400">URL cần scrape lại</label>
                    <input
                        type="url"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') scrapeLink();
                        }}
                            placeholder="https://your-domain.com/abc123"
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={scrapeLink}
                        disabled={scraping || !scrapeUrl.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${scraping ? 'animate-spin' : ''}`} />
                        {scraping ? 'Đang gọi FB...' : 'Gọi FB re-scrape'}
                    </button>
                </div>

                {scrapeMessage ? (
                    <div className={`text-sm font-medium ${scrapeOk ? 'text-sky-400' : 'text-yellow-400'}`}>
                        {scrapeMessage}
                        {scrapeData?.usedToken === false ? (
                            <span className="ml-2 text-xs text-gray-500">(không dùng token)</span>
                        ) : null}
                    </div>
                ) : null}

                {scrapeOk && scrapeData ? (
                    <div className="rounded-lg border border-gray-700 bg-gray-950 p-3 space-y-1.5 text-xs">
                        {scrapeData.title ? (
                            <div>
                                <span className="text-gray-500">Tiêu đề:</span>{' '}
                                <span className="text-white">{scrapeData.title}</span>
                            </div>
                        ) : null}
                        {scrapeData.description ? (
                            <div>
                                <span className="text-gray-500">Mô tả:</span>{' '}
                                <span className="text-gray-300">{scrapeData.description}</span>
                            </div>
                        ) : null}
                        {scrapeData.image ? (
                            <div className="space-y-1">
                                <span className="text-gray-500">Ảnh OG:</span>
                                <img
                                    src={scrapeData.image}
                                    alt="OG image"
                                    className="mt-1 rounded border border-gray-700 max-h-32 object-cover"
                                />
                            </div>
                        ) : null}
                        {!scrapeData.title && !scrapeData.description && !scrapeData.image ? (
                            <div className="text-gray-500">
                                FB đã scrape nhưng không trả về meta nào (link có thể đang chuyển hướng trực tiếp).
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {!scrapeOk && scrapeData?.raw ? (
                    <details className="text-xs">
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-400">Xem raw response</summary>
                        <pre className="mt-2 rounded-lg bg-gray-950 border border-gray-800 p-3 text-gray-400 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                            {JSON.stringify(scrapeData.raw, null, 2)}
                        </pre>
                    </details>
                ) : null}
            </div>
        </div>
    );
}
