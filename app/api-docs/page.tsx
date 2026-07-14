import {Metadata} from 'next';
import Link from 'next/link';
import {Key, Terminal, Link2, CheckCircle, AlertCircle, ArrowRight, Code2, Shield, Globe, Zap} from 'lucide-react';
import {getSiteHostname, getSiteUrl} from '@/lib/site-config';

export const metadata: Metadata = {
    title: 'Hướng dẫn API - LinkShort',
    description: 'Tài liệu tích hợp API rút gọn link LinkShort. Hướng dẫn xác thực, các endpoint và ví dụ cụ thể.',
};

const SITE_URL = getSiteUrl();
const SITE_HOSTNAME = getSiteHostname();
const BASE_URL = `${SITE_URL}/api/v1`;

function CodeBlock({code, lang = 'bash'}: {code: string; lang?: string}) {
    return (
        <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-sm overflow-x-auto leading-relaxed whitespace-pre">
              <code data-language={lang}>{code}</code>
        </pre>
    );
}

function Badge({children, color = 'blue'}: {children: React.ReactNode; color?: string}) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-100 text-blue-700',
        green: 'bg-sky-100 text-sky-700',
        yellow: 'bg-yellow-100 text-yellow-700',
        red: 'bg-red-100 text-red-700',
        purple: 'bg-purple-100 text-purple-700',
        gray: 'bg-gray-100 text-gray-600',
    };
    return (
        <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] ?? colors.blue}`}
        >
            {children}
        </span>
    );
}

function MethodBadge({method}: {method: string}) {
    const colors: Record<string, string> = {
        GET: 'bg-sky-100 text-sky-700',
        POST: 'bg-blue-100 text-blue-700',
        PATCH: 'bg-yellow-100 text-yellow-700',
        DELETE: 'bg-red-100 text-red-700',
    };
    return (
        <span
            className={`font-mono font-bold text-xs px-2 py-1 rounded ${colors[method] ?? 'bg-gray-100 text-gray-700'}`}
        >
            {method}
        </span>
    );
}

export default function ApiDocsPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                            <Code2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">API Documentation</h1>
                            <p className="text-sm text-gray-500">Phiên bản v1 · Cập nhật lần cuối: 2025</p>
                        </div>
                    </div>
                    <p className="text-gray-600 mt-3 max-w-2xl">
                        Tích hợp tính năng rút gọn link LinkShort vào ứng dụng, website, hoặc workflow của bạn chỉ trong
                        vài phút. API cung cấp đầy đủ chức năng tạo, quản lý và theo dõi link rút gọn.
                    </p>

                    {/* Quick links */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {[
                            {label: 'Xác thực', href: '#auth'},
                            {label: 'Lấy API Key', href: '#get-key'},
                            {label: 'Danh sách link', href: '#list-links'},
                            {label: 'Tạo link', href: '#create-link'},
                            {label: 'Chi tiết link', href: '#get-link'},
                            {label: 'Cập nhật link', href: '#update-link'},
                            {label: 'Xoá link', href: '#delete-link'},
                            {label: 'FB Debug', href: '#fb-debug'},
                            {label: 'Mã lỗi', href: '#errors'},
                        ].map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-colors font-medium"
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-12">
                {/* Plans */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-bold text-gray-900">Yêu cầu gói dịch vụ</h2>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <p className="text-gray-600 text-sm mb-4">
                            API chỉ khả dụng với các gói trả phí sau. Gói Cơ Bản (Free) và Pro <strong>không</strong> có
                            quyền truy cập API.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                {
                                    name: 'Ultra',
                                    price: '119.000đ/tháng',
                                    color: 'indigo',
                                    features: ['API access', '500K clicks/tháng', '5 custom domains'],
                                },
                                {
                                    name: 'Ultra+',
                                    price: '299.000đ/tháng',
                                    color: 'purple',
                                    features: ['API access', 'Clicks không giới hạn', 'Hỗ trợ ưu tiên 24/7'],
                                },
                            ].map((plan) => (
                                <div
                                    key={plan.name}
                                    className={`border rounded-xl p-4 ${
                                        plan.color === 'indigo'
                                            ? 'border-indigo-100 bg-indigo-50'
                                            : 'border-purple-100 bg-purple-50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span
                                            className={`font-bold ${plan.color === 'indigo' ? 'text-indigo-700' : 'text-purple-700'}`}
                                        >
                                            Gói {plan.name}
                                        </span>
                                        <Badge color={plan.color === 'indigo' ? 'purple' : 'purple'}>
                                            {plan.price}
                                        </Badge>
                                    </div>
                                    <ul className="space-y-1">
                                        {plan.features.map((f) => (
                                            <li
                                                key={f}
                                                className="flex items-center gap-1.5 text-sm text-gray-700"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4">
                            <Link
                                href="/pricing"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Xem bảng giá và đăng ký <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Base URL */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Base URL</h2>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-gray-600 mb-3">
                            Tất cả API endpoint đều có tiền tố sau. API <strong>chỉ hoạt động</strong> tại domain chính
                            thức.
                        </p>
                          <CodeBlock code={BASE_URL} />
                    </div>
                </section>

                {/* Auth */}
                <section id="auth">
                    <div className="flex items-center gap-2 mb-4">
                        <Key className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Xác thực (Authentication)</h2>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                        <p className="text-sm text-gray-600">
                            Mọi request đến API đều phải kèm theo API key qua một trong hai cách sau:
                        </p>

                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                                Cách 1 — Header{' '}
                                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">X-API-Key</code> (khuyến
                                nghị)
                            </p>
                            <CodeBlock
                                  code={`curl ${BASE_URL}/links \\
  -H "X-API-Key: ls_live_YOUR_API_KEY_HERE"`}
                            />
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                                Cách 2 — Header{' '}
                                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer</code>
                            </p>
                            <CodeBlock
                                  code={`curl ${BASE_URL}/links \\
  -H "Authorization: Bearer ls_live_YOUR_API_KEY_HERE"`}
                            />
                        </div>

                        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-700">
                                <strong>Bảo mật key của bạn.</strong> Không chia sẻ API key trên client-side (JavaScript
                                trình duyệt, mobile app không bảo mật). Chỉ gọi API từ server-side (backend, webhook,
                                serverless functions).
                            </p>
                        </div>
                    </div>
                </section>

                {/* Get API Key */}
                <section id="get-key">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Cách lấy API Key</h2>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <ol className="space-y-4 text-sm text-gray-700">
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                    1
                                </span>
                                <div>
                                    <strong>Đăng ký / Đăng nhập</strong> vào tài khoản tại{' '}
                                    <Link
                                        href="/register"
                                        className="text-blue-600 hover:underline"
                                    >
                                          {SITE_HOSTNAME}/register
                                    </Link>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                    2
                                </span>
                                <div>
                                    <strong>Nâng cấp lên gói Ultra hoặc Ultra+</strong> tại{' '}
                                    <Link
                                        href="/pricing"
                                        className="text-blue-600 hover:underline"
                                    >
                                          {SITE_HOSTNAME}/pricing
                                    </Link>{' '}
                                    (gói Cơ Bản và Pro không có API access)
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                    3
                                </span>
                                <div>
                                    Vào{' '}
                                    <Link
                                        href="/dashboard/settings"
                                        className="text-blue-600 hover:underline"
                                    >
                                        Dashboard → Cài đặt
                                    </Link>{' '}
                                    → phần <strong>API Key</strong>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                    4
                                </span>
                                <div>
                                      Nhấn <strong>&quot;Tạo API Key&quot;</strong> để sinh key mới dạng{' '}
                                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                                        ls_live_xxxxxxxxxx...
                                    </code>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                    5
                                </span>
                                <div>
                                    Sao chép và lưu trữ key an toàn (ví dụ: biến môi trường{' '}
                                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code>). Key chỉ
                                    hiển thị một lần khi cấp lại.
                                </div>
                            </li>
                        </ol>
                        <div className="mt-5">
                            <Link
                                href="/dashboard/settings"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-colors"
                            >
                                <Key className="w-4 h-4" />
                                Đến trang lấy API Key
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Response Format */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Terminal className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Định dạng Response</h2>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                        <p className="text-sm text-gray-600">
                            Tất cả response đều là JSON với{' '}
                            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                                Content-Type: application/json
                            </code>
                            .
                        </p>
                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">Response thành công</p>
                            <CodeBlock
                                code={`{
  "data": { ... },       // Đối với endpoint đơn lẻ
  "data": [ ... ],       // Đối với endpoint danh sách
  "meta": {             // Đính kèm khi phân trang
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}`}
                                lang="json"
                            />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">Response lỗi</p>
                            <CodeBlock
                                code={`{
  "error": "Mô tả lỗi",
  "code": "ERROR_CODE"    // Mã lỗi để xử lý trong code
}`}
                                lang="json"
                            />
                        </div>
                    </div>
                </section>

                {/* Endpoints */}
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <Link2 className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-bold text-gray-900">Endpoints</h2>
                    </div>

                    {/* GET /links */}
                    <div
                        id="list-links"
                        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-6"
                    >
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <MethodBadge method="GET" />
                            <code className="text-sm font-mono text-gray-700">/links</code>
                            <span className="text-sm text-gray-500 ml-auto">Danh sách link</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">
                                Lấy danh sách tất cả link thuộc tài khoản, hỗ trợ tìm kiếm và phân trang.
                            </p>

                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Query parameters</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th className="text-left py-2 pr-4 font-semibold text-gray-600">
                                                    Tham số
                                                </th>
                                                <th className="text-left py-2 pr-4 font-semibold text-gray-600">
                                                    Kiểu
                                                </th>
                                                <th className="text-left py-2 font-semibold text-gray-600">Mô tả</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">page</td>
                                                <td className="py-2 pr-4 text-gray-500">integer</td>
                                                <td className="py-2 text-gray-600">Trang hiện tại (mặc định: 1)</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">limit</td>
                                                <td className="py-2 pr-4 text-gray-500">integer</td>
                                                <td className="py-2 text-gray-600">
                                                    Số kết quả mỗi trang, tối đa 100 (mặc định: 20)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">search</td>
                                                <td className="py-2 pr-4 text-gray-500">string</td>
                                                <td className="py-2 text-gray-600">
                                                    Tìm theo tiêu đề, URL gốc, hoặc mã rút gọn
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Ví dụ request</p>
                                <CodeBlock
                                    code={`curl "${BASE_URL}/links?page=1&limit=10&search=facebook" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY"`}
                                />
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Response 200</p>
                                <CodeBlock
                                    code={`{
  "data": [
    {
      "id": "clxyz123",
      "shortCode": "abc123",
      "shortUrl": "${SITE_URL}/abc123",
      "originalUrl": "https://facebook.com/example",
      "title": "Trang Facebook",
      "isActive": true,
      "expiresAt": null,
      "maxClicks": null,
      "clicks": 142,
      "createdAt": "2025-01-15T08:30:00.000Z",
      "updatedAt": "2025-01-15T08:30:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}`}
                                    lang="json"
                                />
                            </div>
                        </div>
                    </div>

                    {/* POST /links */}
                    <div
                        id="create-link"
                        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-6"
                    >
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <MethodBadge method="POST" />
                            <code className="text-sm font-mono text-gray-700">/links</code>
                            <span className="text-sm text-gray-500 ml-auto">Tạo link mới</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">Tạo một link rút gọn mới.</p>

                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Request body (JSON)</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th className="text-left py-2 pr-4 font-semibold text-gray-600">
                                                    Trường
                                                </th>
                                                <th className="text-left py-2 pr-4 font-semibold text-gray-600">
                                                    Bắt buộc
                                                </th>
                                                <th className="text-left py-2 font-semibold text-gray-600">Mô tả</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">
                                                    originalUrl
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <Badge color="red">Bắt buộc</Badge>
                                                </td>
                                                <td className="py-2 text-gray-600">
                                                    URL đích đầy đủ (bắt đầu bằng https://)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">
                                                    customCode
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <Badge color="gray">Tuỳ chọn</Badge>
                                                </td>
                                                <td className="py-2 text-gray-600">
                                                    Mã rút gọn tự chọn (3-190 ký tự, a-z A-Z 0-9). Nếu bỏ trống hệ thống
                                                    tự tạo.
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">title</td>
                                                <td className="py-2 pr-4">
                                                    <Badge color="gray">Tuỳ chọn</Badge>
                                                </td>
                                                <td className="py-2 text-gray-600">
                                                    Tiêu đề cho link (tối đa 100 ký tự)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">expiresAt</td>
                                                <td className="py-2 pr-4">
                                                    <Badge color="gray">Tuỳ chọn</Badge>
                                                </td>
                                                <td className="py-2 text-gray-600">
                                                    Thời điểm hết hạn (ISO 8601, ví dụ: 2025-12-31T23:59:59Z)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">password</td>
                                                <td className="py-2 pr-4">
                                                    <Badge color="gray">Tuỳ chọn</Badge>
                                                </td>
                                                <td className="py-2 text-gray-600">Mật khẩu bảo vệ link</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">maxClicks</td>
                                                <td className="py-2 pr-4">
                                                    <Badge color="gray">Tuỳ chọn</Badge>
                                                </td>
                                                <td className="py-2 text-gray-600">
                                                    Số lần click tối đa, link tự ngừng sau khi đạt giới hạn
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Ví dụ request</p>
                                <CodeBlock
                                    code={`curl -X POST "${BASE_URL}/links" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "originalUrl": "https://example.com/very-long-url",
    "title": "Trang chủ Example",
    "customCode": "ex-home",
    "expiresAt": "2025-12-31T23:59:59Z",
    "maxClicks": 1000
  }'`}
                                />
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Response 201 — Created</p>
                                <CodeBlock
                                    code={`{
  "data": {
    "id": "clxyz456",
    "shortCode": "ex-home",
      "shortUrl": "${SITE_URL}/ex-home",
    "originalUrl": "https://example.com/very-long-url",
    "title": "Trang chủ Example",
    "isActive": true,
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "maxClicks": 1000,
    "clicks": 0,
    "createdAt": "2025-03-22T10:00:00.000Z",
    "updatedAt": "2025-03-22T10:00:00.000Z"
  }
}`}
                                    lang="json"
                                />
                            </div>
                        </div>
                    </div>

                    {/* GET /links/:id */}
                    <div
                        id="get-link"
                        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-6"
                    >
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <MethodBadge method="GET" />
                            <code className="text-sm font-mono text-gray-700">/links/:id</code>
                            <span className="text-sm text-gray-500 ml-auto">Chi tiết link</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">Lấy thông tin chi tiết của một link theo ID.</p>
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Ví dụ request</p>
                                <CodeBlock
                                    code={`curl "${BASE_URL}/links/clxyz456" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY"`}
                                />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Response 200</p>
                                <CodeBlock
                                    code={`{
  "data": {
    "id": "clxyz456",
    "shortCode": "ex-home",
      "shortUrl": "${SITE_URL}/ex-home",
    "originalUrl": "https://example.com/very-long-url",
    "title": "Trang chủ Example",
    "isActive": true,
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "maxClicks": 1000,
    "clicks": 47,
    "createdAt": "2025-03-22T10:00:00.000Z",
    "updatedAt": "2025-03-22T10:00:00.000Z"
  }
}`}
                                    lang="json"
                                />
                            </div>
                        </div>
                    </div>

                    {/* PATCH /links/:id */}
                    <div
                        id="update-link"
                        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-6"
                    >
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <MethodBadge method="PATCH" />
                            <code className="text-sm font-mono text-gray-700">/links/:id</code>
                            <span className="text-sm text-gray-500 ml-auto">Cập nhật link</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">
                                Cập nhật thông tin link. Chỉ truyền các trường cần thay đổi.
                            </p>
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Request body</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th className="text-left py-2 pr-4 font-semibold text-gray-600">
                                                    Trường
                                                </th>
                                                <th className="text-left py-2 font-semibold text-gray-600">Mô tả</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">title</td>
                                                <td className="py-2 text-gray-600">Tiêu đề mới</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">isActive</td>
                                                <td className="py-2 text-gray-600">Bật/tắt link (true/false)</td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">expiresAt</td>
                                                <td className="py-2 text-gray-600">
                                                    Ngày hết hạn mới (ISO 8601 hoặc null để xoá)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 pr-4 font-mono text-xs text-blue-600">maxClicks</td>
                                                <td className="py-2 text-gray-600">
                                                    Giới hạn click mới (số nguyên hoặc null để xoá)
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Ví dụ — Tắt link</p>
                                <CodeBlock
                                    code={`curl -X PATCH "${BASE_URL}/links/clxyz456" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "isActive": false }'`}
                                />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Ví dụ — Xoá ngày hết hạn</p>
                                <CodeBlock
                                    code={`curl -X PATCH "${BASE_URL}/links/clxyz456" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "expiresAt": null }'`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* DELETE /links/:id */}
                    <div
                        id="delete-link"
                        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-6"
                    >
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <MethodBadge method="DELETE" />
                            <code className="text-sm font-mono text-gray-700">/links/:id</code>
                            <span className="text-sm text-gray-500 ml-auto">Xoá link</span>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">
                                Xoá vĩnh viễn một link. Thao tác này không thể hoàn tác.
                            </p>
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Ví dụ request</p>
                                <CodeBlock
                                    code={`curl -X DELETE "${BASE_URL}/links/clxyz456" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY"`}
                                />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">Response 200</p>
                                <CodeBlock
                                    code={`{ "ok": true, "message": "Link đã được xoá" }`}
                                    lang="json"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* FB Debug */}
                <section id="fb-debug">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Facebook Debug</h2>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                        <p className="text-sm text-gray-600">
                            Quản lý token, cấu hình cron và gọi Facebook re-scrape bằng API key.
                        </p>
                        <CodeBlock
                            code={`# Xem cấu hình và danh sách token đã mask
curl "${BASE_URL}/fb-debug" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY"

# Thêm 1 token
curl -X POST "${BASE_URL}/fb-debug" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "label": "token1", "token": "EAAXXX..." }'

# Import nhiều token, mỗi dòng 1 token hoặc Label:token
curl -X POST "${BASE_URL}/fb-debug" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "bulkText": "token1:EAAXXX...\\ntoken2:EAAYYY..." }'

# Lưu cấu hình cron
curl -X PUT "${BASE_URL}/fb-debug" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "intervalMinutes": 30,
    "minClicksPerDay": 0,
    "debugAllActiveLinks": true,
    "debugDailyAllActiveLinks": true
  }'

# Check live/die tất cả token
curl -X PATCH "${BASE_URL}/fb-debug" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "action": "check-all" }'

# Re-scrape 1 URL
curl -X PATCH "${BASE_URL}/fb-debug" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
    -d '{ "action": "scrape", "url": "${SITE_URL}/abc123" }'

# Chạy debug ngay cho các link đủ điều kiện
curl -X PATCH "${BASE_URL}/fb-debug" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "action": "run-now", "limit": 10 }'

# Xoá token
curl -X DELETE "${BASE_URL}/fb-debug" \\
  -H "X-API-Key: ls_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "tokenId": "TOKEN_ID" }'`}
                        />
                    </div>
                </section>

                {/* Error codes */}
                <section id="errors">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <h2 className="text-lg font-bold text-gray-900">Mã lỗi (Error Codes)</h2>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50">
                                        <th className="text-left px-5 py-3 font-semibold text-gray-600">HTTP Status</th>
                                        <th className="text-left px-5 py-3 font-semibold text-gray-600">code</th>
                                        <th className="text-left px-5 py-3 font-semibold text-gray-600">Ý nghĩa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {[
                                        {status: '200', code: '—', desc: 'Thành công'},
                                        {status: '201', code: '—', desc: 'Tạo mới thành công'},
                                        {
                                            status: '400',
                                            code: '—',
                                            desc: 'Request không hợp lệ (sai tham số, URL sai định dạng...)',
                                        },
                                        {
                                            status: '401',
                                            code: 'MISSING_API_KEY',
                                            desc: 'Không có API key trong request',
                                        },
                                        {
                                            status: '401',
                                            code: 'INVALID_API_KEY',
                                            desc: 'API key sai hoặc đã bị thu hồi',
                                        },
                                        {
                                            status: '403',
                                            code: 'INVALID_HOST',
                                              desc: `Request không đến từ domain cho phép (${SITE_HOSTNAME})`,
                                        },
                                        {
                                            status: '403',
                                            code: 'PLAN_NOT_SUPPORTED',
                                            desc: 'Gói dịch vụ không hỗ trợ API (cần Ultra / Ultra+)',
                                        },
                                        {
                                            status: '404',
                                            code: '—',
                                            desc: 'Link không tồn tại hoặc không thuộc tài khoản',
                                        },
                                        {status: '409', code: '—', desc: 'Mã rút gọn đã tồn tại'},
                                        {status: '500', code: '—', desc: 'Lỗi server nội bộ'},
                                    ].map((row, i) => (
                                        <tr key={i}>
                                            <td className="px-5 py-3">
                                                <Badge
                                                    color={
                                                        row.status.startsWith('2')
                                                            ? 'green'
                                                            : row.status.startsWith('4')
                                                              ? 'yellow'
                                                              : row.status.startsWith('5')
                                                                ? 'red'
                                                                : 'gray'
                                                    }
                                                >
                                                    {row.status}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-3 font-mono text-xs text-gray-600">{row.code}</td>
                                            <td className="px-5 py-3 text-gray-600">{row.desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* SDK examples */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Terminal className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Ví dụ tích hợp</h2>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-5">
                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">Node.js / TypeScript</p>
                            <CodeBlock
                                code={`const API_KEY = process.env.LINKSHORT_API_KEY // ls_live_xxx
  const BASE    = '${BASE_URL}'

async function shortenUrl(originalUrl: string, title?: string) {
  const res = await fetch(\`\${BASE}/links\`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ originalUrl, title }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error)
  }

  const { data } = await res.json()
  return data.shortUrl  // "${SITE_URL}/abc123"
}

// Sử dụng
const shortUrl = await shortenUrl('https://example.com/very/long/path', 'Trang chủ')
console.log(shortUrl)`}
                                lang="typescript"
                            />
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">Python</p>
                            <CodeBlock
                                code={`import os
import requests

API_KEY = os.environ['LINKSHORT_API_KEY']  # ls_live_xxx
  BASE    = '${BASE_URL}'

def shorten_url(original_url: str, title: str = None) -> str:
    response = requests.post(
        f'{BASE}/links',
        headers={'X-API-Key': API_KEY, 'Content-Type': 'application/json'},
        json={'originalUrl': original_url, 'title': title},
    )
    response.raise_for_status()
    return response.json()['data']['shortUrl']

# Sử dụng
short_url = shorten_url('https://example.com/very/long/path', 'Trang chủ')
  print(short_url)  # ${SITE_URL}/abc123`}
                                lang="python"
                            />
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">PHP</p>
                            <CodeBlock
                                code={`<?php
$apiKey = getenv('LINKSHORT_API_KEY'); // ls_live_xxx
  $base   = '${BASE_URL}';

function shortenUrl(string $url, string $title = ''): string {
    global $apiKey, $base;
    $ch = curl_init("$base/links");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ["X-API-Key: $apiKey", 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode(['originalUrl' => $url, 'title' => $title]),
    ]);
    $body = json_decode(curl_exec($ch), true);
    curl_close($ch);
    return $body['data']['shortUrl'];
}

echo shortenUrl('https://example.com/very/long/path', 'Trang chủ');
  // ${SITE_URL}/abc123`}
                                lang="php"
                            />
                        </div>
                    </div>
                </section>

                {/* Support */}
                <section>
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-blue-900 mb-1">Cần hỗ trợ tích hợp?</h3>
                            <p className="text-sm text-blue-700">
                                Liên hệ đội ngũ hỗ trợ nếu bạn gặp khó khăn trong quá trình tích hợp API.
                            </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Link
                                href="/support"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                            >
                                Liên hệ hỗ trợ
                            </Link>
                            <Link
                                href="/dashboard/settings"
                                className="px-4 py-2 border border-blue-200 text-blue-700 hover:bg-blue-100 text-sm font-semibold rounded-xl transition-colors"
                            >
                                Lấy API Key
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
