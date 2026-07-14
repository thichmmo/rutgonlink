'use client';

import {useState, useEffect, useCallback, useRef, Suspense} from 'react';
import {useSearchParams, useRouter} from 'next/navigation';
import {apiFetch} from '@/lib/fetch';
import {Search, Loader2, X, FolderOpen, Download, Upload, CheckCircle, Users, BarChart2, Archive} from 'lucide-react';
import {Modal, Button, Alert} from 'antd';
import EditLinkModal from '@/components/EditLinkModal';
import LinkRow from '@/components/LinkRow';
import LinkStatsModal from '@/components/LinkStatsModal';
import CategoriesTab from '@/components/CategoriesTab';

interface Domain {
    id: string;
    domain: string;
    verified: boolean;
}

interface Category {
    id: string;
    name: string;
    color: string;
    _count: {links: number};
    totalClicks: number;
    activeLinks: number;
}

interface Workspace {
    id: string;
    name: string;
}

interface Link {
    id: string;
    shortCode: string;
    originalUrl: string;
    title: string | null;
    isActive: boolean;
    isArchived: boolean;
    ogEnabled: boolean;
    ogAutoReset: boolean;
    ogScheduledDisableAt: string | null;
    clickResetAt: string | null;
    folderRotationStartDate: string | null;
    createdAt: string;
    domain: Domain | null;
    sharedDomain: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    password: string | null;
    expiresAt: string | null;
    maxClicks: number | null;
    deepLinkIos: string | null;
    deepLinkAndroid: string | null;
    category: {id: string; name: string; color: string; _count?: {links: number}} | null;
    workspace?: {id: string; name: string} | null;
    _count: {clicks: number};
    clickTrend24h?: {current: number; previous: number; delta: number};
    deviceRules?: {deviceType: string; redirectUrl: string}[];
    countryRules?: {countryCode: string; redirectUrl: string}[];
    languageRules?: {languageCode: string; redirectUrl: string}[];
}

function LinksPageInner() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [tab, setTab] = useState<'links' | 'categories' | 'archived'>('links');
    const [showArchived, setShowArchived] = useState(false);
    const [links, setLinks] = useState<Link[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingLink, setEditingLink] = useState<Link | null>(null);
    const [statsLink, setStatsLink] = useState<Link | null>(null);
    const [domains, setDomains] = useState<Domain[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [filterCategoryId, setFilterCategoryId] = useState('');
    const [filterWorkspaceId, setFilterWorkspaceId] = useState(() => searchParams.get('workspaceId') || '');
    const [actionError, setActionError] = useState('');
    const [usage, setUsage] = useState<{
        plan: string;
        linkCount: number;
        clicksToday: number;
        clicksThisMonth: number;
        limits: {
            maxLinks: number | null;
            maxClicksPerMonth: number | null;
            canDeviceRedirect: boolean;
            canGeoRedirect: boolean;
        };
    } | null>(null);

    // Import/Export state
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{created: number; errors: number} | null>(null);
    const importFileRef = useRef<HTMLInputElement>(null);

    const limit = 20;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const sentinelRef = useRef<HTMLDivElement>(null);

    const fetchLinks = useCallback(
        async (pageNum = 1, append = false) => {
            if (!append) setLoading(true);
            else setLoadingMore(true);
            try {
                const params = new URLSearchParams({
                    page: pageNum.toString(),
                    limit: limit.toString(),
                    ...(search ? {search} : {}),
                    ...(filterCategoryId ? {categoryId: filterCategoryId} : {}),
                    ...(filterWorkspaceId ? {workspaceId: filterWorkspaceId} : {}),
                    ...(showArchived ? {archived: 'true'} : {}),
                });
                const res = await fetch(`/api/links?${params}`);
                const data = await res.json();
                if (append) {
                    setLinks((prev) => [...prev, ...(data.links || [])]);
                } else {
                    setLinks(data.links || []);
                }
                setTotal(data.total || 0);
                setPage(pageNum);
                setHasMore(pageNum * limit < (data.total || 0));
            } finally {
                if (!append) setLoading(false);
                else setLoadingMore(false);
            }
        },
        [search, filterCategoryId, filterWorkspaceId, showArchived],
    );

    const fetchDomains = useCallback(async () => {
        const res = await apiFetch('/api/domains');
        const data = await res.json();
        setDomains(Array.isArray(data) ? data : []);
    }, []);

    const fetchCategories = useCallback(async () => {
        const res = await fetch('/api/categories');
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
    }, []);

    const fetchWorkspaces = useCallback(async () => {
        const res = await fetch('/api/workspace');
        const data = await res.json();
        const all: Workspace[] = [...(data.owned || []), ...(data.memberOf || [])];
        setWorkspaces(all);
    }, []);

    useEffect(() => {
        fetchLinks(1, false);
    }, [fetchLinks]);

    // Infinite scroll: load next page when sentinel enters viewport
    const hasMoreRef = useRef(hasMore);
    const loadingMoreRef = useRef(loadingMore);
    const loadingRef = useRef(loading);
    const pageRef = useRef(page);
    const fetchLinksRef = useRef(fetchLinks);
    const sentinelVisibleRef = useRef(false);
    hasMoreRef.current = hasMore;
    loadingMoreRef.current = loadingMore;
    loadingRef.current = loading;
    pageRef.current = page;
    fetchLinksRef.current = fetchLinks;

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;

        const loadNext = () => {
            if (hasMoreRef.current && !loadingMoreRef.current && !loadingRef.current) {
                fetchLinksRef.current(pageRef.current + 1, true);
            }
        };

        const observer = new IntersectionObserver(
            (entries) => {
                sentinelVisibleRef.current = entries[0].isIntersecting;
                if (sentinelVisibleRef.current) loadNext();
            },
            {threshold: 0, rootMargin: '200px 0px'},
        );
        observer.observe(el);

        // If sentinel is already in viewport at attach time, load immediately.
        const rect = el.getBoundingClientRect();
        sentinelVisibleRef.current = rect.top <= window.innerHeight + 200;
        if (sentinelVisibleRef.current) loadNext();

        return () => observer.disconnect();
    }, [links.length, tab, showArchived, loading]);

    useEffect(() => {
        if (sentinelVisibleRef.current && hasMore && !loadingMore && !loading) {
            fetchLinks(page + 1, true);
        }
    }, [hasMore, loadingMore, loading, page, fetchLinks]);
    useEffect(() => {
        fetchDomains();
    }, [fetchDomains]);
    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);
    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);
    useEffect(() => {
        fetch('/api/user/usage')
            .then((r) => r.json())
            .then(setUsage)
            .catch(() => {});
    }, []);

    // Sync filterWorkspaceId from URL on mount
    useEffect(() => {
        const wsId = searchParams.get('workspaceId') || '';
        setFilterWorkspaceId(wsId);
    }, [searchParams]);

    useEffect(() => {
        const handler = () => fetchLinks();
        window.addEventListener('link-created', handler);
        return () => window.removeEventListener('link-created', handler);
    }, [fetchLinks]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    const handleWorkspaceFilter = (wsId: string) => {
        setFilterWorkspaceId(wsId);
        setPage(1);
        // Update URL query param
        const params = new URLSearchParams(searchParams.toString());
        if (wsId) {
            params.set('workspaceId', wsId);
        } else {
            params.delete('workspaceId');
        }
        router.replace(`/dashboard/links?${params.toString()}`);
    };

    const handleArchive = async (id: string, currentIsArchived: boolean) => {
        const newVal = !currentIsArchived;
        setLinks((prev) => prev.filter((l) => l.id !== id));
        setTotal((prev) => prev - 1);
        await fetch(`/api/links/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({isArchived: newVal}),
        });
    };

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: 'Xóa link',
            content: 'Bạn có chắc muốn xóa link này? Hành động này không thể hoàn tác.',
            okText: 'Xóa',
            cancelText: 'Hủy',
            okType: 'danger',
            onOk: async () => {
                await fetch(`/api/links/${id}`, {method: 'DELETE'});
                setLinks((prev) => prev.filter((l) => l.id !== id));
                setTotal((prev) => prev - 1);
            },
        });
    };

    const handleDuplicate = async (link: Link) => {
        setActionError('');
        const base = link.shortCode.replace(/\d+$/, '');
        const currentNum = parseInt(link.shortCode.match(/\d+$/)?.[0] || '0');
        for (let i = currentNum + 1; i <= currentNum + 10; i++) {
            const newCode = `${base}${i}`;
            const res = await apiFetch('/api/links', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    originalUrl: link.originalUrl,
                    customCode: newCode,
                    title: link.title ? `${link.title} (${i})` : undefined,
                    domainId: link.domain?.id || undefined,
                    sharedDomain: link.sharedDomain || undefined,
                    categoryId: link.category?.id || undefined,
                    workspaceId: link.workspace?.id || undefined,
                    maxClicks: link.maxClicks || undefined,
                    expiresAt: link.expiresAt || undefined,
                    deepLinkIos: link.deepLinkIos || undefined,
                    deepLinkAndroid: link.deepLinkAndroid || undefined,
                    isActive: link.isActive,
                    ogEnabled: link.ogEnabled,
                    ogAutoReset: link.ogAutoReset,
                    ogTitle: link.ogTitle || undefined,
                    ogDescription: link.ogDescription || undefined,
                    ogImage: link.ogImage || undefined,
                    deviceRules: link.deviceRules?.length
                        ? link.deviceRules.map(
                              ({deviceType, redirectUrl}: {deviceType: string; redirectUrl: string}) => ({
                                  deviceType,
                                  redirectUrl,
                              }),
                          )
                        : undefined,
                    countryRules: link.countryRules?.length
                        ? link.countryRules.map(
                              ({countryCode, redirectUrl}: {countryCode: string; redirectUrl: string}) => ({
                                  countryCode,
                                  redirectUrl,
                              }),
                          )
                        : undefined,
                    languageRules: link.languageRules?.length
                        ? link.languageRules.map(
                              ({languageCode, redirectUrl}: {languageCode: string; redirectUrl: string}) => ({
                                  languageCode,
                                  redirectUrl,
                              }),
                          )
                        : undefined,
                }),
            });
            if (res.ok) {
                const newLink = await res.json();
                // Copy folder assignments from old link to new link
                await fetch(`/api/links/${newLink.id}/copy-folders`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ sourceLinkId: link.id }),
                }).catch(() => {}); // Ignore errors
                fetchLinks();
                return;
            }
            const json = await res.json();
            if (json.error !== 'Mã rút gọn đã tồn tại') {
                setActionError(json.error || 'Không thể nhân bản link');
                return;
            }
        }
        setActionError('Không tìm được mã rút gọn trống, hãy tạo thủ công');
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? {...l, isActive: !isActive} : l)));
        await fetch(`/api/links/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({isActive: !isActive}),
        });
    };

    const handleToggleMeta = (id: string, ogEnabled: boolean) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? {...l, ogEnabled: !ogEnabled} : l)));
        fetch(`/api/links/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ogEnabled: !ogEnabled}),
        });
    };

    const handleTitleUpdate = (id: string, title: string | null) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? {...l, title} : l)));
    };

    const handleFieldUpdate = (id: string, fields: Partial<Link>) => {
        setLinks((prev) => prev.map((l) => (l.id === id ? {...l, ...fields} : l)));
    };

    const handleExport = () => {
        window.open('/api/links/export', '_blank');
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        setImportResult(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/links/import', {method: 'POST', body: formData});
            const data = await res.json();
            if (res.ok) {
                setImportResult({created: data.created, errors: data.errors});
                fetchLinks();
            } else {
                setActionError(data.error || 'Lỗi import');
            }
        } catch {
            setActionError('Không thể kết nối server');
        } finally {
            setImporting(false);
            if (importFileRef.current) importFileRef.current.value = '';
        }
    };

    const getShortUrl = (link: Link) =>
        link.domain ? `https://${link.domain.domain}/${link.shortCode}` : `${baseUrl}/${link.shortCode}`;

    const activeWorkspace = workspaces.find((w) => w.id === filterWorkspaceId);

    return (
        <div className="space-y-6">
            {actionError && (
                <Alert
                    type="error"
                    message={actionError}
                    showIcon
                    closable
                    onClose={() => setActionError('')}
                    className="rounded-xl"
                />
            )}
            {importResult && (
                <Alert
                    type={importResult.errors === 0 ? 'success' : 'warning'}
                    showIcon
                    closable
                    onClose={() => setImportResult(null)}
                    className="rounded-xl"
                    message={`Import xong: ${importResult.created} link tạo thành công${importResult.errors > 0 ? `, ${importResult.errors} lỗi` : ''}`}
                />
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý Links</h1>
                    <p className="text-gray-600 text-sm mt-1">
                        {total} links{activeWorkspace ? ` trong workspace "${activeWorkspace.name}"` : ' tổng cộng'}
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                    <input
                        ref={importFileRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportFile}
                    />
                    <Button
                        icon={importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        onClick={() => importFileRef.current?.click()}
                        disabled={importing}
                        title="Import từ CSV"
                        className="min-w-0"
                    >
                        {importing ? 'Đang import...' : 'Import CSV'}
                    </Button>
                    <Button
                        icon={<Download className="w-4 h-4" />}
                        onClick={handleExport}
                        title="Xuất ra CSV"
                        className="min-w-0"
                    >
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Usage banner */}
            {usage && usage.plan !== 'free' && (
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 p-4 bg-sky-50 border border-sky-100 rounded-2xl text-sm">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <BarChart2 className="w-4 h-4 text-sky-500" />
                        <span className="text-gray-600">Links:</span>
                        <span className="font-semibold text-gray-900">
                            {usage.linkCount.toLocaleString()}
                            {usage.limits.maxLinks !== null
                                ? ` / ${usage.limits.maxLinks.toLocaleString()}`
                                : ' (không giới hạn)'}
                        </span>
                        {usage.limits.maxLinks !== null && (
                            <div className="w-24 h-1.5 bg-sky-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-sky-500 rounded-full transition-all"
                                    style={{
                                        width: `${Math.min(100, (usage.linkCount / usage.limits.maxLinks) * 100)}%`,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="text-gray-600">Clicks hôm nay:</span>
                        <span className="font-semibold text-gray-900">{usage.clicksToday.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="text-gray-600">Clicks tháng này:</span>
                        <span className="font-semibold text-gray-900">
                            {usage.clicksThisMonth.toLocaleString()}
                            {usage.limits.maxClicksPerMonth !== null
                                ? ` / ${usage.limits.maxClicksPerMonth.toLocaleString()}`
                                : ' (không giới hạn)'}
                        </span>
                        {usage.limits.maxClicksPerMonth !== null && (
                            <div className="w-24 h-1.5 bg-sky-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-sky-500 rounded-full transition-all"
                                    style={{
                                        width: `${Math.min(100, (usage.clicksThisMonth / usage.limits.maxClicksPerMonth) * 100)}%`,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => {
                        setTab('links');
                        setShowArchived(false);
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${tab === 'links' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Links
                </button>
                <button
                    onClick={() => {
                        setTab('categories');
                        setShowArchived(false);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${tab === 'categories' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FolderOpen className="w-4 h-4" />
                    Danh mục
                    {categories.length > 0 && (
                        <span className="text-xs bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">
                            {categories.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => {
                        setTab('archived');
                        setShowArchived(true);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${tab === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Archive className="w-4 h-4" />
                    Lưu trữ
                </button>
            </div>

            {tab === 'categories' ? (
                <CategoriesTab
                    categories={categories}
                    onChange={() => {
                        fetchCategories();
                        fetchLinks();
                    }}
                    onViewLinks={(categoryId) => {
                        setFilterCategoryId(categoryId);
                        setTab('links');
                        setShowArchived(false);
                    }}
                />
            ) : (
                <>
                    {/* Search + Filters */}
                    <div className="flex gap-3 flex-wrap">
                        <form
                            onSubmit={handleSearch}
                            className="flex gap-3 flex-1"
                        >
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    type="text"
                                    placeholder="Tìm kiếm theo URL, tiêu đề, mã..."
                                    className="w-full pl-10 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                                />
                                {searchInput && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchInput('');
                                            setSearch('');
                                            setPage(1);
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <Button
                                type="default"
                                htmlType="submit"
                                icon={<Search className="w-4 h-4" />}
                            >
                                Tìm
                            </Button>
                        </form>

                        {categories.length > 0 && (
                            <select
                                value={filterCategoryId}
                                onChange={(e) => {
                                    setFilterCategoryId(e.target.value);
                                    setPage(1);
                                }}
                                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
                            >
                                <option value="">Tất cả danh mục</option>
                                {categories.map((c) => (
                                    <option
                                        key={c.id}
                                        value={c.id}
                                    >
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        )}

                        {workspaces.length > 0 && (
                            <select
                                value={filterWorkspaceId}
                                onChange={(e) => handleWorkspaceFilter(e.target.value)}
                                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
                            >
                                <option value="">Tất cả workspace</option>
                                {workspaces.map((w) => (
                                    <option
                                        key={w.id}
                                        value={w.id}
                                    >
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                        )}

                        {filterWorkspaceId && (
                            <button
                                onClick={() => handleWorkspaceFilter('')}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm text-sky-600 bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition-colors cursor-pointer"
                            >
                                <Users className="w-4 h-4" />
                                {activeWorkspace?.name}
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                            </div>
                        ) : links.length === 0 ? (
                            <div className="text-center py-16 text-gray-500">
                                <p className="text-lg font-medium mb-2">
                                    {showArchived ? 'Chưa có link lưu trữ nào' : 'Chưa có link nào'}
                                </p>
                                <p className="text-sm">
                                    {showArchived
                                        ? 'Lưu trữ link để ẩn khỏi danh sách chính.'
                                        : filterWorkspaceId
                                          ? 'Workspace này chưa có link nào.'
                                          : 'Nhấn "Tạo link mới" để bắt đầu.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full lg:min-w-[980px]">
                                        <thead className="hidden lg:table-header-group">
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="pl-4 pr-2 py-3 w-14" />
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    Link rút gọn
                                                </th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    URL gốc
                                                </th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    Clicks
                                                </th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    Trạng thái
                                                </th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {links.map((link) => (
                                                <LinkRow
                                                    key={link.id}
                                                    link={link}
                                                    baseUrl={baseUrl}
                                                    onDelete={handleDelete}
                                                    onToggle={handleToggle}
                                                    onToggleMeta={handleToggleMeta}
                                                    onEdit={(l) => setEditingLink(l)}
                                                    onDuplicate={handleDuplicate}
                                                    onStats={(l) => setStatsLink(l)}
                                                    onArchive={handleArchive}
                                                    onTitleUpdate={handleTitleUpdate}
                                                    onFieldUpdate={handleFieldUpdate}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Infinite scroll sentinel */}
                                <div
                                    ref={sentinelRef}
                                    className="px-6 py-3 flex items-center justify-center min-h-12"
                                >
                                    {loadingMore && <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />}
                                    {!loadingMore && !hasMore && links.length > 0 && (
                                        <span className="text-xs text-gray-400">Đã hiển thị tất cả {total} links</span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* CSV hint */}
                    <p className="text-xs text-gray-400 text-center">
                        <CheckCircle className="w-3.5 h-3.5 inline mr-1 text-sky-500" />
                        Import CSV: cột đầu = mã rút gọn (bỏ qua), cột 2 = URL gốc (bắt buộc), cột 3 = tiêu đề — tối đa
                        500 dòng/lần
                    </p>
                </>
            )}

            {editingLink && (
                <EditLinkModal
                    link={editingLink}
                    baseUrl={baseUrl}
                    domains={domains}
                    categories={categories}
                    workspaces={workspaces}
                    canDeviceRedirect={usage?.limits.canDeviceRedirect ?? true}
                    canGeoRedirect={usage?.limits.canGeoRedirect ?? true}
                    onClose={() => setEditingLink(null)}
                    onSuccess={(shortUrl) => {
                        setEditingLink(null);
                        fetchLinks();
                        if (shortUrl) navigator.clipboard.writeText(shortUrl).catch(() => {});
                    }}
                />
            )}

            {statsLink && (
                <LinkStatsModal
                    link={{
                        id: statsLink.id,
                        shortCode: statsLink.shortCode,
                        shortUrl: getShortUrl(statsLink),
                        title: statsLink.title,
                    }}
                    onClose={() => setStatsLink(null)}
                />
            )}
        </div>
    );
}

export default function LinksPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                </div>
            }
        >
            <LinksPageInner />
        </Suspense>
    );
}
