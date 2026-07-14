'use client';

import {useState, useRef, useEffect} from 'react';
import {createPortal} from 'react-dom';
import {
    Copy,
    Check,
    ToggleLeft,
    ToggleRight,
    ExternalLink,
    MousePointer,
    Pencil,
    Facebook,
    CopyPlus,
    Loader2,
    MoreHorizontal,
    BarChart2,
    Trash2,
    Tag,
    QrCode,
    Archive,
    ArchiveRestore,
    TrendingUp,
    Clock,
} from 'lucide-react';
import {formatDateTimeVN, toDateTimeLocalVN} from '@/lib/utils';
import QRCodeModal from '@/components/QRCodeModal';

interface Domain {
    id: string;
    domain: string;
    verified: boolean;
}

interface Category {
    id: string;
    name: string;
    color: string;
    _count?: {links: number};
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
    category: Category | null;
    ogScheduledDisableAt: string | null;
    clickResetAt: string | null;
    folderRotationStartDate: string | null;
    _count: {clicks: number};
    clickTrend24h?: {current: number; previous: number; delta: number};
}

interface Props {
    link: Link;
    baseUrl: string;
    onDelete: (id: string) => void;
    onToggle: (id: string, isActive: boolean) => void;
    onToggleMeta: (id: string, ogEnabled: boolean) => void;
    onEdit: (link: Link) => void;
    onDuplicate: (link: Link) => void;
    onStats: (link: Link) => void;
    onArchive: (id: string, isArchived: boolean) => void;
    onTitleUpdate?: (id: string, title: string | null) => void;
    onFieldUpdate?: (id: string, fields: Partial<Link>) => void;
}

export default function LinkRow({
    link,
    baseUrl,
    onDelete,
    onToggle,
    onToggleMeta,
    onEdit,
    onDuplicate,
    onStats,
    onArchive,
    onTitleUpdate,
    onFieldUpdate,
}: Props) {
    const [copied, setCopied] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [togglingMeta, setTogglingMeta] = useState(false);
    const [duplicating, setDuplicating] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({top: 0, right: 0});
    const [showQR, setShowQR] = useState(false);
    const menuBtnRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState(link.title || '');
    const [savingTitle, setSavingTitle] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);

    const [showScheduler, setShowScheduler] = useState(false);
    const scheduledAt = link.ogScheduledDisableAt || link.clickResetAt;
    const [scheduleDraft, setScheduleDraft] = useState(
        scheduledAt ? toDateTimeLocalVN(new Date(scheduledAt)) : ''
    );
    const [savingSchedule, setSavingSchedule] = useState(false);

    const shortUrl = link.domain
        ? `https://${link.domain.domain}/${link.shortCode}`
        : link.sharedDomain
          ? `https://${link.sharedDomain}/${link.shortCode}`
          : `${baseUrl}/${link.shortCode}`;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(shortUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleToggle = async () => {
        setToggling(true);
        await onToggle(link.id, link.isActive);
        setToggling(false);
    };

    const handleToggleMeta = async () => {
        setTogglingMeta(true);
        onToggleMeta(link.id, link.ogEnabled);
        setTogglingMeta(false);
    };

    const startEditTitle = () => {
        setTitleDraft(link.title || '');
        setEditingTitle(true);
        setTimeout(() => titleInputRef.current?.focus(), 30);
    };

    const saveTitle = async () => {
        if (savingTitle) return;
        const newTitle = titleDraft.trim() || null;
        if (newTitle === (link.title || null)) { setEditingTitle(false); return; }
        setSavingTitle(true);
        try {
            await fetch(`/api/links/${link.id}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ title: newTitle }),
            });
            onTitleUpdate?.(link.id, newTitle);
        } catch { /* ignore */ }
        setSavingTitle(false);
        setEditingTitle(false);
    };

    const saveSchedule = async (value: string | null) => {
        setSavingSchedule(true);
        const iso = value ? new Date(value).toISOString() : null;
        try {
            await fetch(`/api/links/${link.id}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ ogScheduledDisableAt: iso, clickResetAt: iso }),
            });
            onFieldUpdate?.(link.id, { ogScheduledDisableAt: iso, clickResetAt: iso });
        } catch { /* ignore */ }
        setSavingSchedule(false);
        setShowScheduler(false);
    };

    const openMenu = () => {
        if (menuBtnRef.current) {
            const rect = menuBtnRef.current.getBoundingClientRect();
            setMenuPos({top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right});
        }
        setMenuOpen((v) => !v);
    };

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                menuBtnRef.current &&
                !menuBtnRef.current.contains(target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(target)
            ) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const hasOg = !!(link.ogTitle || link.ogDescription || link.ogImage);
    const hasScheduledDisable = !!(link.ogScheduledDisableAt && hasOg);
    const scheduledDisableDate = link.ogScheduledDisableAt ? new Date(link.ogScheduledDisableAt) : null;
    const hasClickReset = !!link.clickResetAt;
    const clickResetDate = link.clickResetAt ? new Date(link.clickResetAt) : null;
    const clickLimitReached = link.maxClicks !== null && link._count.clicks >= link.maxClicks;
    const todayIncrease = link.clickTrend24h?.current ?? 0;
    const showTodayIncrease = todayIncrease > 0;
    const increaseColorClass = todayIncrease > 100 ? 'text-sky-600' : 'text-blue-600';

    const toggleBtn = (
        <button
            onClick={handleToggle}
            disabled={toggling}
            title={link.isActive ? 'Tắt link' : 'Bật link'}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50 cursor-pointer ${link.isActive ? 'text-sky-500 bg-sky-50 hover:bg-sky-100' : 'text-gray-400 bg-gray-50 hover:bg-gray-100'}`}
        >
            {toggling ? (
                <Loader2 className="w-6 h-6 animate-spin" />
            ) : link.isActive ? (
                <ToggleRight className="w-6 h-6" />
            ) : (
                <ToggleLeft className="w-6 h-6" />
            )}
        </button>
    );

    const actionButtons = (
        <div className="flex items-center gap-0.5">
            <button
                onClick={() => onEdit(link)}
                title="Sửa link"
                className="p-1.5 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
            >
                <Pencil className="w-4 h-4" />
            </button>
            <button
                onClick={async () => {
                    setDuplicating(true);
                    await onDuplicate(link);
                    setDuplicating(false);
                }}
                disabled={duplicating}
                title="Nhân bản"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
                {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyPlus className="w-4 h-4" />}
            </button>
            <button
                onClick={() =>
                    window.open(
                        `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(shortUrl)}`,
                        '_blank',
                    )
                }
                title="Debug Facebook"
                className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
            >
                <Facebook className="w-4 h-4" />
            </button>
            {hasOg && (
                <button
                    onClick={handleToggleMeta}
                    disabled={togglingMeta}
                    title={
                        hasScheduledDisable
                            ? `Meta tag sẽ tắt lúc ${scheduledDisableDate?.toLocaleString('vi-VN')}`
                            : link.ogEnabled
                              ? 'Tắt meta tag'
                              : 'Bật meta tag'
                    }
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer relative ${
                        link.ogEnabled ? 'text-purple-500 hover:bg-purple-50' : 'text-gray-300 hover:bg-gray-100'
                    }`}
                >
                    {togglingMeta ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <Tag className="w-4 h-4" />
                            {hasScheduledDisable && (
                                <Clock className="w-2.5 h-2.5 text-amber-500 absolute -top-0.5 -right-0.5" />
                            )}
                        </>
                    )}
                </button>
            )}
            <div className="relative">
                <button
                    ref={menuBtnRef}
                    onClick={openMenu}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    title="Thêm"
                >
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    const dropdown =
        menuOpen && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      ref={dropdownRef}
                      style={{position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999}}
                      className="bg-white border border-gray-200 rounded-xl shadow-xl min-w-40 py-1 overflow-hidden"
                  >
                      <button
                          onClick={() => {
                              setMenuOpen(false);
                              onStats(link);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 hover:text-sky-700 transition-colors cursor-pointer"
                      >
                          <BarChart2 className="w-4 h-4 shrink-0" />
                          Thông tin chi tiết
                      </button>
                      <button
                          onClick={() => {
                              setMenuOpen(false);
                              setShowQR(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors cursor-pointer"
                      >
                          <QrCode className="w-4 h-4 shrink-0" />
                          Tạo mã QR
                      </button>
                      <button
                          onClick={() => {
                              setMenuOpen(false);
                              onArchive(link.id, link.isArchived);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                      >
                          {link.isArchived ? (
                              <ArchiveRestore className="w-4 h-4 shrink-0" />
                          ) : (
                              <Archive className="w-4 h-4 shrink-0" />
                          )}
                          {link.isArchived ? 'Bỏ lưu trữ' : 'Lưu trữ'}
                      </button>
                      <div className="h-px bg-gray-100 my-1" />
                      <button
                          onClick={() => {
                              setMenuOpen(false);
                              onDelete(link.id);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                          <Trash2 className="w-4 h-4 shrink-0" />
                          Xóa link
                      </button>
                  </div>,
                  document.body,
              )
            : null;

    return (
        <>
            {dropdown}
            {showQR && (
                <QRCodeModal
                    url={shortUrl}
                    title={link.title}
                    onClose={() => setShowQR(false)}
                />
            )}

            {/* ── MOBILE CARD ── */}
            <tr className="lg:hidden">
                <td
                    colSpan={7}
                    className="px-4 py-3"
                >
                    <div className="bg-white border border-gray-100 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3 overflow-hidden">
                        <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                {toggleBtn}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                                        <a
                                            href={shortUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm font-semibold text-sky-600 hover:underline flex items-center gap-1 min-w-0 flex-1 overflow-hidden"
                                        >
                                            <span className="truncate">{shortUrl.replace('https://', '').replace('http://', '')}</span>
                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                        </a>
                                        <button
                                            onClick={handleCopy}
                                            className="p-0.5 text-gray-400 hover:text-gray-600 rounded shrink-0 cursor-pointer"
                                        >
                                            {copied ? (
                                                <Check className="w-3.5 h-3.5 text-sky-500" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                    {editingTitle ? (
                                        <input
                                            ref={titleInputRef}
                                            value={titleDraft}
                                            onChange={e => setTitleDraft(e.target.value)}
                                            onBlur={saveTitle}
                                            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                                            disabled={savingTitle}
                                            placeholder="Nhập tiêu đề..."
                                            className="w-full mt-0.5 px-2 py-0.5 text-xs border border-sky-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-400"
                                        />
                                    ) : (
                                        <div onClick={startEditTitle} className="text-xs text-gray-400 mt-0.5 truncate cursor-text hover:text-sky-500">
                                            {link.title || <span className="italic">Chưa có tiêu đề</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span
                                className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${link.isActive ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full mr-1 ${link.isActive ? 'bg-sky-500' : 'bg-gray-400'}`}
                                />
                                {link.isActive ? 'Hoạt động' : 'Tắt'}
                            </span>
                        </div>
                        {link.category && (
                            <div className="flex items-center gap-1">
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{backgroundColor: link.category.color}}
                                />
                                <span className="text-xs text-gray-500 truncate">{link.category.name}</span>
                            </div>
                        )}
                        <div
                            className="text-xs text-gray-500 truncate"
                            title={link.originalUrl}
                        >
                            {link.originalUrl}
                        </div>
                        {link.maxClicks !== null && (
                            <div className="flex items-center gap-1.5">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full transition-all ${clickLimitReached ? 'bg-red-500' : 'bg-sky-500'}`}
                                        style={{
                                            width: `${Math.min((link._count.clicks / link.maxClicks) * 100, 100)}%`,
                                        }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500 shrink-0">
                                    {link._count.clicks}/{link.maxClicks}
                                </span>
                            </div>
                        )}
                        {scheduledAt && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-100 rounded-lg">
                                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="text-xs text-amber-700 font-medium">
                                    Hẹn lúc:{' '}
                                    {new Date(scheduledAt).toLocaleString('vi-VN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </div>
                        )}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 min-w-0">
                                <span className="flex items-center gap-1">
                                    <MousePointer className="w-3.5 h-3.5" />
                                    <span className="font-medium text-gray-700">
                                        {link._count.clicks.toLocaleString()}
                                    </span>
                                    {showTodayIncrease && (
                                        <span className={`inline-flex items-center gap-1 ${increaseColorClass}`}>
                                            <TrendingUp className="w-3.5 h-3.5" />+{todayIncrease.toLocaleString()}
                                        </span>
                                    )}
                                    clicks
                                </span>
                                <span>{formatDateTimeVN(new Date(link.createdAt))}</span>
                            </div>
                            <div className="shrink-0">{actionButtons}</div>
                        </div>
                    </div>
                </td>
            </tr>

            {/* ── DESKTOP TABLE ROW ── */}
            <tr className="hidden lg:table-row hover:bg-gray-50/80 transition-colors">
                <td className="pl-4 pr-2 py-4 align-top">{toggleBtn}</td>
                <td className="px-4 py-4 max-w-64">
                    {/* Title — click to edit inline */}
                    {editingTitle ? (
                        <input
                            ref={titleInputRef}
                            value={titleDraft}
                            onChange={e => setTitleDraft(e.target.value)}
                            onBlur={saveTitle}
                            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                            disabled={savingTitle}
                            placeholder="Nhập tiêu đề..."
                            className="w-full mb-1 px-2 py-0.5 text-sm border border-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                    ) : (
                        <div
                            onClick={startEditTitle}
                            title="Click để sửa tiêu đề"
                            className="text-sm font-medium text-gray-700 truncate mb-1 cursor-text hover:text-sky-600 max-w-60 group flex items-center gap-1"
                        >
                            <span className="truncate">{link.title || <span className="text-gray-300 font-normal italic">Chưa có tiêu đề</span>}</span>
                            <Pencil className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                        </div>
                    )}
                    {/* Short link */}
                    <div className="flex items-center gap-1">
                        <a
                            href={shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-sky-600 hover:text-sky-700 hover:underline break-all leading-snug flex items-center gap-0.5 min-w-0"
                        >
                            <span className="truncate">{shortUrl.replace('https://', '').replace('http://', '')}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        <button
                            onClick={handleCopy}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors shrink-0 cursor-pointer"
                            title="Sao chép link"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-sky-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                    {/* Created date */}
                    <div className="text-xs text-gray-400 mt-1">{formatDateTimeVN(new Date(link.createdAt))}</div>
                    {/* Category + badges */}
                    {link.category && (
                        <div className="flex items-center gap-1 mt-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: link.category.color}} />
                            <span className="text-xs text-gray-400 truncate max-w-32">{link.category.name}</span>
                        </div>
                    )}
                    {scheduledAt && (
                        <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                                Hẹn lúc: {new Date(scheduledAt).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric'})}
                            </span>
                        </div>
                    )}
                    {/* Quick schedule button */}
                    <div className="relative mt-2">
                        <button
                            onClick={() => { setScheduleDraft(scheduledAt ? toDateTimeLocalVN(new Date(scheduledAt)) : ''); setShowScheduler(v => !v); }}
                            title={scheduledAt ? 'Sửa lịch hẹn giờ' : 'Hẹn giờ tắt OG + reset click'}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border transition-colors cursor-pointer ${scheduledAt ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-500'}`}
                        >
                            <Clock className="w-3 h-3" />
                            <span>Hẹn giờ</span>
                        </button>
                        {showScheduler && (
                            <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-64">
                                <div className="text-xs text-gray-500 mb-2 leading-relaxed">
                                    Tắt meta tag → FB debug → reset click về 0
                                </div>
                                <input
                                    type="datetime-local"
                                    value={scheduleDraft}
                                    onChange={e => setScheduleDraft(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 mb-2"
                                    autoFocus
                                />
                                <div className="flex gap-1.5">
                                    <button onClick={() => saveSchedule(scheduleDraft || null)} disabled={savingSchedule || !scheduleDraft} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs py-1.5 rounded-lg disabled:opacity-50 cursor-pointer">Lưu</button>
                                    {scheduledAt && <button onClick={() => saveSchedule(null)} disabled={savingSchedule} className="px-2 py-1.5 text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg cursor-pointer">Xóa</button>}
                                    <button onClick={() => setShowScheduler(false)} className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg cursor-pointer">Hủy</button>
                                </div>
                            </div>
                        )}
                    </div>
                </td>
                <td className="px-4 py-4">
                    <div
                        className="text-sm text-gray-600 truncate max-w-52"
                        title={link.originalUrl}
                    >
                        {link.originalUrl}
                    </div>
                </td>
                <td className="px-4 py-4">
                    <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                            <MousePointer className="w-3.5 h-3.5 text-gray-400" />
                            {link._count.clicks.toLocaleString()}
                            {showTodayIncrease && (
                                <span
                                    className={`inline-flex items-center gap-1 text-xs font-medium ${increaseColorClass}`}
                                >
                                    <TrendingUp className="w-3.5 h-3.5" />+{todayIncrease.toLocaleString()}
                                </span>
                            )}
                            {link.maxClicks !== null && (
                                <span
                                    className={`text-xs font-normal ${clickLimitReached ? 'text-red-500' : 'text-gray-400'}`}
                                >
                                    /{link.maxClicks}
                                </span>
                            )}
                        </span>
                        {link.maxClicks !== null && (
                            <div className="w-20 bg-gray-100 rounded-full h-1">
                                <div
                                    className={`h-1 rounded-full ${clickLimitReached ? 'bg-red-500' : 'bg-sky-500'}`}
                                    style={{width: `${Math.min((link._count.clicks / link.maxClicks) * 100, 100)}%`}}
                                />
                            </div>
                        )}
                    </div>
                </td>
                <td className="px-4 py-4">
                    <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${link.isActive ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${link.isActive ? 'bg-sky-500' : 'bg-gray-400'}`}
                        />
                        {link.isActive ? 'Hoạt động' : 'Tắt'}
                    </span>
                </td>
                <td className="px-4 py-4">{actionButtons}</td>
            </tr>
        </>
    );
}
