'use client';

import {useState, useEffect, useCallback} from 'react';
import Link from 'next/link';
import {apiFetch} from '@/lib/fetch';
import {Globe, Plus, Trash2, CheckCircle, XCircle, Loader2, RefreshCw, ShieldCheck, BarChart2} from 'lucide-react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';

interface Domain {
    id: string;
    domain: string;
    verified: boolean;
    createdAt: string;
    _count: {links: number};
}

const domainSchema = z.object({
    domain: z
        .string()
        .min(3, 'Domain quá ngắn')
        .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/, 'Domain không hợp lệ'),
});

type DomainForm = z.infer<typeof domainSchema>;

export default function DomainsPage() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [addError, setAddError] = useState('');
    const [adding, setAdding] = useState(false);
    const [success, setSuccess] = useState('');
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [verifyResults, setVerifyResults] = useState<Record<string, {ok: boolean; msg: string}>>({});
    const [usage, setUsage] = useState<{
        plan: string;
        domainCount: number;
        limits: {maxDomains: number};
    } | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: {errors},
    } = useForm<DomainForm>({resolver: zodResolver(domainSchema)});

    const fetchDomains = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/domains');
            const data = await res.json();
            setDomains(data || []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDomains();
    }, [fetchDomains]);
    useEffect(() => {
        fetch('/api/user/usage')
            .then((r) => r.json())
            .then(setUsage)
            .catch(() => {});
    }, []);

    const onSubmit = async (data: DomainForm) => {
        setAdding(true);
        setAddError('');
        setSuccess('');

        try {
            const res = await apiFetch('/api/domains', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });

            const json = await res.json();

            if (!res.ok) {
                setAddError(json.error || 'Đã xảy ra lỗi');
                return;
            }

            setSuccess(`Đã thêm domain ${data.domain} thành công!`);
            reset();
            fetchDomains();
        } catch {
            setAddError('Không thể kết nối server');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string, domainName: string) => {
        if (!confirm(`Xóa domain "${domainName}"? Các link dùng domain này sẽ bị ảnh hưởng.`)) return;
        await fetch(`/api/domains/${id}`, {method: 'DELETE'});
        fetchDomains();
    };

    const handleVerify = async (domain: Domain) => {
        setVerifyingId(domain.id);
        setVerifyResults((prev) => ({...prev, [domain.id]: {ok: false, msg: ''}}));

        try {
            const res = await fetch(`/api/domains/${domain.id}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({}),
            });
            const json = await res.json();

            if (res.ok) {
                setVerifyResults((prev) => ({...prev, [domain.id]: {ok: true, msg: 'DNS xác minh thành công!'}}));
                fetchDomains();
            } else {
                setVerifyResults((prev) => ({
                    ...prev,
                    [domain.id]: {ok: false, msg: json.error || 'Xác minh thất bại'},
                }));
            }
        } catch {
            setVerifyResults((prev) => ({...prev, [domain.id]: {ok: false, msg: 'Không thể kết nối server'}}));
        } finally {
            setVerifyingId(null);
        }
    };

    const handleForceVerify = async (domain: Domain) => {
        if (
            !confirm(
                `Xác minh thủ công domain "${domain.domain}"?\n\nChỉ làm điều này nếu bạn chắc chắn DNS đã trỏ đúng.`,
            )
        )
            return;
        setVerifyingId(domain.id);
        try {
            const res = await fetch(`/api/domains/${domain.id}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'force-verify'}),
            });
            if (res.ok) {
                setVerifyResults((prev) => ({...prev, [domain.id]: {ok: true, msg: 'Đã xác minh thủ công!'}}));
                fetchDomains();
            }
        } catch {
            /* ignore */
        } finally {
            setVerifyingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">Custom Domains</h1>
                <p className="text-gray-600 text-sm mt-1">Sử dụng tên miền riêng cho link rút gọn của bạn</p>
            </div>

            {/* Usage banner */}
            {usage && usage.plan !== 'free' && (
                <div className="flex flex-wrap items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-2xl text-sm">
                    <BarChart2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-gray-600">Custom domains:</span>
                    <span className="font-semibold text-gray-900">
                        {usage.domainCount}
                        {usage.limits.maxDomains !== Infinity
                            ? ` / ${usage.limits.maxDomains || 'Không giới hạn'}`
                            : ' (không giới hạn)'}
                    </span>
                    {usage.limits.maxDomains !== Infinity && usage.limits.maxDomains > 0 && (
                        <div className="w-24 h-1.5 bg-green-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{
                                    width: `${Math.min(100, (usage.domainCount / usage.limits.maxDomains) * 100)}%`,
                                }}
                            />
                        </div>
                    )}
                    {usage.limits.maxDomains === 0 && (
                        <Link
                            href="/pricing"
                            className="text-xs text-green-600 underline ml-1"
                        >
                            Nâng cấp để dùng custom domain
                        </Link>
                    )}
                </div>
            )}

            {/* Add Domain */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-green-600" />
                    Thêm domain mới
                </h2>

                {addError && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                        {addError}
                    </div>
                )}
                {success && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
                        {success}
                    </div>
                )}

                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="flex flex-col sm:flex-row gap-3"
                >
                    <div className="flex-1 min-w-0">
                        <input
                            {...register('domain')}
                            type="text"
                            placeholder="links.example.com"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        {errors.domain && <p className="mt-1 text-xs text-red-600">{errors.domain.message}</p>}
                    </div>
                    <button
                        type="submit"
                        disabled={adding}
                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                        Thêm domain
                    </button>
                </form>
            </div>

            {/* DNS Instructions */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 sm:p-6 overflow-hidden">
                <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Hướng dẫn cấu hình domain
                </h3>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                                1
                            </span>
                            <span className="text-sm font-semibold text-green-900">Thêm domain ở form phía trên</span>
                        </div>
                        <p className="text-green-800 text-xs sm:ml-8">
                            Nhập tên miền bạn muốn sử dụng (VD:{' '}
                            <code className="bg-green-100 px-1.5 py-0.5 rounded">link.congty.vn</code>)
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                                2
                            </span>
                            <span className="text-sm font-semibold text-green-900">
                                Trỏ DNS về server của chúng tôi
                            </span>
                        </div>
                        <p className="text-green-800 text-xs sm:ml-8 mb-2">
                            Vào nhà cung cấp tên miền → <strong>Quản lý DNS</strong> → Thêm bản ghi:
                        </p>

                        <div className="sm:ml-8 mb-2">
                            <div className="text-xs font-semibold text-green-700 mb-1">
                                Cách 1: Bản ghi A (khuyên dùng)
                            </div>
                            <div className="bg-white rounded-xl border border-green-200 p-3 font-mono text-sm overflow-hidden">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-green-900">
                                    <div>
                                        <div className="text-xs text-green-600 font-sans font-semibold mb-1">Type</div>
                                        <div>A</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-green-600 font-sans font-semibold mb-1">Name</div>
                                        <div>@ hoặc subdomain</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-green-600 font-sans font-semibold mb-1">Value</div>
                                        <div className="select-all">160.191.87.43</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="sm:ml-8">
                            <div className="text-xs font-semibold text-green-700 mb-1">
                                Cách 2: CNAME (cho subdomain)
                            </div>
                            <div className="bg-white rounded-xl border border-green-200 p-3 font-mono text-sm overflow-hidden">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-green-900">
                                    <div>
                                        <div className="text-xs text-green-600 font-sans font-semibold mb-1">Type</div>
                                        <div>CNAME</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-green-600 font-sans font-semibold mb-1">Name</div>
                                        <div>link (subdomain)</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-green-600 font-sans font-semibold mb-1">Value</div>
                                        <div className="select-all">rutgon.vmeta.vn</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                                3
                            </span>
                            <span className="text-sm font-semibold text-green-900">
                                Bấm &quot;Kiểm tra xác minh&quot; bên dưới
                            </span>
                        </div>
                        <p className="text-green-800 text-xs sm:ml-8">
                            Sau khi DNS đã trỏ đúng (5-30 phút), nhấn nút xác minh. Nếu DNS check thất bại nhưng bạn đã
                            ping thành công, dùng <strong>&quot;Xác minh thủ công&quot;</strong>.
                        </p>
                    </div>

                    <div className="sm:ml-8 bg-green-100/50 rounded-lg p-3 text-xs text-green-800 space-y-1">
                        <p>
                            <strong>Lưu ý:</strong>
                        </p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>
                                Nếu dùng <strong>Cloudflare</strong>, tắt proxy (đám mây cam → xám)
                            </li>
                            <li>
                                Domain gốc (congty.vn) → bản ghi <strong>A</strong>
                            </li>
                            <li>
                                Subdomain (link.congty.vn) → <strong>CNAME</strong> hoặc <strong>A</strong>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Domains List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-5 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Danh sách domains ({domains.length})</h2>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                    </div>
                ) : domains.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p>Chưa có domain nào. Thêm domain đầu tiên!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {domains.map((domain) => (
                            <div
                                key={domain.id}
                                className="px-4 sm:px-6 py-4"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Globe className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 break-all">{domain.domain}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {domain._count.links} links đang dùng
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end w-full sm:w-auto">
                                        {domain.verified ? (
                                            <span className="flex items-center gap-1 text-green-600 bg-green-50 text-xs font-medium px-2.5 py-1 rounded-full">
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                Đã xác minh
                                            </span>
                                        ) : (
                                            <>
                                                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 text-xs font-medium px-2.5 py-1 rounded-full">
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Chờ xác minh
                                                </span>
                                                {/* DNS check verify */}
                                                <button
                                                    onClick={() => handleVerify(domain)}
                                                    disabled={verifyingId === domain.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
                                                >
                                                    {verifyingId === domain.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    )}
                                                    Kiểm tra xác minh
                                                </button>
                                                {/* Force verify */}
                                                <button
                                                    onClick={() => handleForceVerify(domain)}
                                                    disabled={verifyingId === domain.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
                                                >
                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                    Xác minh thủ công
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleDelete(domain.id, domain.domain)}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Verify result message */}
                                {verifyResults[domain.id]?.msg && (
                                    <div
                                        className={`mt-2 sm:ml-14 text-xs px-3 py-2 rounded-lg ${
                                            verifyResults[domain.id].ok
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'bg-red-50 text-red-700 border border-red-200'
                                        }`}
                                    >
                                        {verifyResults[domain.id].msg}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
