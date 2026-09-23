'use client';

import { Suspense, useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertCircle,
    BookOpen,
    CalendarDays,
    Eye,
    FileText,
    Pencil,
    Plus,
    RotateCcw,
    Trash2,
    Tag,
    Folder,
} from 'lucide-react';
import { ManagementPageHeader } from '@/components/admin/ManagementPageHeader';
import {
    LearningFilterBar,
    FilterItemConfig,
    SortOption,
} from '@/components/admin/LearningFilterBar';
import { CategoryFolderCard } from '@/components/admin/CategoryFolderCard';
import {
    CategoryFolderBreadcrumb,
    ViewDisplayMode,
} from '@/components/admin/CategoryFolderBreadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Training = {
    id: string;
    category_id?: string | null;
    category_name?: string | null;
    category_code?: string | null;
    category_color?: string | null;
    title: string;
    created_at: string;
    updated_at?: string;
    media_count?: number;
    module_count?: number;
};

interface CategoryOption {
    id: string;
    name: string;
    code: string;
    color: string;
    description?: string | null;
    training_count?: number;
    exam_count?: number;
    module_count?: number;
    is_active?: boolean;
}

const SORT_OPTIONS: SortOption[] = [
    { label: 'Terbaru Dibuat', value: 'created_desc' },
    { label: 'Terlama Dibuat', value: 'created_asc' },
    { label: 'Judul (A - Z)', value: 'title_asc' },
    { label: 'Judul (Z - A)', value: 'title_desc' },
    { label: 'Terakhir Diperbarui', value: 'updated_desc' },
];

const FOLDER_SORT_OPTIONS: SortOption[] = [
    { label: 'Nama (A - Z)', value: 'name_asc' },
    { label: 'Nama (Z - A)', value: 'name_desc' },
    { label: 'Materi Terbanyak', value: 'items_desc' },
    { label: 'Terbaru Dibuat', value: 'created_desc' },
];

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function ContentManagerContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeCategoryParam = searchParams.get('category');

    const [viewMode, setViewMode] = useState<ViewDisplayMode>('folder');
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [uncategorizedCount, setUncategorizedCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [userRole, setUserRole] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Search, Filter, Sort States for Items
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(activeCategoryParam || 'all');
    const [mediaType, setMediaType] = useState('all');
    const [usage, setUsage] = useState('all');
    const [sort, setSort] = useState('created_desc');

    // Folder View Search & Sort
    const [folderSearch, setFolderSearch] = useState('');
    const [folderSort, setFolderSort] = useState('name_asc');

    const { confirm, ConfirmComponent } = useConfirm();

    // Fetch accessible categories with item counts
    const fetchCategories = useCallback(async () => {
        setIsLoadingCategories(true);
        try {
            const res = await fetch('/api/admin/categories?all=true&include_counts=true');
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setCategories(data.data);
                if (data.uncategorized?.training_count) {
                    setUncategorizedCount(Number(data.uncategorized.training_count));
                }
            }
        } catch {
            // Handled gracefully
        } finally {
            setIsLoadingCategories(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    // Keep categoryFilter in sync with activeCategoryParam URL changes
    useEffect(() => {
        if (activeCategoryParam) {
            setCategoryFilter(activeCategoryParam);
            setPage(1);
        } else {
            setCategoryFilter('all');
        }
    }, [activeCategoryParam]);

    const fetchTrainings = useCallback(
        async (
            targetPage: number,
            limit: number,
            currentSearch = search,
            currentCategory = activeCategoryParam || categoryFilter,
            currentMediaType = mediaType,
            currentUsage = usage,
            currentSort = sort
        ) => {
            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    page: String(targetPage),
                    limit: String(limit),
                    search: currentSearch,
                    category_id: currentCategory,
                    media_type: currentMediaType,
                    usage: currentUsage,
                    sort: currentSort,
                });
                const response = await fetch(`/api/trainings?${params.toString()}`);
                if (!response.ok) throw new Error('Gagal mengambil data materi');
                const body = await response.json();
                if (!body.success) throw new Error(body.error || 'Terjadi kesalahan sistem');
                setTrainings(body.data);
                setTotalPages(body.pagination?.totalPages || 1);
                setTotalItems(body.pagination?.total || body.data.length);
            } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Gagal mengambil data materi');
            } finally {
                setIsLoading(false);
            }
        },
        [search, activeCategoryParam, categoryFilter, mediaType, usage, sort]
    );

    useEffect(() => {
        // Only fetch trainings list if inside a folder OR in "all" view mode
        if (activeCategoryParam || viewMode === 'all') {
            fetchTrainings(page, pageSize);
        }
    }, [page, pageSize, fetchTrainings, activeCategoryParam, viewMode]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((response) => response.json())
            .then((body) => {
                if (body.success) setUserRole(body.data.role);
            })
            .catch(() => undefined);
    }, []);

    const activeCategory = useMemo(() => {
        if (!activeCategoryParam) return null;
        if (activeCategoryParam === 'uncategorized' || activeCategoryParam === 'none') {
            return {
                id: 'uncategorized',
                name: 'Tanpa Kategori',
                code: 'UNCAT',
                color: '#64748b',
                description: 'Kumpulan materi pelatihan yang belum diklasifikasikan ke dalam kategori khusus.',
                is_active: true,
                training_count: uncategorizedCount,
            };
        }
        return categories.find((c) => c.id === activeCategoryParam) || null;
    }, [activeCategoryParam, categories, uncategorizedCount]);

    // Filter & Sort Categories for Folder View
    const filteredFolders = useMemo(() => {
        let result = [...categories];

        if (folderSearch.trim()) {
            const q = folderSearch.toLowerCase().trim();
            result = result.filter(
                (c) =>
                    c.name.toLowerCase().includes(q) ||
                    c.code.toLowerCase().includes(q) ||
                    (c.description && c.description.toLowerCase().includes(q))
            );
        }

        switch (folderSort) {
            case 'name_desc':
                result.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'items_desc':
                result.sort((a, b) => (b.training_count || 0) - (a.training_count || 0));
                break;
            case 'name_asc':
            default:
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }

        return result;
    }, [categories, folderSearch, folderSort]);

    const handleSearchChange = (newSearch: string) => {
        setSearch(newSearch);
        setPage(1);
    };

    const handleCategoryChange = (newCategory: string) => {
        setCategoryFilter(newCategory);
        setPage(1);
        if (viewMode === 'folder' && newCategory !== 'all') {
            router.push(`/admin/content?category=${newCategory}`);
        }
    };

    const handleMediaTypeChange = (newMediaType: string) => {
        setMediaType(newMediaType);
        setPage(1);
    };

    const handleUsageChange = (newUsage: string) => {
        setUsage(newUsage);
        setPage(1);
    };

    const handleSortChange = (newSort: string) => {
        setSort(newSort);
        setPage(1);
    };

    const handleReset = () => {
        setSearch('');
        if (viewMode === 'all') {
            setCategoryFilter('all');
        }
        setMediaType('all');
        setUsage('all');
        setSort('created_desc');
        setPage(1);
    };

    const handleOpenFolder = (categoryId: string) => {
        router.push(`/admin/content?category=${categoryId}`);
    };

    const handleBackToFolders = () => {
        router.push('/admin/content');
    };

    const handleViewModeChange = (mode: ViewDisplayMode) => {
        setViewMode(mode);
        if (mode === 'folder' && !activeCategoryParam) {
            setPage(1);
        }
    };

    const isFilterActive =
        search.trim() !== '' ||
        (viewMode === 'all' && categoryFilter !== 'all') ||
        mediaType !== 'all' ||
        usage !== 'all' ||
        sort !== 'created_desc';

    const filterConfigs: FilterItemConfig[] = [
        ...(viewMode === 'all'
            ? [
                  {
                      id: 'category',
                      label: 'Kategori',
                      value: categoryFilter,
                      onChange: handleCategoryChange,
                      options: [
                          { label: 'Semua Kategori', value: 'all' },
                          ...categories.map((c) => ({
                              label: `${c.name} (${c.code})`,
                              value: c.id,
                          })),
                          ...(uncategorizedCount > 0
                              ? [{ label: 'Tanpa Kategori', value: 'uncategorized' }]
                              : []),
                      ],
                  },
              ]
            : []),
        {
            id: 'media_type',
            label: 'Format Media',
            value: mediaType,
            onChange: handleMediaTypeChange,
            options: [
                { label: 'Semua Format Media', value: 'all' },
                { label: 'Video Saja', value: 'video' },
                { label: 'Dokumen / PDF', value: 'document' },
                { label: 'Teks Saja', value: 'none' },
            ],
        },
        {
            id: 'usage',
            label: 'Penggunaan Modul',
            value: usage,
            onChange: handleUsageChange,
            options: [
                { label: 'Semua Status Modul', value: 'all' },
                { label: 'Digunakan dalam Modul', value: 'in_module' },
                { label: 'Belum Masuk Modul', value: 'standalone' },
            ],
        },
    ];

    const deleteTraining = async (id: string, title: string) => {
        const confirmed = await confirm({
            title: `Hapus materi "${title}"?`,
            message: 'Materi yang sudah dihapus tidak dapat dipulihkan. Pastikan materi ini tidak lagi dibutuhkan.',
            confirmLabel: 'Hapus materi',
            isDestructive: true,
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/trainings/${id}`, { method: 'DELETE' });
            const body = await response.json();
            if (!response.ok || !body.success) {
                toast.error(body.error || 'Gagal menghapus materi');
                return;
            }
            toast.success('Materi berhasil dihapus');
            fetchTrainings(page, pageSize);
            fetchCategories();
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menghapus materi');
        }
    };

    const isFolderRoot = viewMode === 'folder' && !activeCategoryParam;

    return (
        <div className="relative max-w-6xl space-y-6 pb-12">
            <ConfirmComponent />

            <ManagementPageHeader
                title="Materi Pelatihan"
                description={
                    isFolderRoot
                        ? 'Pilih folder kategori pembelajaran untuk melihat, menambah, atau mengelola materi pelatihan di dalamnya.'
                        : userRole === 'trainer'
                        ? 'Daftar bahan pembelajaran, artikel, video, dan materi yang ditugaskan kepada Anda.'
                        : 'Kelola bacaan, artikel, video, dan bahan pembelajaran yang akan digunakan dalam modul.'
                }
                icon={<BookOpen className="size-7" />}
                actionLabel={userRole === 'admin' ? 'Buat Materi Baru' : undefined}
                actionHref={
                    userRole === 'admin'
                        ? activeCategoryParam
                            ? `/admin/content/new?category_id=${activeCategoryParam}`
                            : '/admin/content/new'
                        : undefined
                }
                onRefresh={() => {
                    fetchCategories();
                    if (!isFolderRoot) {
                        fetchTrainings(page, pageSize);
                    }
                }}
                isRefreshing={isLoading || isLoadingCategories}
            />

            {/* Breadcrumb Navigation & View Mode Switcher */}
            <CategoryFolderBreadcrumb
                resourceTitle="Materi Pelatihan"
                categoryName={activeCategory?.name}
                categoryCode={activeCategory?.code}
                categoryColor={activeCategory?.color}
                isUncategorized={activeCategoryParam === 'uncategorized'}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onBackToFolders={handleBackToFolders}
                totalCategoryItems={activeCategoryParam ? totalItems : undefined}
                itemLabel="materi"
            />

            {/* LEVEL 1: FOLDER EXPLORER VIEW */}
            {isFolderRoot ? (
                <div className="space-y-6">
                    {/* Folder Search and Filter Bar */}
                    <LearningFilterBar
                        search={folderSearch}
                        onSearchChange={setFolderSearch}
                        searchPlaceholder="Cari folder kategori atau kode..."
                        filters={[]}
                        sort={folderSort}
                        onSortChange={setFolderSort}
                        sortOptions={FOLDER_SORT_OPTIONS}
                        onReset={() => {
                            setFolderSearch('');
                            setFolderSort('name_asc');
                        }}
                        totalItems={filteredFolders.length + (uncategorizedCount > 0 ? 1 : 0)}
                        itemLabel="kategori"
                    />

                    {isLoadingCategories ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[0, 1, 2, 3, 4, 5].map((item) => (
                                <Skeleton key={item} className="h-44 rounded-xl" />
                            ))}
                        </div>
                    ) : filteredFolders.length === 0 && uncategorizedCount === 0 ? (
                        <div className="rounded-xl border border-dashed px-6 py-14 text-center bg-card/40">
                            <Folder className="mx-auto size-10 text-muted-foreground/40" />
                            <h2 className="mt-4 font-semibold text-foreground">Tidak ada folder kategori</h2>
                            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                                {folderSearch
                                    ? 'Tidak ditemukan folder kategori dengan kata kunci tersebut. Coba ganti kata kunci pencarian.'
                                    : 'Belum ada kategori pembelajaran yang dibuat. Hubungi Administrator untuk membuat kategori baru.'}
                            </p>
                            {folderSearch && (
                                <Button
                                    variant="outline"
                                    onClick={() => setFolderSearch('')}
                                    className="mt-4"
                                >
                                    <RotateCcw className="size-4 mr-1.5" /> Reset Pencarian
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredFolders.map((cat) => (
                                <CategoryFolderCard
                                    key={cat.id}
                                    id={cat.id}
                                    name={cat.name}
                                    code={cat.code}
                                    description={cat.description}
                                    color={cat.color}
                                    isActive={cat.is_active}
                                    itemCount={cat.training_count || 0}
                                    resourceType="training"
                                    onOpen={handleOpenFolder}
                                />
                            ))}

                            {/* Uncategorized Folder Card if items exist */}
                            {uncategorizedCount > 0 && !folderSearch && (
                                <CategoryFolderCard
                                    id="uncategorized"
                                    name="Tanpa Kategori"
                                    code="UNCAT"
                                    description="Materi pelatihan yang belum dimasukkan ke kategori spesifik."
                                    color="#64748b"
                                    isActive={true}
                                    itemCount={uncategorizedCount}
                                    resourceType="training"
                                    isUncategorized={true}
                                    onOpen={handleOpenFolder}
                                />
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* LEVEL 2: INSIDE CATEGORY FOLDER OR "ALL DATA" VIEW */
                <div className="space-y-6">
                    {/* Active Category Header Card if inside a folder */}
                    {activeCategory && viewMode === 'folder' && (
                        <div
                            className="relative overflow-hidden rounded-xl border border-border/70 bg-card/80 p-4 sm:p-5 backdrop-blur-xs shadow-2xs space-y-3"
                        >
                            <div
                                className="absolute left-0 top-0 bottom-0 w-1.5"
                                style={{ backgroundColor: activeCategory.color || '#0ea5e9' }}
                            />
                            <div className="flex flex-wrap items-center justify-between gap-3 pl-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider border shadow-2xs"
                                            style={{
                                                backgroundColor: `${activeCategory.color || '#0ea5e9'}15`,
                                                color: activeCategory.color || '#0ea5e9',
                                                borderColor: `${activeCategory.color || '#0ea5e9'}30`,
                                            }}
                                        >
                                            {activeCategory.code}
                                        </span>
                                        <h2 className="text-lg font-bold text-foreground">
                                            {activeCategory.name}
                                        </h2>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {activeCategory.description || 'Tidak ada deskripsi cakupan.'}
                                    </p>
                                </div>

                                {userRole === 'admin' && (
                                    <Link
                                        href={`/admin/content/new?category_id=${activeCategory.id}`}
                                        className={cn(buttonVariants({ size: 'sm' }), 'rounded-lg')}
                                    >
                                        <Plus className="size-4 mr-1.5" />
                                        Buat Materi di Kategori Ini
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Filter Bar */}
                    <LearningFilterBar
                        search={search}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder="Cari judul materi..."
                        filters={filterConfigs}
                        sort={sort}
                        onSortChange={handleSortChange}
                        sortOptions={SORT_OPTIONS}
                        onReset={handleReset}
                        totalItems={totalItems}
                        itemLabel="materi"
                    />

                    {error && (
                        <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                            <AlertCircle className="mt-0.5 size-5 shrink-0" />
                            <div>
                                <h2 className="text-sm font-medium">Materi tidak dapat dimuat</h2>
                                <p className="mt-1 text-sm opacity-80">{error}</p>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {[0, 1, 2, 3].map((item) => (
                                <Skeleton key={item} className="h-60 rounded-lg" />
                            ))}
                        </div>
                    ) : trainings.length === 0 ? (
                        isFilterActive ? (
                            <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                                <FileText className="mx-auto size-9 text-muted-foreground/50" />
                                <h2 className="mt-4 font-medium">Tidak ada materi yang cocok</h2>
                                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                                    Pencarian atau filter yang Anda gunakan tidak menemukan hasil. Coba ganti kata kunci atau reset filter.
                                </p>
                                <Button variant="outline" onClick={handleReset} className="mt-5">
                                    <RotateCcw className="size-4 mr-1.5" /> Reset Filter
                                </Button>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                                <FileText className="mx-auto size-9 text-muted-foreground/50" />
                                <h2 className="mt-4 font-medium">
                                    {activeCategory ? `Folder "${activeCategory.name}" masih kosong` : 'Belum ada materi pelatihan'}
                                </h2>
                                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                                    {userRole === 'trainer'
                                        ? 'Belum ada materi dalam kategori ini yang ditugaskan kepada Anda.'
                                        : 'Mulai buat materi baru dengan teks kaya dan lampiran video atau dokumen.'}
                                </p>
                                {userRole === 'admin' && (
                                    <Link
                                        href={
                                            activeCategoryParam
                                                ? `/admin/content/new?category_id=${activeCategoryParam}`
                                                : '/admin/content/new'
                                        }
                                        className={cn(buttonVariants(), 'mt-5')}
                                    >
                                        <Plus className="size-4 mr-1.5" /> Buat Materi Pertama
                                    </Link>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {trainings.map((training) => (
                                <Card
                                    key={training.id}
                                    className="flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                                >
                                    <CardHeader className="space-y-3 p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {/* Category Badge */}
                                                {training.category_code && (
                                                    <span
                                                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider"
                                                        style={{
                                                            backgroundColor: `${training.category_color || '#0ea5e9'}18`,
                                                            color: training.category_color || '#0ea5e9',
                                                        }}
                                                    >
                                                        {training.category_code}
                                                    </span>
                                                )}
                                                <Badge variant="outline" className="rounded-md text-[11px] font-normal">
                                                    <FileText className="size-3 mr-1" /> Materi
                                                </Badge>
                                                {Number(training.media_count) > 0 ? (
                                                    <Badge
                                                        variant="secondary"
                                                        className="rounded-md text-xs font-normal border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                                    >
                                                        {training.media_count} Media
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="rounded-md text-[11px] font-normal text-muted-foreground"
                                                    >
                                                        Teks Saja
                                                    </Badge>
                                                )}
                                                {Number(training.module_count) > 0 ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px]"
                                                    >
                                                        {training.module_count} Modul
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="rounded-md border-slate-200 text-slate-500 dark:border-slate-800 text-[11px]"
                                                    >
                                                        Standalone
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                                <CalendarDays className="size-3.5" /> {formatDate(training.created_at)}
                                            </span>
                                        </div>
                                        <div>
                                            <CardTitle className="line-clamp-2 text-lg font-semibold leading-6">
                                                {training.title}
                                            </CardTitle>
                                            <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                                                <Tag size={12} className="text-muted-foreground/70" />
                                                <span>Kategori: {training.category_name || 'Umum'}</span>
                                            </p>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="border-t px-5 py-4">
                                        <dl className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <dt className="text-xs text-muted-foreground">Status Lampiran</dt>
                                                <dd className="mt-1 font-medium">
                                                    {Number(training.media_count) > 0
                                                        ? `${training.media_count} berkas lampiran`
                                                        : 'Tanpa lampiran'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">Dibuat pada</dt>
                                                <dd className="mt-1 font-medium">
                                                    {formatDate(training.created_at)}
                                                </dd>
                                            </div>
                                        </dl>
                                    </CardContent>

                                    <CardFooter className="justify-between gap-3 rounded-b-lg border-t bg-muted/30 px-5 py-3">
                                        <Link
                                            href={`/admin/content/${training.id}`}
                                            className={buttonVariants({ variant: 'outline', size: 'sm' })}
                                        >
                                            <Eye className="size-4 mr-1.5" /> Lihat materi
                                        </Link>
                                        {userRole === 'admin' && (
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/admin/content/${training.id}/edit`}
                                                    className={buttonVariants({ variant: 'outline', size: 'icon' })}
                                                    aria-label={`Edit materi ${training.title}`}
                                                    title="Edit materi"
                                                >
                                                    <Pencil size={15} />
                                                </Link>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    onClick={() => deleteTraining(training.id, training.title)}
                                                    aria-label={`Hapus materi ${training.title}`}
                                                    title="Hapus materi"
                                                >
                                                    <Trash2 size={15} />
                                                </Button>
                                            </div>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}

                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                    />
                </div>
            )}
        </div>
    );
}

export default function ContentManagerPage() {
    return (
        <Suspense fallback={<div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>}>
            <ContentManagerContent />
        </Suspense>
    );
}
