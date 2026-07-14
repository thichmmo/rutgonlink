'use client';

import {useState, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {useForm, useFieldArray} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {Modal, Button} from 'antd';
import {
    Plus,
    Trash2,
    Link2,
    Share2,
    X,
    Upload,
    Smartphone,
    BarChart2,
    Eye,
    EyeOff,
    Lock,
    AlertCircle,
    CheckCircle2,
    FolderOpen,
} from 'lucide-react';
import {SHARED_DOMAINS} from '@/lib/shared-domains';
import {toDateTimeLocalVN} from '@/lib/utils';
import FolderSelectionSection from './FolderSelectionSection';

const SHARED_PREFIX = '__shared__';

interface Domain {
    id: string;
    domain: string;
    verified: boolean;
}

interface Category {
    id: string;
    name: string;
    color: string;
}

interface Workspace {
    id: string;
    name: string;
}

interface LinkData {
    id: string;
    shortCode: string;
    originalUrl: string;
    title: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    ogAutoReset: boolean;
    ogScheduledDisableAt: string | null;
    clickResetAt: string | null;
    password: string | null;
    expiresAt: string | null;
    maxClicks: number | null;
    deepLinkIos: string | null;
    deepLinkAndroid: string | null;
    folderRotationStartDate: string | null;
    domain: Domain | null;
    sharedDomain: string | null;
    category: Category | null;
    workspace?: {id: string; name: string} | null;
}

interface Props {
    link: LinkData;
    baseUrl: string;
    domains: Domain[];
    categories: Category[];
    workspaces?: Workspace[];
    canDeviceRedirect?: boolean;
    canGeoRedirect?: boolean;
    onClose: () => void;
    onSuccess: (shortUrl: string) => void;
}

const schema = z.object({
    originalUrl: z.string().min(1, 'Vui lòng nhập ít nhất 1 URL'),
    shortCode: z
        .string()
        .min(3, 'Mã tối thiểu 3 ký tự')
        .max(190, 'Mã tối đa 190 ký tự')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Chỉ dùng chữ cái, số, - hoặc _'),
    title: z.string().max(100).optional(),
    domainId: z.string().optional(),
    categoryId: z.string().optional(),
    workspaceId: z.string().optional(),
    expiresAt: z.string().optional(),
    password: z.string().optional(),
    maxClicks: z.string().optional(),
    deepLinkIos: z.string().optional(),
    deepLinkAndroid: z.string().optional(),
    ogTitle: z.string().max(100).optional(),
    ogDescription: z.string().max(300).optional(),
    ogImage: z.string().optional(),
    deviceRules: z
        .array(z.object({deviceType: z.string().min(1), redirectUrl: z.string().url('URL không hợp lệ')}))
        .optional(),
    countryRules: z
        .array(
            z.object({
                countryCode: z.string().length(2, 'Mã quốc gia phải đúng 2 ký tự'),
                redirectUrl: z.string().url('URL không hợp lệ'),
            }),
        )
        .optional(),
    languageRules: z
        .array(
            z.object({
                languageCode: z.string().min(2, 'Mã ngôn ngữ tối thiểu 2 ký tự'),
                redirectUrl: z.string().url('URL không hợp lệ'),
            }),
        )
        .optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditLinkModal({
    link,
    baseUrl,
    domains,
    categories,
    workspaces = [],
    canDeviceRedirect = true,
    canGeoRedirect = true,
    onClose,
    onSuccess,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{msg: string; type: 'error' | 'success'} | null>(null);

    const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
        setToast({msg, type});
        setTimeout(() => setToast(null), 4000);
    };
    const [showOg, setShowOg] = useState(!!(link.ogTitle || link.ogDescription || link.ogImage));
    const [showAdvanced, setShowAdvanced] = useState(!!(link.maxClicks || link.deepLinkIos || link.deepLinkAndroid));
    const [ogAutoReset, setOgAutoReset] = useState(link.ogAutoReset ?? false);
    const [ogScheduledDisableAt, setOgScheduledDisableAt] = useState(
        link.ogScheduledDisableAt ? toDateTimeLocalVN(new Date(link.ogScheduledDisableAt)) : '',
    );
    const [clickResetAt, setClickResetAt] = useState(
        link.clickResetAt ? toDateTimeLocalVN(new Date(link.clickResetAt)) : '',
    );
    const [clearPassword, setClearPassword] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
    const [showUtm, setShowUtm] = useState(false);
    const [ogImagePreview, setOgImagePreview] = useState(link.ogImage || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UTM state
    const [utmSource, setUtmSource] = useState('');
    const [utmMedium, setUtmMedium] = useState('');
    const [utmCampaign, setUtmCampaign] = useState('');
    const [utmTerm, setUtmTerm] = useState('');
    const [utmContent, setUtmContent] = useState('');

    // Folder rotation state
    const [useFolderRotation, setUseFolderRotation] = useState(false);
    const [folders, setFolders] = useState<Array<{id: string; name: string; urls: string; order: number}>>([]);
    const [showFolderSection, setShowFolderSection] = useState(false);
    const [activeFolderUrls, setActiveFolderUrls] = useState<string>('');
    const [activeFolderLabel, setActiveFolderLabel] = useState<string>('');
    const [folderRotationStartDate, setFolderRotationStartDate] = useState<string | null>(link.folderRotationStartDate);

    const initDomainValue = link.domain
        ? link.domain.id
        : link.sharedDomain
          ? `${SHARED_PREFIX}${link.sharedDomain}`
          : `${SHARED_PREFIX}${SHARED_DOMAINS[0]}`;

    const [selectedDomainValue, setSelectedDomainValue] = useState(initDomainValue);

    const verifiedDomains = domains.filter((d) => d.verified);
    const unverifiedDomains = domains.filter((d) => !d.verified);

    const isShared = selectedDomainValue.startsWith(SHARED_PREFIX);
    const sharedDomain = isShared ? selectedDomainValue.slice(SHARED_PREFIX.length) : '';
    const customDomain = !isShared ? verifiedDomains.find((d) => d.id === selectedDomainValue) : null;
    const displayDomain = customDomain?.domain || sharedDomain;

    const [errorField, setErrorField] = useState('');

    const {
        register,
        handleSubmit,
        control,
        setValue,
        watch,
        setFocus,
        formState: {errors},
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            originalUrl: link.originalUrl,
            shortCode: link.shortCode,
            title: link.title || '',
            domainId: link.domain?.id || undefined,
            ogTitle: link.ogTitle || '',
            ogDescription: link.ogDescription || '',
            ogImage: link.ogImage || '',
            password: '',
            expiresAt: link.expiresAt ? toDateTimeLocalVN(new Date(link.expiresAt)) : '',
            categoryId: link.category?.id || '',
            workspaceId: link.workspace?.id || '',
            maxClicks: link.maxClicks ? String(link.maxClicks) : '',
            deepLinkIos: link.deepLinkIos || '',
            deepLinkAndroid: link.deepLinkAndroid || '',
            deviceRules: [],
            countryRules: [],
            languageRules: [],
        },
    });

    useEffect(() => {
        fetch(`/api/links/${link.id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.deviceRules?.length) {
                    setValue(
                        'deviceRules',
                        data.deviceRules.map((r: {deviceType: string; redirectUrl: string}) => ({
                            deviceType: r.deviceType,
                            redirectUrl: r.redirectUrl,
                        })),
                    );
                    setShowAdvanced(true);
                }
                if (data.countryRules?.length) {
                    setValue(
                        'countryRules',
                        data.countryRules.map((r: {countryCode: string; redirectUrl: string}) => ({
                            countryCode: r.countryCode,
                            redirectUrl: r.redirectUrl,
                        })),
                    );
                    setShowAdvanced(true);
                }
                if (data.languageRules?.length) {
                    setValue(
                        'languageRules',
                        data.languageRules.map((r: {languageCode: string; redirectUrl: string}) => ({
                            languageCode: r.languageCode,
                            redirectUrl: r.redirectUrl,
                        })),
                    );
                    setShowAdvanced(true);
                }
                // Load folder rotation data
                if (data.useFolderRotation !== undefined) {
                    setUseFolderRotation(data.useFolderRotation);
                    if (data.useFolderRotation) {
                        setShowFolderSection(true);
                        setShowAdvanced(true);
                    }
                }
                if (data.folderRotationStartDate) {
                    setFolderRotationStartDate(data.folderRotationStartDate);
                }
            })
            .catch(() => {});

        // Load folders
        fetch(`/api/links/${link.id}/folders`)
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setFolders(data);
                    if (data.length > 0) {
                        setShowFolderSection(true);
                        setShowAdvanced(true);
                    }
                }
            })
            .catch(() => {});
    }, [link.id, setValue]);

    // Load active folder URLs from the server so this matches redirect logic.
    useEffect(() => {
        if (!useFolderRotation) {
            setActiveFolderUrls('');
            setActiveFolderLabel('');
            return;
        }

        let cancelled = false;
        fetch(`/api/links/${link.id}/active-folder`, {cache: 'no-store'})
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                if (data.active && data.urls) {
                    setActiveFolderUrls(data.urls);
                    setActiveFolderLabel(`folder #${data.activeIndex + 1}/${data.totalFolders}: ${data.folderName}`);
                } else {
                    setActiveFolderUrls('');
                    setActiveFolderLabel('');
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setActiveFolderUrls('');
                    setActiveFolderLabel('');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [useFolderRotation, link.id, folderRotationStartDate]);

    const handleDomainChange = (val: string) => {
        setSelectedDomainValue(val);
        if (val.startsWith(SHARED_PREFIX)) {
            setValue('domainId', undefined);
        } else {
            setValue('domainId', val);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setOgImagePreview(dataUrl);
            setValue('ogImage', dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const buildUtmUrl = (baseUrl: string) => {
        if (!baseUrl || !utmSource) return baseUrl;
        try {
            const url = new URL(baseUrl.split('\n')[0].trim());
            if (utmSource) url.searchParams.set('utm_source', utmSource);
            if (utmMedium) url.searchParams.set('utm_medium', utmMedium);
            if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign);
            if (utmTerm) url.searchParams.set('utm_term', utmTerm);
            if (utmContent) url.searchParams.set('utm_content', utmContent);
            return url.toString();
        } catch {
            return baseUrl;
        }
    };

    const {
        fields: deviceFields,
        append: appendDevice,
        remove: removeDevice,
    } = useFieldArray({control, name: 'deviceRules'});
    const {
        fields: countryFields,
        append: appendCountry,
        remove: removeCountry,
    } = useFieldArray({control, name: 'countryRules'});
    const {
        fields: languageFields,
        append: appendLanguage,
        remove: removeLanguage,
    } = useFieldArray({control, name: 'languageRules'});

    const watchOgTitle = watch('ogTitle');
    const watchOgDescription = watch('ogDescription');
    const watchShortCode = watch('shortCode');
    const watchOriginalUrl = watch('originalUrl');

    const shortUrl = isShared
        ? `https://${sharedDomain}/${watchShortCode || link.shortCode}`
        : customDomain
          ? `https://${customDomain.domain}/${watchShortCode || link.shortCode}`
          : `${baseUrl}/${watchShortCode || link.shortCode}`;

    const onSubmit = async (data: FormData) => {
        setLoading(true);
        try {
            // Apply UTM params if set
            let finalUrl = data.originalUrl;
            if (utmSource) {
                const urls = data.originalUrl
                    .split('\n')
                    .map((u) => u.trim())
                    .filter(Boolean);
                finalUrl = urls.map((u) => buildUtmUrl(u)).join('\n');
            }

            const res = await fetch(`/api/links/${link.id}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    ...data,
                    originalUrl: finalUrl,
                    sharedDomain: isShared ? sharedDomain : '',
                    domainId: isShared ? '' : data.domainId,
                    maxClicks: data.maxClicks ? parseInt(data.maxClicks) : null,
                    deepLinkIos: data.deepLinkIos || null,
                    deepLinkAndroid: data.deepLinkAndroid || null,
                    ogAutoReset,
                    ogScheduledDisableAt: ogScheduledDisableAt ? new Date(ogScheduledDisableAt).toISOString() : null,
                    clickResetAt: clickResetAt ? new Date(clickResetAt).toISOString() : null,
                    password: clearPassword ? null : data.password || '',
                    useFolderRotation,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                const errMsg = json.error || 'Đã xảy ra lỗi';
                showToast(errMsg, 'error');
                let field = '';
                if (errMsg.includes('Mã rút gọn') || errMsg.includes('shortCode')) field = 'shortCode';
                else if (errMsg.includes('URL') || errMsg.includes('url')) field = 'originalUrl';
                setErrorField(field);
                if (field) setTimeout(() => setFocus(field as keyof FormData), 50);
                return;
            }
            setErrorField('');
            try {
                await navigator.clipboard.writeText(shortUrl);
            } catch {
                /* ignore */
            }
            onSuccess(shortUrl);
        } catch {
            showToast('Không thể kết nối server', 'error');
        } finally {
            setLoading(false);
        }
    };

    const modalTitle = (
        <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                <Link2 className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">Sửa link</span>
        </div>
    );

    const modalFooter = (
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button
                onClick={onClose}
                style={{flex: 1}}
                size="large"
            >
                Hủy
            </Button>
            <Button
                type="primary"
                loading={loading}
                onClick={handleSubmit(onSubmit)}
                style={{flex: 1}}
                size="large"
            >
                Lưu thay đổi
            </Button>
        </div>
    );

    return (
        <>
            <Modal
                open={true}
                onCancel={onClose}
                width="min(620px, calc(100vw - 24px))"
                title={modalTitle}
                footer={modalFooter}
                destroyOnClose
                styles={{body: {maxHeight: '70vh', overflowY: 'auto', paddingRight: 4}}}
            >
                <form
                    autoComplete="off"
                    onSubmit={(e) => e.preventDefault()}
                    className="space-y-4"
                >
                    {/* Honeypot: bẫy browser autofill vào đây thay vì các field thật */}
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            top: '-9999px',
                            left: '-9999px',
                            opacity: 0,
                            pointerEvents: 'none',
                        }}
                    >
                        <input
                            type="text"
                            name="fake-user"
                            autoComplete="username"
                            tabIndex={-1}
                            readOnly
                        />
                        <input
                            type="password"
                            name="fake-pass"
                            autoComplete="current-password"
                            tabIndex={-1}
                            readOnly
                        />
                    </div>

                    {/* URL gốc */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            URL gốc <span className="text-red-500">*</span>
                            <span className="text-gray-400 font-normal ml-1">
                                {useFolderRotation && activeFolderUrls
                                    ? '— đang hiển thị URLs từ folder active hôm nay (chỉ xem)'
                                    : '— mỗi dòng 1 URL, nhiều URL sẽ random'}
                            </span>
                        </label>
                        {useFolderRotation && activeFolderLabel && (
                            <p className="mb-1.5 text-xs font-medium text-sky-700">
                                Active: {activeFolderLabel}
                            </p>
                        )}
                        <textarea
                            {...register('originalUrl')}
                            rows={3}
                            value={useFolderRotation && activeFolderUrls ? activeFolderUrls : undefined}
                            readOnly={useFolderRotation && !!activeFolderUrls}
                            className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 resize-none ${
                                useFolderRotation && activeFolderUrls
                                    ? 'bg-sky-50 border-sky-200 cursor-not-allowed'
                                    : errorField === 'originalUrl'
                                      ? 'border-red-400 ring-1 ring-red-400 focus:ring-red-400'
                                      : 'border-gray-200 focus:ring-sky-500'
                            }`}
                        />
                        {errors.originalUrl && (
                            <p className="mt-1 text-xs text-red-600">{errors.originalUrl.message}</p>
                        )}
                    </div>

                    {/* Tiêu đề */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Tiêu đề</label>
                        <input
                            {...register('title')}
                            type="text"
                            placeholder="Mô tả ngắn gọn"
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>

                    {/* Category */}
                    {categories.length > 0 && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Danh mục</label>
                            <select
                                {...register('categoryId')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
                            >
                                <option value="">-- Không có danh mục --</option>
                                {categories.map((c) => (
                                    <option
                                        key={c.id}
                                        value={c.id}
                                    >
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Workspace */}
                    {workspaces.length > 0 && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Workspace</label>
                            <select
                                {...register('workspaceId')}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
                            >
                                <option value="">-- Không gán vào workspace --</option>
                                {workspaces.map((w) => (
                                    <option
                                        key={w.id}
                                        value={w.id}
                                    >
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Domain + shortCode */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Link rút gọn</label>
                        <div className="flex items-center gap-1.5">
                            <select
                                value={selectedDomainValue}
                                onChange={(e) => handleDomainChange(e.target.value)}
                                className="shrink-0 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
                            >
                                <optgroup label="Domain dùng chung">
                                    {SHARED_DOMAINS.map((d) => (
                                        <option
                                            key={d}
                                            value={`${SHARED_PREFIX}${d}`}
                                        >
                                            {d}
                                        </option>
                                    ))}
                                </optgroup>
                                {verifiedDomains.length > 0 && (
                                    <optgroup label="Domain của bạn">
                                        {verifiedDomains.map((d) => (
                                            <option
                                                key={d.id}
                                                value={d.id}
                                            >
                                                {d.domain}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                {unverifiedDomains.map((d) => (
                                    <option
                                        key={d.id}
                                        value={d.id}
                                        disabled
                                    >
                                        {d.domain} (chưa xác minh)
                                    </option>
                                ))}
                            </select>
                            <span className="text-xs text-gray-500">/</span>
                            <input
                                {...register('shortCode')}
                                type="text"
                                className={`flex-1 min-w-0 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 ${errorField === 'shortCode' ? 'border-red-400 ring-1 ring-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-sky-500'}`}
                            />
                        </div>
                        {errors.shortCode && <p className="mt-1 text-xs text-red-600">{errors.shortCode.message}</p>}
                        <p className="mt-1 text-xs text-gray-400 truncate">→ {shortUrl}</p>
                    </div>

                    {/* OG toggle */}
                    <div className="flex items-center justify-between">
                        <Button
                            type="link"
                            icon={<Share2 className="w-4 h-4" />}
                            onClick={() => setShowOg(!showOg)}
                            className="px-0! text-purple-600 hover:text-purple-700! font-medium text-sm"
                        >
                            {showOg ? 'Ẩn' : 'Chỉnh sửa'} ảnh & tiêu đề khi chia sẻ
                        </Button>
                        {(watch('ogTitle') || watch('ogDescription') || ogImagePreview) && (
                            <Button
                                type="link"
                                danger
                                size="small"
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                onClick={() => {
                                    setValue('ogTitle', '');
                                    setValue('ogDescription', '');
                                    setValue('ogImage', '');
                                    setOgImagePreview('');
                                }}
                                className="px-0! text-xs font-medium"
                            >
                                Xóa meta tags
                            </Button>
                        )}
                    </div>

                    {showOg && (
                        <div className="space-y-3 bg-purple-50 border border-purple-100 rounded-2xl p-4">
                            <p className="text-xs text-purple-600 font-medium flex items-center gap-1.5">
                                <Share2 className="w-3.5 h-3.5" />
                                Tùy chỉnh preview khi chia sẻ lên Facebook, Zalo, Telegram...
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                        Tiêu đề hiển thị
                                    </label>
                                    <input
                                        {...register('ogTitle')}
                                        type="text"
                                        placeholder="Tiêu đề hấp dẫn"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Mô tả</label>
                                    <textarea
                                        {...register('ogDescription')}
                                        rows={2}
                                        placeholder="Mô tả ngắn gọn..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Ảnh thumbnail (1200×630 px)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="https://example.com/image.jpg"
                                        className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                        value={ogImagePreview.startsWith('data:') ? '' : ogImagePreview}
                                        onChange={(e) => {
                                            setValue('ogImage', e.target.value);
                                            setOgImagePreview(e.target.value);
                                        }}
                                    />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                    <Button
                                        icon={<Upload className="w-4 h-4" />}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="shrink-0"
                                        title="Upload ảnh từ máy"
                                    >
                                        Upload
                                    </Button>
                                </div>
                            </div>
                            {(watchOgTitle || watchOgDescription || ogImagePreview) && (
                                <div>
                                    <p className="text-xs text-gray-400 mb-1.5">Xem trước khi share:</p>
                                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm relative">
                                        {ogImagePreview && (
                                            <>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={ogImagePreview}
                                                    alt="preview"
                                                    className="w-full h-32 object-cover"
                                                    onError={() => setOgImagePreview('')}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setValue('ogImage', '');
                                                        setOgImagePreview('');
                                                    }}
                                                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 cursor-pointer"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </>
                                        )}
                                        <div className="p-3 bg-gray-50">
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                                                {displayDomain}
                                            </p>
                                            <p className="font-semibold text-gray-900 text-sm mt-0.5 line-clamp-1">
                                                {watchOgTitle || 'Tiêu đề link'}
                                            </p>
                                            {watchOgDescription && (
                                                <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">
                                                    {watchOgDescription}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Hẹn giờ tắt metatag */}
                            <div className="border-t border-purple-100 pt-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Hẹn giờ tắt metatag
                                    <span className="text-gray-400 font-normal ml-1">
                                        — hệ thống tự tắt OG và gọi FB debug vào thời điểm này
                                    </span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="datetime-local"
                                        value={ogScheduledDisableAt}
                                        onChange={(e) => setOgScheduledDisableAt(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    />
                                    {ogScheduledDisableAt && (
                                        <button
                                            type="button"
                                            onClick={() => setOgScheduledDisableAt('')}
                                            className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0"
                                            title="Xóa hẹn giờ"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {ogScheduledDisableAt && (
                                    <p className="mt-1 text-xs text-purple-600">
                                        Metatag sẽ tự động tắt và FB debug sẽ được gọi vào{' '}
                                        {new Date(ogScheduledDisableAt).toLocaleString('vi-VN')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Advanced toggle */}
                    <Button
                        type="link"
                        icon={<Plus className="w-4 h-4" />}
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="px-0! text-sky-600 hover:text-sky-700! font-medium text-sm"
                    >
                        {showAdvanced ? 'Ẩn' : 'Hiện'} tùy chọn nâng cao
                    </Button>

                    {showAdvanced && (
                        <div className="space-y-4 border-t border-gray-100 pt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                        Ngày hết hạn
                                    </label>
                                    <input
                                        {...register('expiresAt')}
                                        type="datetime-local"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Mật khẩu</label>
                                    {clearPassword ? (
                                        <div className="flex items-center gap-2 px-3 py-2 border border-orange-200 bg-orange-50 rounded-xl text-sm text-orange-600">
                                            <span className="flex-1">Sẽ xóa mật khẩu khi lưu</span>
                                            <button
                                                type="button"
                                                onClick={() => setClearPassword(false)}
                                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <div className="relative">
                                                <input
                                                    {...register('password')}
                                                    name="lnk-access-code"
                                                    type="text"
                                                    autoComplete="off"
                                                    placeholder={
                                                        link.password
                                                            ? 'Nhập mật khẩu mới để thay đổi'
                                                            : 'Nhập mật khẩu (để trống = không có)'
                                                    }
                                                    style={
                                                        !showPwd
                                                            ? ({WebkitTextSecurity: 'disc'} as React.CSSProperties)
                                                            : {}
                                                    }
                                                    className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPwd((v) => !v)}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                                >
                                                    {showPwd ? (
                                                        <EyeOff className="w-4 h-4" />
                                                    ) : (
                                                        <Eye className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                            {link.password && (
                                                <button
                                                    type="button"
                                                    onClick={() => setClearPassword(true)}
                                                    className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                                                >
                                                    Xóa mật khẩu hiện tại
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Click Limit */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Giới hạn click <span className="text-gray-400">(để trống = không giới hạn)</span>
                                </label>
                                <input
                                    {...register('maxClicks')}
                                    type="number"
                                    min="1"
                                    placeholder="VD: 100"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                                <label className="mt-2 flex items-start gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={ogAutoReset}
                                        onChange={(e) => setOgAutoReset(e.target.checked)}
                                        className="mt-0.5 cursor-pointer"
                                    />
                                    <span className="text-xs text-gray-600">
                                        <span className="font-medium">Tự động reset meta tag</span> — khi đủ click: tắt
                                        OG preview, gọi FB debug để cập nhật cache, reset bộ đếm click và tiếp tục hoạt
                                        động
                                    </span>
                                </label>
                            </div>

                            {/* Hẹn giờ reset click */}
                            <div className="border-t border-gray-100 pt-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Hẹn giờ reset click
                                    <span className="text-gray-400 font-normal ml-1">
                                        — xóa toàn bộ lịch sử click vào thời điểm này
                                    </span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="datetime-local"
                                        value={clickResetAt}
                                        onChange={(e) => setClickResetAt(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-sky-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    {clickResetAt && (
                                        <button
                                            type="button"
                                            onClick={() => setClickResetAt('')}
                                            className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0"
                                            title="Xóa hẹn giờ"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {clickResetAt && (
                                    <p className="mt-1 text-xs text-sky-600">
                                        Click sẽ được reset vào{' '}
                                        {new Date(clickResetAt).toLocaleString('vi-VN')}
                                    </p>
                                )}
                            </div>

                            {/* Deep Links */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                                    <Smartphone className="w-3.5 h-3.5" />
                                    Deep Link — Mở thẳng app mobile
                                </label>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                        iOS (App Store URL hoặc deep link)
                                    </label>
                                    <input
                                        {...register('deepLinkIos')}
                                        type="text"
                                        placeholder="https://apps.apple.com/... hoặc myapp://path"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                        Android (Play Store URL hoặc deep link)
                                    </label>
                                    <input
                                        {...register('deepLinkAndroid')}
                                        type="text"
                                        placeholder="https://play.google.com/... hoặc myapp://path"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>
                            </div>

                            {/* Device Rules */}
                            {canDeviceRedirect ? (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-medium text-gray-700">
                                            Chuyển hướng theo thiết bị
                                        </label>
                                        <Button
                                            type="link"
                                            size="small"
                                            icon={<Plus className="w-3 h-3" />}
                                            onClick={() => appendDevice({deviceType: 'mobile', redirectUrl: ''})}
                                            className="px-0! text-sky-600 text-xs font-medium"
                                        >
                                            Thêm
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {deviceFields.map((field, i) => (
                                            <div
                                                key={field.id}
                                                className="flex gap-2"
                                            >
                                                <select
                                                    {...register(`deviceRules.${i}.deviceType`)}
                                                    className="w-28 px-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white cursor-pointer"
                                                >
                                                    <option value="mobile">Di động</option>
                                                    <option value="tablet">Máy tính bảng</option>
                                                    <option value="desktop">Máy tính</option>
                                                </select>
                                                <input
                                                    {...register(`deviceRules.${i}.redirectUrl`)}
                                                    type="text"
                                                    placeholder="https://mobile.example.com"
                                                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                />
                                                <Button
                                                    type="text"
                                                    danger
                                                    icon={<Trash2 className="w-4 h-4" />}
                                                    onClick={() => removeDevice(i)}
                                                    className="px-2!"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                                    <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="text-xs text-gray-500 flex-1">Chuyển hướng theo thiết bị</span>
                                    <a
                                        href="/pricing"
                                        target="_blank"
                                        className="text-xs px-2.5 py-1 bg-sky-50 text-sky-600 rounded-full font-medium whitespace-nowrap hover:bg-sky-100 transition-colors"
                                    >
                                        Yêu cầu Pro ↗
                                    </a>
                                </div>
                            )}

                            {/* Country Rules */}
                            {canGeoRedirect ? (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-medium text-gray-700">
                                            Chuyển hướng theo quốc gia
                                        </label>
                                        <Button
                                            type="link"
                                            size="small"
                                            icon={<Plus className="w-3 h-3" />}
                                            onClick={() => appendCountry({countryCode: 'VN', redirectUrl: ''})}
                                            className="px-0! text-sky-600 text-xs font-medium"
                                        >
                                            Thêm
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {countryFields.map((field, i) => (
                                            <div
                                                key={field.id}
                                                className="flex gap-2"
                                            >
                                                <input
                                                    {...register(`countryRules.${i}.countryCode`)}
                                                    type="text"
                                                    placeholder="VN"
                                                    maxLength={2}
                                                    className="w-16 px-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase text-center"
                                                />
                                                <input
                                                    {...register(`countryRules.${i}.redirectUrl`)}
                                                    type="text"
                                                    placeholder="https://vn.example.com"
                                                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                />
                                                <Button
                                                    type="text"
                                                    danger
                                                    icon={<Trash2 className="w-4 h-4" />}
                                                    onClick={() => removeCountry(i)}
                                                    className="px-2!"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                                    <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="text-xs text-gray-500 flex-1">Chuyển hướng theo quốc gia</span>
                                    <a
                                        href="/pricing"
                                        target="_blank"
                                        className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full font-medium whitespace-nowrap hover:bg-indigo-100 transition-colors"
                                    >
                                        Yêu cầu Ultra ↗
                                    </a>
                                </div>
                            )}

                            {/* Language Rules */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium text-gray-700">
                                        Chuyển hướng theo ngôn ngữ
                                    </label>
                                    <Button
                                        type="link"
                                        size="small"
                                        icon={<Plus className="w-3 h-3" />}
                                        onClick={() => appendLanguage({languageCode: 'vi', redirectUrl: ''})}
                                        className="px-0! text-sky-600 text-xs font-medium"
                                    >
                                        Thêm
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {languageFields.map((field, i) => (
                                        <div
                                            key={field.id}
                                            className="flex gap-2"
                                        >
                                            <input
                                                {...register(`languageRules.${i}.languageCode`)}
                                                type="text"
                                                placeholder="vi"
                                                maxLength={5}
                                                className="w-16 px-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 lowercase text-center"
                                            />
                                            <input
                                                {...register(`languageRules.${i}.redirectUrl`)}
                                                type="text"
                                                placeholder="https://vi.example.com"
                                                className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            />
                                            <Button
                                                type="text"
                                                danger
                                                icon={<Trash2 className="w-4 h-4" />}
                                                onClick={() => removeLanguage(i)}
                                                className="px-2!"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* UTM Builder */}
                            <div>
                                <Button
                                    type="link"
                                    icon={<BarChart2 className="w-4 h-4" />}
                                    onClick={() => setShowUtm(!showUtm)}
                                    className="px-0! text-orange-600 hover:text-orange-700! font-medium text-sm"
                                >
                                    {showUtm ? 'Ẩn' : 'Thêm'} UTM Tracking Parameters
                                </Button>
                            </div>

                            {showUtm && (
                                <div className="space-y-3 bg-orange-50 border border-orange-100 rounded-2xl p-4">
                                    <p className="text-xs text-orange-600 font-medium flex items-center gap-1.5">
                                        <BarChart2 className="w-3.5 h-3.5" />
                                        UTM parameters sẽ được tự động gắn vào URL gốc
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                utm_source <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={utmSource}
                                                onChange={(e) => setUtmSource(e.target.value)}
                                                placeholder="facebook, google..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                utm_medium
                                            </label>
                                            <input
                                                type="text"
                                                value={utmMedium}
                                                onChange={(e) => setUtmMedium(e.target.value)}
                                                placeholder="social, cpc..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                utm_campaign
                                            </label>
                                            <input
                                                type="text"
                                                value={utmCampaign}
                                                onChange={(e) => setUtmCampaign(e.target.value)}
                                                placeholder="summer_sale..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                utm_term
                                            </label>
                                            <input
                                                type="text"
                                                value={utmTerm}
                                                onChange={(e) => setUtmTerm(e.target.value)}
                                                placeholder="keyword..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                utm_content
                                            </label>
                                            <input
                                                type="text"
                                                value={utmContent}
                                                onChange={(e) => setUtmContent(e.target.value)}
                                                placeholder="banner_top..."
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                        </div>
                                    </div>
                                    {utmSource && watchOriginalUrl && (
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">URL với UTM:</p>
                                            <p className="text-xs text-orange-700 bg-orange-100 rounded-lg px-3 py-2 break-all font-mono">
                                                {buildUtmUrl(watchOriginalUrl.split('\n')[0]?.trim() || '')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Folder Rotation */}
                            <div className="border-t border-gray-100 pt-4">
                                <Button
                                    type="link"
                                    icon={<FolderOpen className="w-4 h-4" />}
                                    onClick={() => setShowFolderSection(!showFolderSection)}
                                    className="px-0! text-indigo-600 hover:text-indigo-700! font-medium text-sm"
                                >
                                    {showFolderSection ? 'Ẩn' : 'Hiện'} Folder Rotation
                                </Button>
                            </div>

                            {showFolderSection && (
                                <div className="space-y-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            checked={useFolderRotation}
                                            onChange={(e) => {
                                                const checked = e.target.checked
                                                if (checked && folders.length === 0) {
                                                    showToast('Cần ít nhất 1 folder để bật chế độ luân phiên', 'error')
                                                    return
                                                }
                                                setUseFolderRotation(checked)
                                            }}
                                            className="mt-0.5 cursor-pointer"
                                        />
                                        <div className="flex-1">
                                            <label className="text-sm font-medium text-gray-900 cursor-pointer">
                                                Bật chế độ luân phiên folder theo ngày
                                            </label>
                                            <p className="text-xs text-gray-600 mt-0.5">
                                                Mỗi ngày (00:00 VN) sẽ chỉ random link trong 1 folder theo thứ tự
                                            </p>
                                        </div>
                                    </div>

                                    {useFolderRotation && folders.length > 0 && (
                                        <div className="text-xs text-indigo-700 bg-indigo-100 px-3 py-2 rounded-lg">
                                            <strong>Folder rotation đang bật:</strong> Hệ thống sẽ luân phiên {folders.length} folder theo thứ tự mỗi ngày
                                        </div>
                                    )}

                                    <div className="border-t border-indigo-200 pt-3">
                                        <p className="text-xs font-medium text-gray-700 mb-2">Chọn folders để luân phiên:</p>
                                        <FolderSelectionSection
                                            linkId={link.id}
                                            onUpdate={() => {
                                                fetch(`/api/links/${link.id}/folders`)
                                                    .then((r) => r.json())
                                                    .then((data) => {
                                                        if (Array.isArray(data)) {
                                                            setFolders(data)
                                                        }
                                                    })
                                                    .catch(() => {})
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </form>
            </Modal>
            {typeof document !== 'undefined' &&
                toast &&
                createPortal(
                    <div
                        className={`fixed top-4 left-3 right-3 sm:left-auto sm:right-4 z-9999 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-sky-600'}`}
                    >
                        {toast.type === 'error' ? (
                            <AlertCircle className="w-4 h-4 shrink-0" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                        )}
                        <span>{toast.msg}</span>
                    </div>,
                    document.body,
                )}
        </>
    );
}
