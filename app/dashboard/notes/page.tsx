'use client';

import {useState, useEffect, useCallback, useRef} from 'react';
import {useRouter} from 'next/navigation';
import {apiFetch} from '@/lib/fetch';
import {
    Plus,
    Trash2,
    X,
    Save,
    FileText,
    Search,
    Share2,
    Users,
    Star,
    Copy,
    Check,
    PanelLeftClose,
    PanelLeftOpen,
    Pin,
    MoreHorizontal,
    Download,
    CheckSquare,
    HardDrive,
    CloudOff,
    Loader2,
    Folder,
    FolderPlus,
    FolderOpen,
    Move,
} from 'lucide-react';
import {formatDistanceToNow} from 'date-fns';
import {vi} from 'date-fns/locale';
import dynamic from 'next/dynamic';
import JSZip from 'jszip';
import {formatDateKeyVN} from '@/lib/utils';

import {parseNoteContent, getContentPreview} from '@/lib/note-content';

const NoteShareModal = dynamic(() => import('@/components/NoteShareModal'), {ssr: false});
const NoteBlockEditor = dynamic(() => import('@/components/NoteBlockEditor'), {ssr: false});

interface NoteFolder {
    id: string;
    name: string;
    color: string;
    _count: {notes: number};
}

interface Note {
    id: string;
    title: string;
    contentPreview: string; // always available (first 200 chars)
    content?: string; // only loaded when editing
    starred: boolean;
    pinned: boolean;
    folderId?: string | null;
    folder?: {id: string; name: string; color: string} | null;
    createdAt: string;
    updatedAt: string;
    shareId?: string;
    permission?: string;
    ownerName?: string;
    // my-shared tab fields
    isPublic?: boolean;
    publicToken?: string | null;
    sharesCount?: number;
    sharedWith?: {id: string; permission: string; name: string; email: string}[];
}

type Tab = 'mine' | 'shared' | 'my-shared';

export default function NotesPage() {
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('mine');
    const [notes, setNotes] = useState<Note[]>([]);
    const [sharedNotes, setSharedNotes] = useState<Note[]>([]);
    const [mySharedNotes, setMySharedNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [notesTotal, setNotesTotal] = useState(0);
    const [allNotesTotal, setAllNotesTotal] = useState(0);
    const [sharedTotal, setSharedTotal] = useState(0);
    const [mySharedTotal, setMySharedTotal] = useState(0);

    // Lazy content loading
    const [loadingContent, setLoadingContent] = useState(false);
    const loadingNoteRef = useRef<string | null>(null);

    // Folders
    const [folders, setFolders] = useState<NoteFolder[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [moveDropdownId, setMoveDropdownId] = useState<string | null>(null);

    // Editor state
    const [activeNote, setActiveNote] = useState<Note | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sidebarHidden, setSidebarHidden] = useState(false);

    // New note modal
    const [showNew, setShowNew] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newNoteFolderId, setNewNoteFolderId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // Share modal
    const [shareNote, setShareNote] = useState<Note | null>(null);

    // Multi-select & export
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [exporting, setExporting] = useState(false);

    // Google Drive
    const [driveConnected, setDriveConnected] = useState(false);
    const [driveEmail, setDriveEmail] = useState<string | null>(null);
    const [driveLoading, setDriveLoading] = useState(false);

    // Format dropdown
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                ...(debouncedSearch ? {search: debouncedSearch} : {}),
                ...(activeFolderId ? {folderId: activeFolderId} : {}),
            });

            const [mineRes, sharedRes, mySharedRes] = await Promise.all([
                apiFetch(`/api/notes?${params}`),
                apiFetch('/api/notes/shared'),
                apiFetch('/api/notes/my-shared'),
            ]);
            const [mineData, sharedData, mySharedData] = await Promise.all([
                mineRes.json(),
                sharedRes.json(),
                mySharedRes.json(),
            ]);
            setNotes(Array.isArray(mineData.notes) ? mineData.notes : []);
            setNotesTotal(mineData.total ?? 0);
            if (!activeFolderId) setAllNotesTotal(mineData.total ?? 0);
            setSharedNotes(Array.isArray(sharedData.notes) ? sharedData.notes : []);
            setSharedTotal(sharedData.total ?? 0);
            setMySharedNotes(Array.isArray(mySharedData.notes) ? mySharedData.notes : []);
            setMySharedTotal(mySharedData.total ?? 0);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, activeFolderId]);

    const fetchFolders = useCallback(async () => {
        const res = await apiFetch('/api/note-folders');
        if (res.ok) {
            const data = await res.json();
            setFolders(Array.isArray(data) ? data : []);
        }
    }, []);

    const fetchDriveStatus = useCallback(async () => {
        try {
            const res = await apiFetch('/api/drive/status');
            if (res.ok) {
                const data = await res.json();
                setDriveConnected(data.connected);
                setDriveEmail(data.email);
            }
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);
    useEffect(() => {
        fetchFolders();
    }, [fetchFolders]);
    useEffect(() => {
        fetchDriveStatus();
    }, [fetchDriveStatus]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const drive = params.get('drive');
        if (drive === 'connected') {
            fetchDriveStatus();
            router.replace('/dashboard/notes');
        } else if (drive === 'error' || drive === 'no_refresh_token') {
            router.replace('/dashboard/notes');
        }
    }, [fetchDriveStatus, router]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
    };

    const currentList = tab === 'mine' ? notes : tab === 'shared' ? sharedNotes : mySharedNotes;

    // Mine tab: server handles filtering/sorting; shared tabs: client-side search on preview
    const filtered =
        tab === 'mine'
            ? notes
            : currentList.filter(
                  (n) =>
                      !search ||
                      n.title.toLowerCase().includes(search.toLowerCase()) ||
                      (n.contentPreview || '').toLowerCase().includes(search.toLowerCase()),
              );

    const openNote = async (note: Note) => {
        if (activeNote?.id === note.id) {
            closeEditor();
            return;
        }
        setDirty(false);
        setSidebarHidden(false);

        if (note.content !== undefined) {
            setActiveNote(note);
            setEditTitle(note.title);
            setEditContent(note.content);
        } else {
            loadingNoteRef.current = note.id;
            setActiveNote({...note});
            setEditTitle(note.title);
            setEditContent('');
            setLoadingContent(true);
            try {
                const res = await apiFetch(`/api/notes/${note.id}`);
                if (res.ok && loadingNoteRef.current === note.id) {
                    const full = await res.json();
                    const content = full.content || '';
                    const updated = {...note, content};
                    setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
                    setSharedNotes((prev) => prev.map((n) => (n.id === note.id ? {...n, content} : n)));
                    setMySharedNotes((prev) => prev.map((n) => (n.id === note.id ? {...n, content} : n)));
                    setActiveNote(updated);
                    setEditContent(content);
                }
            } finally {
                if (loadingNoteRef.current === note.id) {
                    setLoadingContent(false);
                    loadingNoteRef.current = null;
                }
            }
        }
    };

    const closeEditor = () => {
        setActiveNote(null);
        setDirty(false);
        setSidebarHidden(false);
        setLoadingContent(false);
        loadingNoteRef.current = null;
    };

    const isReadOnly = activeNote?.permission === 'viewer';

    const handleSave = async () => {
        if (!activeNote || isReadOnly) return;
        setSaving(true);
        const res = await apiFetch(`/api/notes/${activeNote.id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title: editTitle, content: editContent}),
        });
        if (res.ok) {
            const updated = await res.json();
            const contentPreview = getContentPreview(updated.content || '', 200);
            if (activeNote.shareId) {
                setSharedNotes((prev) =>
                    prev.map((n) =>
                        n.id === updated.id
                            ? {...n, title: updated.title, updatedAt: updated.updatedAt, contentPreview}
                            : n,
                    ),
                );
            } else {
                setNotes((prev) =>
                    prev.map((n) =>
                        n.id === updated.id
                            ? {
                                  ...n,
                                  title: updated.title,
                                  updatedAt: updated.updatedAt,
                                  contentPreview,
                                  content: updated.content,
                              }
                            : n,
                    ),
                );
                setMySharedNotes((prev) =>
                    prev.map((n) =>
                        n.id === updated.id
                            ? {...n, title: updated.title, updatedAt: updated.updatedAt, contentPreview}
                            : n,
                    ),
                );
            }
            setActiveNote((prev) =>
                prev
                    ? {...prev, title: updated.title, content: updated.content || '', updatedAt: updated.updatedAt}
                    : prev,
            );
            setDirty(false);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Xoá ghi chú này?')) return;
        await apiFetch(`/api/notes/${id}`, {method: 'DELETE'});
        setNotes((prev) => prev.filter((n) => n.id !== id));
        setNotesTotal((prev) => Math.max(0, prev - 1));
        if (activeNote?.id === id) closeEditor();
    };

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        setCreating(true);
        const res = await apiFetch('/api/notes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title: newTitle, content: newContent, folderId: newNoteFolderId}),
        });
        if (res.ok) {
            const note = await res.json();
            const noteWithPreview = {
                ...note,
                contentPreview: getContentPreview(note.content || '', 200),
            };
            setNotes((prev) => [noteWithPreview, ...prev]);
            setNotesTotal((prev) => prev + 1);
            await fetchFolders();
            setTab('mine');
            setShowNew(false);
            setNewTitle('');
            setNewContent('');
            setNewNoteFolderId(null);
            openNote(noteWithPreview);
        }
        setCreating(false);
    };

    const handleToggleStar = async (e: React.MouseEvent, note: Note) => {
        e.stopPropagation();
        const newStarred = !note.starred;
        setNotes((prev) => prev.map((n) => (n.id === note.id ? {...n, starred: newStarred} : n)));
        setMySharedNotes((prev) => prev.map((n) => (n.id === note.id ? {...n, starred: newStarred} : n)));
        if (activeNote?.id === note.id) setActiveNote((prev) => (prev ? {...prev, starred: newStarred} : prev));
        await apiFetch(`/api/notes/${note.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({starred: newStarred}),
        });
    };

    const handleTogglePin = async (e: React.MouseEvent, note: Note) => {
        e.stopPropagation();
        const newPinned = !note.pinned;
        setNotes((prev) => prev.map((n) => (n.id === note.id ? {...n, pinned: newPinned} : n)));
        setMySharedNotes((prev) => prev.map((n) => (n.id === note.id ? {...n, pinned: newPinned} : n)));
        if (activeNote?.id === note.id) setActiveNote((prev) => (prev ? {...prev, pinned: newPinned} : prev));
        await apiFetch(`/api/notes/${note.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({pinned: newPinned}),
        });
    };

    const handleMoveToFolder = async (e: React.MouseEvent, note: Note, folderId: string | null) => {
        e.stopPropagation();
        setMoveDropdownId(null);
        const res = await apiFetch(`/api/notes/${note.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({folderId}),
        });
        if (res.ok) {
            const folderObj = folderId ? (folders.find((f) => f.id === folderId) ?? null) : null;
            setNotes((prev) =>
                prev.map((n) =>
                    n.id === note.id
                        ? {
                              ...n,
                              folderId,
                              folder: folderObj
                                  ? {id: folderObj.id, name: folderObj.name, color: folderObj.color}
                                  : null,
                          }
                        : n,
                ),
            );
            if (activeNote?.id === note.id) {
                setActiveNote((prev) =>
                    prev
                        ? {
                              ...prev,
                              folderId,
                              folder: folderObj
                                  ? {id: folderObj.id, name: folderObj.name, color: folderObj.color}
                                  : null,
                          }
                        : prev,
                );
            }
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        setCreatingFolder(true);
        const res = await apiFetch('/api/note-folders', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: newFolderName.trim()}),
        });
        if (res.ok) {
            const folder = await res.json();
            setFolders((prev) => [...prev, folder]);
            setShowNewFolder(false);
            setNewFolderName('');
        }
        setCreatingFolder(false);
    };

    const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Xoá thư mục? Các ghi chú bên trong sẽ chuyển về Tất cả.')) return;
        await apiFetch(`/api/note-folders/${id}`, {method: 'DELETE'});
        setFolders((prev) => prev.filter((f) => f.id !== id));
        setNotes((prev) => prev.map((n) => (n.folderId === id ? {...n, folderId: null, folder: null} : n)));
        if (activeFolderId === id) setActiveFolderId(null);
    };

    const handleCopy = async () => {
        const blocks = parseNoteContent(editContent);
        let text = '';
        for (const block of blocks) {
            if (block.type === 'text') {
                text += block.content + '\n';
            } else if (block.type === 'table') {
                for (const row of block.rows) {
                    text += row.join('\t') + '\n';
                }
                text += '\n';
            }
        }
        await navigator.clipboard.writeText(text.trimEnd());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleNoteClick = (e: React.MouseEvent, note: Note) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(note.id)) next.delete(note.id);
                else next.add(note.id);
                return next;
            });
            return;
        }
        openNote(note);
    };

    const handleSelectAll = () => setSelectedIds(new Set(filtered.map((n) => n.id)));
    const handleClearSelection = () => setSelectedIds(new Set());

    const handleExport = async () => {
        const toExport = filtered.filter((n) => selectedIds.has(n.id));
        if (!toExport.length) return;
        setExporting(true);
        const zip = new JSZip();

        await Promise.all(
            toExport.map(async (note) => {
                let content = note.content;
                if (content === undefined) {
                    try {
                        const res = await apiFetch(`/api/notes/${note.id}`);
                        if (res.ok) {
                            const full = await res.json();
                            content = full.content || '';
                        }
                    } catch {
                        /* ignore */
                    }
                }
                const safeName = note.title.replace(/[/\\?%*:|"<>]/g, '-') || 'ghi-chu';
                const blocks = parseNoteContent(content || '');
                let exportText = `${note.title}\n${'='.repeat(note.title.length)}\n\n`;
                for (const block of blocks) {
                    if (block.type === 'text') {
                        exportText += block.content + '\n\n';
                    } else if (block.type === 'table') {
                        for (const row of block.rows) {
                            exportText += row.join('\t') + '\n';
                        }
                        exportText += '\n';
                    }
                }
                zip.file(`${safeName}.txt`, exportText.trimEnd());
            }),
        );

        const blob = await zip.generateAsync({type: 'blob'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ghi-chu-${formatDateKeyVN(new Date())}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setExporting(false);
    };

    const handleConnectDrive = async () => {
        setDriveLoading(true);
        try {
            const res = await apiFetch('/api/drive/connect');
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch {
            /* ignore */
        }
        setDriveLoading(false);
    };

    const handleDisconnectDrive = async () => {
        if (!confirm('Ngắt kết nối Google Drive? Các file đã sync sẽ vẫn còn trong Drive của bạn.')) return;
        setDriveLoading(true);
        await apiFetch('/api/drive/disconnect', {method: 'DELETE'});
        setDriveConnected(false);
        setDriveEmail(null);
        setDriveLoading(false);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
            if (moveDropdownId && !(e.target as HTMLElement).closest('[data-move-dropdown]')) {
                setMoveDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown, moveDropdownId]);

    const showSidebar = !sidebarHidden || !activeNote;

    // Note card for grid view
    const NoteCard = ({note, compact = false}: {note: Note; compact?: boolean}) => (
        <div
            key={note.shareId || note.id}
            onClick={(e) => handleNoteClick(e, note)}
            className={`group relative bg-white border rounded-xl cursor-pointer transition-all hover:shadow-sm ${compact ? 'p-3' : 'p-4'} ${
                selectedIds.has(note.id)
                    ? 'border-sky-500 ring-1 ring-sky-500 bg-sky-50'
                    : activeNote?.id === note.id
                      ? 'border-sky-500 ring-1 ring-sky-500'
                      : 'border-gray-200 hover:border-gray-300'
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {note.pinned && (
                        <Pin
                            className="w-3 h-3 text-sky-500 shrink-0"
                            fill="currentColor"
                        />
                    )}
                    {compact && note.starred && (
                        <Star
                            className="w-3 h-3 text-yellow-400 shrink-0"
                            fill="currentColor"
                        />
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{note.title}</h3>
                </div>
                {!compact && (
                    <div className="flex items-center gap-1 shrink-0">
                        {(tab === 'mine' || tab === 'my-shared') && (
                            <>
                                <button
                                    onClick={(e) => handleTogglePin(e, note)}
                                    className={`p-1 rounded-lg transition-all cursor-pointer ${note.pinned ? 'text-sky-500 hover:text-sky-600' : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-sky-400'}`}
                                    title={note.pinned ? 'Bỏ ghim' : 'Ghim'}
                                >
                                    <Pin
                                        className="w-3.5 h-3.5"
                                        fill={note.pinned ? 'currentColor' : 'none'}
                                    />
                                </button>
                                <button
                                    onClick={(e) => handleToggleStar(e, note)}
                                    className={`p-1 rounded-lg transition-all cursor-pointer ${note.starred ? 'text-yellow-400 hover:text-yellow-500' : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-yellow-400'}`}
                                >
                                    <Star
                                        className="w-3.5 h-3.5"
                                        fill={note.starred ? 'currentColor' : 'none'}
                                    />
                                </button>
                                <div
                                    className="relative"
                                    data-move-dropdown
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMoveDropdownId(moveDropdownId === note.id ? null : note.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-indigo-500 rounded-lg transition-all cursor-pointer"
                                        title="Chuyển thư mục"
                                    >
                                        <Move className="w-3.5 h-3.5" />
                                    </button>
                                    {moveDropdownId === note.id && (
                                        <div
                                            className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden"
                                            data-move-dropdown
                                        >
                                            <p className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
                                                Chuyển vào
                                            </p>
                                            <button
                                                onClick={(e) => handleMoveToFolder(e, note, null)}
                                                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer ${!note.folderId ? 'font-semibold text-sky-600' : ''}`}
                                            >
                                                <FileText className="w-3.5 h-3.5 text-gray-400" />
                                                Tất cả (bỏ thư mục)
                                            </button>
                                            {folders.map((f) => (
                                                <button
                                                    key={f.id}
                                                    onClick={(e) => handleMoveToFolder(e, note, f.id)}
                                                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer ${note.folderId === f.id ? 'font-semibold text-sky-600' : ''}`}
                                                >
                                                    <Folder
                                                        className="w-3.5 h-3.5"
                                                        style={{color: f.color}}
                                                    />
                                                    {f.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(note.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded-lg transition-all cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                        {tab === 'shared' && (
                            <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full ${note.permission === 'admin' ? 'bg-sky-50 text-sky-600' : 'bg-gray-100 text-gray-500'}`}
                            >
                                {note.permission === 'admin' ? 'Sửa' : 'Xem'}
                            </span>
                        )}
                        {tab === 'my-shared' && (
                            <div className="flex items-center gap-1">
                                {note.isPublic && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600">
                                        Link
                                    </span>
                                )}
                                {(note.sharesCount ?? 0) > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">
                                        {note.sharesCount} người
                                    </span>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShareNote(note);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-sky-500 rounded-lg transition-all cursor-pointer"
                                    title="Quản lý chia sẻ"
                                >
                                    <Share2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <p
                className={`text-xs text-gray-500 mt-1.5 whitespace-pre-line ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}
            >
                {note.contentPreview || 'Không có nội dung'}
            </p>
            <div className="flex items-center justify-between mt-2 gap-2">
                <p className="text-[10px] text-gray-400">
                    {formatDistanceToNow(new Date(note.updatedAt), {addSuffix: true, locale: vi})}
                </p>
                {!compact && (
                    <div className="flex items-center gap-1.5">
                        {note.folder && (
                            <span
                                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{backgroundColor: note.folder.color + '20', color: note.folder.color}}
                            >
                                <Folder className="w-2.5 h-2.5" />
                                {note.folder.name}
                            </span>
                        )}
                        {note.ownerName && <p className="text-[10px] text-gray-400">bởi {note.ownerName}</p>}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl font-bold text-gray-900">Ghi chú</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{allNotesTotal} ghi chú của tôi</p>
                </div>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                    {/* Drive compact badge */}
                    {driveConnected ? (
                        <div
                            title={`Google Drive: ${driveEmail} — Ghi chú tự động đồng bộ khi tạo/sửa/xóa`}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-700"
                        >
                            <HardDrive className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="hidden md:inline max-w-[140px] truncate">{driveEmail}</span>
                            <button
                                onClick={handleDisconnectDrive}
                                disabled={driveLoading}
                                title="Ngắt kết nối Google Drive"
                                className="ml-0.5 text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                            >
                                {driveLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <CloudOff className="w-3 h-3" />
                                )}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleConnectDrive}
                            disabled={driveLoading}
                            title="Kết nối Google Drive để tự động backup ghi chú lên cloud"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 rounded-xl transition-colors cursor-pointer"
                        >
                            {driveLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <HardDrive className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">Backup Drive</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowNew(true)}
                        className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-3 sm:px-4 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Tạo ghi chú</span>
                    </button>
                </div>
            </div>

            {/* Tabs + Search on same row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div
                    className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto shrink-0"
                    style={{scrollbarWidth: 'none'}}
                >
                    <button
                        onClick={() => {
                            setTab('mine');
                            setActiveNote(null);
                            setSidebarHidden(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${tab === 'mine' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>Của tôi</span>
                        {allNotesTotal > 0 && (
                            <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'mine' ? 'bg-sky-100 text-sky-700' : 'bg-gray-200 text-gray-500'}`}
                            >
                                {allNotesTotal}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setTab('shared');
                            setActiveNote(null);
                            setSidebarHidden(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${tab === 'shared' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        Được chia sẻ
                        {sharedTotal > 0 && (
                            <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'shared' ? 'bg-sky-100 text-sky-700' : 'bg-gray-200 text-gray-500'}`}
                            >
                                {sharedTotal}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setTab('my-shared');
                            setActiveNote(null);
                            setSidebarHidden(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${tab === 'my-shared' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Share2 className="w-3.5 h-3.5 shrink-0" />
                        Đã chia sẻ
                        {mySharedTotal > 0 && (
                            <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'my-shared' ? 'bg-sky-100 text-sky-700' : 'bg-gray-200 text-gray-500'}`}
                            >
                                {mySharedTotal}
                            </span>
                        )}
                    </button>
                </div>
                <div className="flex-1 min-w-0 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 min-h-0 flex flex-col gap-3 pt-[2px]">
                {/* Folders: horizontal scrollable strip - always visible */}
                {tab === 'mine' && (
                    <div
                        className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0"
                        style={{scrollbarWidth: 'none'}}
                    >
                        <button
                            onClick={() => setActiveFolderId(null)}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                                activeFolderId === null
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Tất cả
                            <span className={activeFolderId === null ? 'opacity-70' : 'text-gray-400'}>
                                {allNotesTotal}
                            </span>
                        </button>

                        {folders.map((folder) => (
                            <div
                                key={folder.id}
                                className="group shrink-0 relative"
                            >
                                <button
                                    onClick={() => setActiveFolderId(folder.id)}
                                    className={`flex items-center gap-1.5 pl-3 pr-7 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                                        activeFolderId === folder.id
                                            ? 'bg-sky-600 text-white'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                                >
                                    {activeFolderId === folder.id ? (
                                        <FolderOpen className="w-3.5 h-3.5 shrink-0 text-white" />
                                    ) : (
                                        <Folder
                                            className="w-3.5 h-3.5 shrink-0"
                                            style={{color: folder.color}}
                                        />
                                    )}
                                    <span className="max-w-[100px] truncate">{folder.name}</span>
                                    <span className={activeFolderId === folder.id ? 'opacity-70' : 'text-gray-400'}>
                                        {folder._count.notes}
                                    </span>
                                </button>
                                <button
                                    onClick={(e) => handleDeleteFolder(e, folder.id)}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-500 transition-all cursor-pointer"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {showNewFolder ? (
                            <div className="shrink-0 flex items-center gap-1">
                                <input
                                    autoFocus
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateFolder();
                                        if (e.key === 'Escape') {
                                            setShowNewFolder(false);
                                            setNewFolderName('');
                                        }
                                    }}
                                    placeholder="Tên thư mục..."
                                    className="text-xs px-2.5 py-1.5 border border-sky-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 w-32 bg-white"
                                />
                                <button
                                    onClick={handleCreateFolder}
                                    disabled={!newFolderName.trim() || creatingFolder}
                                    className="text-xs bg-sky-600 text-white px-2.5 py-1.5 rounded-xl disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer"
                                >
                                    {creatingFolder ? '...' : 'Tạo'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowNewFolder(false);
                                        setNewFolderName('');
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowNewFolder(true)}
                                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-sky-600 border border-dashed border-gray-200 hover:border-sky-300 rounded-xl transition-colors cursor-pointer"
                            >
                                <FolderPlus className="w-3.5 h-3.5" />
                                Thêm
                            </button>
                        )}
                    </div>
                )}

                <div className="flex-1 min-h-0">
                    {!activeNote ? (
                        /* ===================== GRID VIEW (no note selected) ===================== */
                        <div className="h-full overflow-y-auto">
                            {loading ? (
                                <div className="text-center text-gray-400 py-16 text-sm">Đang tải...</div>
                            ) : filtered.length === 0 ? (
                                <div className="text-center py-16">
                                    <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm">
                                        {search
                                            ? 'Không tìm thấy ghi chú nào'
                                            : tab === 'shared'
                                              ? 'Chưa có ghi chú được chia sẻ với bạn'
                                              : tab === 'my-shared'
                                                ? 'Bạn chưa chia sẻ ghi chú nào'
                                                : 'Chưa có ghi chú nào'}
                                    </p>
                                    {!search && tab === 'mine' && (
                                        <button
                                            onClick={() => setShowNew(true)}
                                            className="mt-3 text-sky-600 text-sm hover:underline cursor-pointer"
                                        >
                                            Tạo ghi chú đầu tiên
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedIds.size >= 1 && (
                                        <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
                                            <span className="text-xs text-sky-700 font-medium flex-1">
                                                Đã chọn {selectedIds.size}
                                            </span>
                                            {selectedIds.size >= 2 && (
                                                <button
                                                    onClick={handleSelectAll}
                                                    className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 cursor-pointer"
                                                >
                                                    <CheckSquare className="w-3.5 h-3.5" />
                                                    Chọn tất cả
                                                </button>
                                            )}
                                            <button
                                                onClick={handleExport}
                                                disabled={exporting}
                                                className="flex items-center gap-1 text-xs bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                {exporting ? 'Đang xuất...' : 'Xuất ZIP'}
                                            </button>
                                            <button
                                                onClick={handleClearSelection}
                                                className="p-1 text-sky-400 hover:text-sky-700 cursor-pointer"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {filtered.map((note) => (
                                            <NoteCard
                                                key={note.shareId || note.id}
                                                note={note}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ===================== SPLIT VIEW (note selected) ===================== */
                        <div className="h-full flex gap-4">
                            {/* Sidebar */}
                            {showSidebar && (
                                <div className="hidden lg:flex flex-col gap-2 w-72 shrink-0 h-full min-h-0">
                                    {/* Notes list in sidebar */}
                                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
                                        {filtered.map((note) => (
                                            <NoteCard
                                                key={note.shareId || note.id}
                                                note={note}
                                                compact
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Editor panel */}
                            <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden min-h-0 h-full">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={closeEditor}
                                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer lg:hidden"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setSidebarHidden((h) => !h)}
                                            className="hidden lg:flex p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                        >
                                            {sidebarHidden ? (
                                                <PanelLeftOpen className="w-4 h-4" />
                                            ) : (
                                                <PanelLeftClose className="w-4 h-4" />
                                            )}
                                        </button>
                                        <span className="hidden lg:block text-xs text-gray-400">
                                            {dirty
                                                ? 'Chưa lưu'
                                                : `Đã lưu ${formatDistanceToNow(new Date(activeNote.updatedAt), {addSuffix: true, locale: vi})}`}
                                        </span>
                                        {isReadOnly && (
                                            <span className="hidden lg:block text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                                Chỉ xem
                                            </span>
                                        )}
                                        {activeNote.folder && (
                                            <span
                                                className="hidden lg:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                                                style={{
                                                    backgroundColor: activeNote.folder.color + '20',
                                                    color: activeNote.folder.color,
                                                }}
                                            >
                                                <Folder className="w-2.5 h-2.5" />
                                                {activeNote.folder.name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 ml-auto">
                                        {!activeNote.shareId && (
                                            <>
                                                <button
                                                    onClick={(e) => handleTogglePin(e, activeNote)}
                                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${activeNote.pinned ? 'text-sky-500 hover:text-sky-600' : 'text-gray-300 hover:text-sky-400 hover:bg-gray-100'}`}
                                                >
                                                    <Pin
                                                        className="w-4 h-4"
                                                        fill={activeNote.pinned ? 'currentColor' : 'none'}
                                                    />
                                                </button>
                                                <button
                                                    onClick={(e) => handleToggleStar(e, activeNote)}
                                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${activeNote.starred ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-100'}`}
                                                >
                                                    <Star
                                                        className="w-4 h-4"
                                                        fill={activeNote.starred ? 'currentColor' : 'none'}
                                                    />
                                                </button>
                                                <button
                                                    onClick={() => setShareNote(activeNote)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Share2 className="w-3.5 h-3.5" />
                                                    Chia sẻ
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(activeNote.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Xoá
                                                </button>
                                            </>
                                        )}
                                        <div
                                            className="relative"
                                            ref={dropdownRef}
                                        >
                                            <button
                                                onClick={() => setShowDropdown((v) => !v)}
                                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                            {showDropdown && (
                                                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                                                    {!activeNote.shareId && folders.length > 0 && (
                                                        <>
                                                            <div className="border-t border-gray-100 my-1" />
                                                            <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wide">
                                                                Chuyển thư mục
                                                            </p>
                                                            <button
                                                                onClick={(e) => handleMoveToFolder(e, activeNote, null)}
                                                                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer ${!activeNote.folderId ? 'text-sky-600 font-semibold' : 'text-gray-700'}`}
                                                            >
                                                                <FileText className="w-3 h-3" />
                                                                Tất cả
                                                            </button>
                                                            {folders.map((f) => (
                                                                <button
                                                                    key={f.id}
                                                                    onClick={(e) =>
                                                                        handleMoveToFolder(e, activeNote, f.id)
                                                                    }
                                                                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer ${activeNote.folderId === f.id ? 'text-sky-600 font-semibold' : 'text-gray-700'}`}
                                                                >
                                                                    <Folder
                                                                        className="w-3 h-3"
                                                                        style={{color: f.color}}
                                                                    />
                                                                    {f.name}
                                                                </button>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {!isReadOnly && (
                                            <button
                                                onClick={handleSave}
                                                disabled={!dirty || saving}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                <Save className="w-3.5 h-3.5" />
                                                {saving ? 'Đang lưu...' : 'Lưu'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="px-6 pt-5 shrink-0">
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => {
                                            if (!isReadOnly) {
                                                setEditTitle(e.target.value);
                                                setDirty(true);
                                            }
                                        }}
                                        readOnly={isReadOnly}
                                        spellCheck={false}
                                        className={`w-full text-xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent ${isReadOnly ? 'cursor-default' : ''}`}
                                        placeholder="Tiêu đề..."
                                    />
                                    {activeNote.ownerName && (
                                        <p className="text-xs text-gray-400 mt-1">bởi {activeNote.ownerName}</p>
                                    )}
                                </div>

                                {loadingContent ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-300">
                                            <Loader2 className="w-8 h-8 animate-spin" />
                                            <span className="text-sm">Đang tải nội dung...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 px-6 py-2 min-h-0 overflow-y-auto">
                                        <NoteBlockEditor
                                            content={editContent}
                                            onChange={(val: string) => {
                                                if (!isReadOnly) {
                                                    setEditContent(val);
                                                    setDirty(true);
                                                }
                                            }}
                                            readOnly={isReadOnly}
                                        />
                                    </div>
                                )}

                                <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-3 shrink-0">
                                    {(() => {
                                        const blocks = parseNoteContent(editContent);
                                        const textBlocks = blocks.filter((b) => b.type === 'text').length;
                                        const tableBlocks = blocks.filter((b) => b.type === 'table').length;
                                        return (
                                            <>
                                                <span className="text-[11px] text-gray-400">{blocks.length} block</span>
                                                {textBlocks > 0 && (
                                                    <>
                                                        <span className="text-[11px] text-gray-300">•</span>
                                                        <span className="text-[11px] text-gray-400">
                                                            {textBlocks} văn bản
                                                        </span>
                                                    </>
                                                )}
                                                {tableBlocks > 0 && (
                                                    <>
                                                        <span className="text-[11px] text-gray-300">•</span>
                                                        <span className="text-[11px] text-gray-400">
                                                            {tableBlocks} bảng
                                                        </span>
                                                    </>
                                                )}
                                            </>
                                        );
                                    })()}
                                    <div className="ml-auto">
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check className="w-3 h-3 text-sky-500" />
                                                    <span className="text-sky-500">Đã copy</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    Copy nội dung
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* New Note Modal */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
                        style={{maxHeight: '92vh', minHeight: '60vh'}}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-base font-semibold text-gray-900">Ghi chú mới</h2>
                            <button
                                onClick={() => {
                                    setShowNew(false);
                                    setNewTitle('');
                                    setNewContent('');
                                    setNewNoteFolderId(null);
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-6 pt-5 pb-2 shrink-0">
                            <input
                                autoFocus
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                placeholder="Tiêu đề..."
                                spellCheck={false}
                                className="w-full text-xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent border-b border-gray-100 pb-3"
                            />
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-6 pb-2">
                            <textarea
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                placeholder="Nhập nội dung ghi chú..."
                                spellCheck={false}
                                className="flex-1 w-full text-sm text-gray-700 placeholder-gray-300 focus:outline-none resize-none leading-relaxed font-mono py-3 bg-transparent"
                            />
                        </div>
                        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
                            <div className="flex items-center gap-3">
                                {folders.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <Folder className="w-3.5 h-3.5 text-gray-400" />
                                        <select
                                            value={newNoteFolderId || ''}
                                            onChange={(e) => setNewNoteFolderId(e.target.value || null)}
                                            className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        >
                                            <option value="">Không có thư mục</option>
                                            {folders.map((f) => (
                                                <option
                                                    key={f.id}
                                                    value={f.id}
                                                >
                                                    {f.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <span className="text-[11px] text-gray-400">{newContent.length} ký tự</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowNew(false);
                                        setNewTitle('');
                                        setNewContent('');
                                        setNewNoteFolderId(null);
                                    }}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                                >
                                    Huỷ
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!newTitle.trim() || creating}
                                    className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed font-medium"
                                >
                                    {creating ? 'Đang tạo...' : 'Tạo ghi chú'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Modal */}
            {shareNote && (
                <NoteShareModal
                    noteId={shareNote.id}
                    noteTitle={shareNote.title}
                    onClose={() => setShareNote(null)}
                />
            )}
        </div>
    );
}
