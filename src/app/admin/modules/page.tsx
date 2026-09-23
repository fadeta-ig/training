'use client';

import { Suspense, useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertCircle,
    Boxes,
    CalendarDays,
    Download,
    Eye,
    Layers,
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
import { ModuleDownloadDialog } from '@/components/admin/ModuleDownloadDialog';

type LearningModule = {
    id: string;
    category_id?: string | null;
    category_name?: string | null;
    category_code?: string | null;
    category_color?: string | null;
    title: string;
    description: string | null;
    enforce_sequence: boolean;
    created_at: string;
    item_count?: number;
    training_count?: number;
    exam_count?: number;
    session_count?: number;
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
    { label: 'Jumlah Item Terbanyak', value: 'items_desc' },
];

const FOLDER_SORT_OPTIONS: SortOption[] = [
    { label: 'Nama (A - Z)', value: 'name_asc' },
    { label: 'Nama (Z - A)', value: 'name_desc' },
    { label: 'Modul Terbanyak', value: 'items_desc' },
    { label: 'Terbaru Dibuat', value: 'created_desc' },
];

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function ModulesManagerContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeCategoryParam = searchParams.get('category');

    const [viewMode, setViewMode] = useState<ViewDisplayMode>('folder');
    const [modules, setModules] = useState<LearningModule[]>([]);
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
    const [selectedModuleForDownload, setSelectedModuleForDownload] = useState<{ id: string; title: string } | null>(null);

    // Search, Filter, Sort States for Items
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(activeCategoryParam || 'all');
    const [sequence, setSequence] = useState('all');
    const [composition, setComposition] = useState('all');
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
                if (data.uncategorized?.module_count) {
                    setUncategorizedCount(Number(data.uncategorized.module_count));
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

    const fetchModules = useCallback(
        async (
            targetPage: number,
            limit: number,
            currentSearch = search,
            currentCategory = activeCategoryParam || categoryFilter,
            currentSequence = sequence,
            currentComposition = composition,
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
                    sequence: currentSequence,
                    composition: currentComposition,
                    sort: currentSort,
                });
                const response = await fetch(`/api/modules?${params.toString()}`);
                if (!response.ok) throw new Error('Gagal mengambil data modul');
                const body = await response.json();
                if (!body.success) throw new Error(body.error || 'Terjadi kesalahan server');
                setModules(body.data);
                setTotalPages(body.pagination?.totalPages || 1);
                setTotalItems(body.pagination?.total || body.data.length);
            } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Gagal mengambil data modul');
            } finally {
                setIsLoading(false);
            }
        },
        [search, activeCategoryParam, categoryFilter, sequence, composition, sort]
    );

    useEffect(() => {
        if (activeCategoryParam || viewMode === 'all') {
            fetchModules(page, pageSize);
        }
    }, [page, pageSize, fetchModules, activeCategoryParam, viewMode]);

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
                description: 'Kumpulan modul pelatihan yang belum dikelompokkan ke dalam kategori khusus.',
                is_active: true,
                module_count: uncategorizedCount,
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
                result.sort((a, b) => (b.module_count || 0) - (a.module_count || 0));
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
            router.push(`/admin/modules?category=${newCategory}`);
        }
    };

    const handleSequenceChange = (newSequence: string) => {
        setSequence(newSequence);
        setPage(1);
    };

    const handleCompositionChange = (newComposition: string) => {
        setComposition(newComposition);
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
        setSequence('all');
        setComposition('all');
        setSort('created_desc');
        setPage(1);
    };

    const handleOpenFolder = (categoryId: string) => {
        router.push(`/admin/modules?category=${categoryId}`);
    };

    const handleBackToFolders = () => {
        router.push('/admin/modules');
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
        sequence !== 'all' ||
        composition !== 'all' ||
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
            id: 'sequence',
            label: 'Aturan Urutan',
            value: sequence,
            onChange: handleSequenceChange,
            options: [
                { label: 'Semua Aturan Urutan', value: 'all' },
                { label: 'Wajib Urut (Sekuensial)', value: 'enforced' },
                { label: 'Urutan Bebas (Akses Langsung)', value: 'free' },
            ],
        },
        {
            id: 'composition',
            label: 'Komposisi Item',
            value: composition,
            onChange: handleCompositionChange,
            options: [
                { label: 'Semua Komposisi', value: 'all' },
                { label: 'Lengkap (Materi + Ujian)', value: 'complete' },
                { label: 'Hanya Materi Pelatihan', value: 'training_only' },
                { label: 'Hanya Paket Ujian', value: 'exam_only' },
                { label: 'Modul Kosong', value: 'empty' },
            ],
        },
    ];

    const deleteModule = async (id: string, title: string) => {
        const confirmed = await confirm({
            title: `Hapus modul "${title}"?`,
            message: 'Modul yang sudah dihapus tidak dapat dipulihkan. Pastikan modul ini tidak lagi digunakan dalam sesi aktif.',
            confirmLabel: 'Hapus modul',
            isDestructive: true,
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/modules/${id}`, { method: 'DELETE' });
            const body = await response.json();
            if (!response.ok || !body.success) {
                toast.error(body.error || 'Gagal menghapus modul');
                return;
            }
            toast.success('Modul berhasil dihapus');
            fetchModules(page, pageSize);
            fetchCategories();
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menghapus modul');
        }
    };

    const isFolderRoot = viewMode === 'folder' && !activeCategoryParam;

    return (
        <div className="relative max-w-6xl space-y-6 pb-12">
            <ConfirmComponent />

            <ManagementPageHeader
                title="Modul Pelatihan"
                description={
                    isFolderRoot
                        ? 'Pilih folder kategori program untuk melihat, merakit, atau mengelola modul alur pembelajaran terstruktur.'
                        : userRole === 'trainer'
                        ? 'Daftar alur pembelajaran terstruktur yang ditugaskan kepada Anda.'
                        : 'Susun alur pembelajaran terstruktur yang menggabungkan materi bacaan dan ujian evaluasi.'
                }
                icon={<Boxes className="size-7" />}
                actionLabel={userRole === 'admin' ? 'Buat Modul Baru' : undefined}
                actionHref={
                    userRole === 'admin'
                        ? activeCategoryParam
                            ? `/admin/modules/new?category_id=${activeCategoryParam}`
                            : '/admin/modules/new'
                        : undefined
                }
                onRefresh={() => {
                    fetchCategories();
                    if (!isFolderRoot) {
                        fetchModules(page, pageSize);
                    }
                }}
                isRefreshing={isLoading || isLoadingCategories}
            />

            {/* Breadcrumb Navigation & View Mode Switcher */}
            <CategoryFolderBreadcrumb
                resourceTitle="Modul Pelatihan"
                categoryName={activeCategory?.name}
                categoryCode={activeCategory?.code}
                categoryColor={activeCategory?.color}
                isUncategorized={activeCategoryParam === 'uncategorized'}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onBackToFolders={handleBackToFolders}
                totalCategoryItems={activeCategoryParam ? totalItems : undefined}
                itemLabel="modul"
            />

            {/* LEVEL 1: FOLDER EXPLORER VIEW */}
            {isFolderRoot ? (
                <div className="space-y-6">
                    {/* Folder Search and Filter Bar */}
                    <LearningFilterBar
                        search={folderSearch}
                        onSearchChange={setFolderSearch}
                        searchPlaceholder="Cari folder kategori atau kode modul..."
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
                                    : 'Belum ada kategori program yang tersedia. Silakan hubungi Administrator.'}
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
                                    itemCount={cat.module_count || 0}
                                    resourceType="module"
                                    onOpen={handleOpenFolder}
                                />
                            ))}

                            {/* Uncategorized Folder Card if items exist */}
                            {uncategorizedCount > 0 && !folderSearch && (
                                <CategoryFolderCard
                                    id="uncategorized"
                                    name="Tanpa Kategori"
                                    code="UNCAT"
                                    description="Modul pelatihan yang belum dikaitkan dengan kategori program tertentu."
                                    color="#64748b"
                                    isActive={true}
                                    itemCount={uncategorizedCount}
                                    resourceType="module"
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
                        <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card/80 p-4 sm:p-5 backdrop-blur-xs shadow-2xs space-y-3">
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
                                        href={`/admin/modules/new?category_id=${activeCategory.id}`}
                                        className={cn(buttonVariants({ size: 'sm' }), 'rounded-lg')}
                                    >
                                        <Plus className="size-4 mr-1.5" />
                                        Buat Modul di Kategori Ini
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Filter Bar */}
                    <LearningFilterBar
                        search={search}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder="Cari judul modul..."
                        filters={filterConfigs}
                        sort={sort}
                        onSortChange={handleSortChange}
                        sortOptions={SORT_OPTIONS}
                        onReset={handleReset}
                        totalItems={totalItems}
                        itemLabel="modul"
                    />

                    {error && (
                        <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                            <AlertCircle className="mt-0.5 size-5 shrink-0" />
                            <div>
                                <h2 className="text-sm font-medium">Modul tidak dapat dimuat</h2>
                                <p className="mt-1 text-sm opacity-80">{error}</p>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {[0, 1, 2, 3].map((item) => (
                                <Skeleton key={item} className="h-64 rounded-lg" />
                            ))}
                        </div>
                    ) : modules.length === 0 ? (
                        isFilterActive ? (
                            <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                                <Layers className="mx-auto size-9 text-muted-foreground/50" />
                                <h2 className="mt-4 font-medium">Tidak ada modul yang cocok</h2>
                                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                                    Pencarian atau filter yang Anda gunakan tidak menemukan hasil. Coba ganti kata kunci atau reset filter.
                                </p>
                                <Button variant="outline" onClick={handleReset} className="mt-5">
                                    <RotateCcw className="size-4 mr-1.5" /> Reset Filter
                                </Button>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                                <Layers className="mx-auto size-9 text-muted-foreground/50" />
                                <h2 className="mt-4 font-medium">
                                    {activeCategory ? `Folder "${activeCategory.name}" belum memiliki modul` : 'Belum ada modul pelatihan'}
                                </h2>
                                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                                    {userRole === 'trainer'
                                        ? 'Belum ada alur modul pelatihan dalam kategori ini yang ditugaskan kepada Anda.'
                                        : 'Mulai gabungkan materi dan bank soal ke dalam alur terstruktur untuk peserta.'}
                                </p>
                                {userRole === 'admin' && (
                                    <Link
                                        href={
                                            activeCategoryParam
                                                ? `/admin/modules/new?category_id=${activeCategoryParam}`
                                                : '/admin/modules/new'
                                        }
                                        className={cn(buttonVariants(), 'mt-5')}
                                    >
                                        <Plus className="size-4 mr-1.5" /> Buat Modul Pertama
                                    </Link>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {modules.map((module) => (
                                <Card
                                    key={module.id}
                                    className="flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                                >
                                    <CardHeader className="space-y-3 p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {/* Category Badge */}
                                                {module.category_code && (
                                                    <span
                                                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider"
                                                        style={{
                                                            backgroundColor: `${module.category_color || '#0ea5e9'}18`,
                                                            color: module.category_color || '#0ea5e9',
                                                        }}
                                                    >
                                                        {module.category_code}
                                                    </span>
                                                )}
                                                <Badge variant="outline" className="rounded-md text-[11px] font-normal">
                                                    {module.item_count || 0} Total Item
                                                </Badge>
                                                <Badge
                                                    variant="secondary"
                                                    className="rounded-md border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-[11px]"
                                                >
                                                    {module.session_count || 0} Sesi
                                                </Badge>
                                                {module.enforce_sequence ? (
                                                    <Badge
                                                        variant="secondary"
                                                        className="rounded-md border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[11px]"
                                                    >
                                                        Urutan Ketat
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="rounded-md border-slate-200 text-slate-500 dark:border-slate-800 text-[11px]"
                                                    >
                                                        Urutan Bebas
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                                <CalendarDays className="size-3.5" /> {formatDate(module.created_at)}
                                            </span>
                                        </div>
                                        <div>
                                            <CardTitle className="line-clamp-2 text-lg font-semibold leading-6">
                                                {module.title}
                                            </CardTitle>
                                            <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                                                <Tag size={12} className="text-muted-foreground/70" />
                                                <span>Kategori: {module.category_name || 'Umum'}</span>
                                            </p>
                                            <p className="mt-2 line-clamp-3 min-h-12 text-sm leading-6 text-muted-foreground">
                                                {module.description ||
                                                    'Belum ada deskripsi. Buka modul untuk melihat dan menyusun urutan pembelajarannya.'}
                                            </p>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="border-t px-5 py-4">
                                        <dl className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <dt className="text-xs text-muted-foreground">Komposisi Item</dt>
                                                <dd className="mt-1 font-medium">
                                                    {Number(module.item_count) > 0
                                                        ? `${module.training_count ?? 0} Materi, ${module.exam_count ?? 0} Ujian`
                                                        : 'Belum ada item'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">Dibuat pada</dt>
                                                <dd className="mt-1 font-medium">{formatDate(module.created_at)}</dd>
                                            </div>
                                        </dl>
                                    </CardContent>

                                    <CardFooter className="justify-between gap-3 rounded-b-lg border-t bg-muted/30 px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/admin/modules/${module.id}`}
                                                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                                            >
                                                <Eye className="size-4 mr-1.5" /> Buka modul
                                            </Link>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() =>
                                                    setSelectedModuleForDownload({
                                                        id: module.id,
                                                        title: module.title,
                                                    })
                                                }
                                                aria-label={`Download modul ${module.title}`}
                                                title="Download paket modul pembelajaran & bank soal"
                                            >
                                                <Download className="size-4" />
                                            </Button>
                                        </div>

                                        {userRole === 'admin' && (
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/admin/modules/${module.id}/edit`}
                                                    className={buttonVariants({ variant: 'outline', size: 'icon' })}
                                                    aria-label={`Edit modul ${module.title}`}
                                                    title="Edit modul"
                                                >
                                                    <Pencil size={15} />
                                                </Link>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    onClick={() => deleteModule(module.id, module.title)}
                                                    aria-label={`Hapus modul ${module.title}`}
                                                    title="Hapus modul"
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

                    {/* Module Download Dialog */}
                    {selectedModuleForDownload && (
                        <ModuleDownloadDialog
                            isOpen={Boolean(selectedModuleForDownload)}
                            onClose={() => setSelectedModuleForDownload(null)}
                            moduleId={selectedModuleForDownload.id}
                            moduleTitle={selectedModuleForDownload.title}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default function ModulesManagerPage() {
    return (
        <Suspense fallback={<div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>}>
            <ModulesManagerContent />
        </Suspense>
    );
}
