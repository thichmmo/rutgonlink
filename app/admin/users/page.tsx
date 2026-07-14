'use client';

import {useEffect, useState, useCallback} from 'react';
import {Search, Crown, RotateCcw, X, Check, ChevronLeft, ChevronRight, Trash2} from 'lucide-react';
import {formatDate} from '@/lib/utils';

interface User {
    id: string;
    name: string | null;
    email: string;
    loginType: 'password' | 'google';
    plan: string;
    planExpiresAt: string | null;
    createdAt: string;
    linkCount: number;
    clickCount: number;
}

const PLAN_LABEL: Record<string, string> = {free: 'Cơ Bản', pro: 'Pro', ultra: 'Ultra', ultra_plus: 'Ultra+'};
const PLAN_COLOR: Record<string, string> = {free: '#6b7280', pro: '#16a34a', ultra: '#4f46e5', ultra_plus: '#9333ea'};

const PLANS = [
    {value: 'pro', label: 'Pro'},
    {value: 'ultra', label: 'Ultra'},
    {value: 'ultra_plus', label: 'Ultra+'},
];
const PERIODS = [
    {value: '1m', label: '1 tháng'},
    {value: '6m', label: '6 tháng'},
    {value: '1y', label: '1 năm'},
    {value: 'lifetime', label: 'Trọn đời'},
];

type Modal =
    | {type: 'reset'; user: User}
    | {type: 'upgrade'; user: User}
    | {type: 'resetResult'; user: User; newPassword: string}
    | {type: 'delete'; user: User}
    | null;

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<Modal>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [upgradePlan, setUpgradePlan] = useState('pro');
    const [upgradePeriod, setUpgradePeriod] = useState('1m');
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({page: String(page)});
        if (search) params.set('search', search);
        if (planFilter) params.set('plan', planFilter);
        const res = await fetch(`/api/admin/users?${params}`);
        const data = await res.json();
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        setLoading(false);
    }, [page, search, planFilter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleResetPassword = async () => {
        if (modal?.type !== 'reset') return;
        setActionLoading(true);
        const res = await fetch(`/api/admin/users/${modal.user.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'reset-password'}),
        });
        const data = await res.json();
        setActionLoading(false);
        if (data.success) {
            setModal({type: 'resetResult', user: modal.user, newPassword: data.newPassword});
        } else {
            showToast('Lỗi reset mật khẩu');
            setModal(null);
        }
    };

    const handleDeleteUser = async () => {
        if (modal?.type !== 'delete') return;
        setActionLoading(true);
        const res = await fetch(`/api/admin/users/${modal.user.id}`, {method: 'DELETE'});
        const data = await res.json();
        setActionLoading(false);
        if (data.success) {
            showToast(`Đã xóa tài khoản ${modal.user.email}`);
            setModal(null);
            fetchUsers();
        } else {
            showToast('Lỗi xóa tài khoản');
        }
    };

    const handleUpgradePlan = async () => {
        if (modal?.type !== 'upgrade') return;
        setActionLoading(true);
        const res = await fetch(`/api/admin/users/${modal.user.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'upgrade-plan', plan: upgradePlan, period: upgradePeriod}),
        });
        const data = await res.json();
        setActionLoading(false);
        if (data.success) {
            showToast(`Đã nâng gói ${PLAN_LABEL[upgradePlan]} cho ${modal.user.email}`);
            setModal(null);
            fetchUsers();
        } else {
            showToast('Lỗi nâng gói');
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-xl font-bold text-white">Quản lý người dùng</h1>
                <p className="text-gray-500 text-sm mt-0.5">Tổng {total.toLocaleString()} người dùng</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Tìm theo email hoặc tên..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                    />
                </div>
                <select
                    value={planFilter}
                    onChange={(e) => {
                        setPlanFilter(e.target.value);
                        setPage(1);
                    }}
                    className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-gray-500"
                >
                    <option value="">Tất cả gói</option>
                    <option value="free">Cơ Bản</option>
                    <option value="pro">Pro</option>
                    <option value="ultra">Ultra</option>
                    <option value="ultra_plus">Ultra+</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-gray-800">
                            <tr className="text-gray-500 text-xs">
                                <th className="text-left px-4 py-3 font-medium">Người dùng</th>
                                <th className="text-left px-4 py-3 font-medium">Đăng nhập</th>
                                <th className="text-left px-4 py-3 font-medium">Gói</th>
                                <th className="text-right px-4 py-3 font-medium">Links</th>
                                <th className="text-right px-4 py-3 font-medium">Clicks</th>
                                <th className="text-left px-4 py-3 font-medium">Đăng ký</th>
                                <th className="text-right px-4 py-3 font-medium">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="text-center py-12"
                                    >
                                        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="text-center py-12 text-gray-600"
                                    >
                                        Không tìm thấy người dùng
                                    </td>
                                </tr>
                            ) : (
                                users.map((u) => (
                                    <tr
                                        key={u.id}
                                        className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-white">{u.name || '—'}</div>
                                            <div className="text-xs text-gray-500">{u.email}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {u.loginType === 'google' ? (
                                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 font-medium">
                                                    <svg
                                                        className="w-3 h-3"
                                                        viewBox="0 0 24 24"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                            fill="#4285F4"
                                                        />
                                                        <path
                                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                            fill="#34A853"
                                                        />
                                                        <path
                                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                            fill="#FBBC05"
                                                        />
                                                        <path
                                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                            fill="#EA4335"
                                                        />
                                                    </svg>
                                                    Google
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 font-medium">
                                                    Mật khẩu
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <span
                                                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                                    style={{
                                                        backgroundColor: `${PLAN_COLOR[u.plan] ?? '#6b7280'}25`,
                                                        color: PLAN_COLOR[u.plan] ?? '#6b7280',
                                                    }}
                                                >
                                                    {PLAN_LABEL[u.plan] ?? u.plan}
                                                </span>
                                                {u.planExpiresAt && u.plan !== 'free' && (
                                                    <div className="text-xs text-gray-600 mt-0.5">
                                                        HH: {formatDate(new Date(u.planExpiresAt))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                                            {u.linkCount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                                            {u.clickCount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {formatDate(new Date(u.createdAt))}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setModal({type: 'reset', user: u})}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-colors cursor-pointer"
                                                    title="Reset mật khẩu"
                                                >
                                                    <RotateCcw className="w-3 h-3" /> Reset MK
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setUpgradePlan('pro');
                                                        setUpgradePeriod('1m');
                                                        setModal({type: 'upgrade', user: u});
                                                    }}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-900/40 hover:bg-purple-900/70 text-purple-300 hover:text-purple-100 rounded-lg text-xs transition-colors cursor-pointer"
                                                    title="Nâng gói"
                                                >
                                                    <Crown className="w-3 h-3" /> Nâng gói
                                                </button>
                                                <button
                                                    onClick={() => setModal({type: 'delete', user: u})}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-900/40 hover:bg-red-900/70 text-red-400 hover:text-red-200 rounded-lg text-xs transition-colors cursor-pointer"
                                                    title="Xóa tài khoản"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                        <span className="text-xs text-gray-500">
                            Trang {page}/{pages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                                className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                disabled={page >= pages}
                                onClick={() => setPage((p) => p + 1)}
                                className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete user confirm modal */}
            {modal?.type === 'delete' && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Trash2 className="w-4 h-4 text-red-400" /> Xóa tài khoản
                            </h3>
                            <button
                                onClick={() => setModal(null)}
                                className="text-gray-500 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">
                            Xóa vĩnh viễn tài khoản <span className="text-white font-medium">{modal.user.email}</span>?
                        </p>
                        <p className="text-xs text-red-400 mb-5">
                            Tất cả links, clicks và dữ liệu liên quan sẽ bị xóa. Không thể hoàn tác.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setModal(null)}
                                className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm cursor-pointer"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                disabled={actionLoading}
                                className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
                            >
                                {actionLoading ? 'Đang xóa...' : 'Xóa tài khoản'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset password confirm modal */}
            {modal?.type === 'reset' && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-white">Reset mật khẩu</h3>
                            <button
                                onClick={() => setModal(null)}
                                className="text-gray-500 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-5">
                            Đặt lại mật khẩu cho <span className="text-white font-medium">{modal.user.email}</span>? Mật
                            khẩu mới sẽ được tạo ngẫu nhiên.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setModal(null)}
                                className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm cursor-pointer"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={handleResetPassword}
                                disabled={actionLoading}
                                className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
                            >
                                {actionLoading ? 'Đang xử lý...' : 'Xác nhận reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset result modal */}
            {modal?.type === 'resetResult' && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-sky-600/20 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-sky-400" />
                            </div>
                            <h3 className="font-semibold text-white">Đã reset thành công</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">
                            Mật khẩu mới cho <span className="text-white">{modal.user.email}</span>:
                        </p>
                        <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 font-mono text-lg text-sky-400 text-center tracking-widest mb-5">
                            {modal.newPassword}
                        </div>
                        <p className="text-xs text-gray-600 mb-4">
                            Hãy gửi mật khẩu này cho người dùng và yêu cầu họ đổi lại sau khi đăng nhập.
                        </p>
                        <button
                            onClick={() => setModal(null)}
                            className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}

            {/* Upgrade plan modal */}
            {modal?.type === 'upgrade' && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Crown className="w-4 h-4 text-purple-400" /> Nâng gói tặng
                            </h3>
                            <button
                                onClick={() => setModal(null)}
                                className="text-gray-500 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            Nâng gói cho <span className="text-white font-medium">{modal.user.email}</span>
                        </p>
                        <div className="space-y-3 mb-5">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Gói dịch vụ</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {PLANS.map((p) => (
                                        <button
                                            key={p.value}
                                            onClick={() => setUpgradePlan(p.value)}
                                            className={`py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${upgradePlan === p.value ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Thời hạn</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PERIODS.map((p) => (
                                        <button
                                            key={p.value}
                                            onClick={() => setUpgradePeriod(p.value)}
                                            className={`py-2 rounded-lg text-sm transition-colors cursor-pointer ${upgradePeriod === p.value ? 'bg-purple-700 text-white font-medium' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setModal(null)}
                                className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm cursor-pointer"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={handleUpgradePlan}
                                disabled={actionLoading}
                                className="flex-1 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium disabled:opacity-60 cursor-pointer"
                            >
                                {actionLoading ? 'Đang xử lý...' : 'Xác nhận tặng'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl z-50">
                    {toast}
                </div>
            )}
        </div>
    );
}
