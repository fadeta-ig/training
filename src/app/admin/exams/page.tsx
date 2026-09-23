'use client';

import { Suspense, useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertCircle,
    CalendarDays,
    Copy,
    FileQuestion,
    ListChecks,
    Loader2,
    Pencil,
    Plus,
    RotateCcw,
    Target,
    Timer,
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

type Exam = {
    id: string;
    category_id?: string | null;
    category_name?: string | null;
    category_code?: string | null;
    category_color?: string | null;
    title: string;
    duration_minutes: number;
    passing_grade: number;
    allow_remedial?: boolean | number;
    max_attempts?: number;
    remedial_exam_id?: string | null;
    remedial_exam_title?: string | null;
    created_at: string;
    question_count?: number;
    module_count?: number;
    is_remedial_package?: boolean | number;
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
    { label: 'Passing Grade Tertinggi', value: 'passing_grade_desc' },
    { label: 'Passing Grade Terendah', value: 'passing_grade_asc' },
    { label: 'Durasi Terlama', value: 'duration_desc' },
    { label: 'Durasi Tercepat', value: 'duration_asc' },
    { label: 'Jumlah Soal Terbanyak', value: 'questions_desc' },
];

const FOLDER_SORT_OPTIONS: SortOption[] = [
    { label: 'Nama (A - Z)', value: 'name_asc' },
    { label: 'Nama (Z - A)', value: 'name_desc' },
    { label: 'Ujian Terbanyak', value: 'items_desc' },
    { label: 'Terbaru Dibuat', value: 'created_desc' },
];

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function ExamsManagerContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeCategoryParam = searchParams.get('category');

    const [viewMode, setViewMode] = useState<ViewDisplayMode>('folder');
    const [exams, setExams] = useState<Exam[]>([]);
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
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

    // Search, Filter, Sort States for Items
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(activeCategoryParam || 'all');
    const [examType, setExamType] = useState('all');
    const [allowRemedial, setAllowRemedial] = useState('all');
    const [questionStatus, setQuestionStatus] = useState('all');
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
                if (data.uncategorized?.exam_count) {
                    setUncategorizedCount(Number(data.uncategorized.exam_count));
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

    const fetchExams = useCallback(
        async (
            targetPage: number,
            limit: number,
            currentSearch = search,
            currentCategory = activeCategoryParam || categoryFilter,
            currentExamType = examType,
            currentAllowRemedial = allowRemedial,
            currentQuestionStatus = questionStatus,
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
                    exam_type: currentExamType,
                    allow_remedial: currentAllowRemedial,
                    question_status: currentQuestionStatus,
                    sort: currentSort,
                });
                const response = await fetch(`/api/exams?${params.toString()}`);
                if (!response.ok) throw new Error('Gagal mengambil data paket ujian');
                const body = await response.json();
                if (!body.success) throw new Error(body.error || 'Terjadi kesalahan sistem');
                setExams(body.data);
                setTotalPages(body.pagination?.totalPages || 1);
                setTotalItems(body.pagination?.total || body.data.length);
            } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Gagal mengambil data paket ujian');
            } finally {
                setIsLoading(false);
            }
        },
        [search, activeCategoryParam, categoryFilter, examType, allowRemedial, questionStatus, sort]
    );

    useEffect(() => {
        if (activeCategoryParam || viewMode === 'all') {
            fetchExams(page, pageSize);
        }
    }, [page, pageSize, fetchExams, activeCategoryParam, viewMode]);

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
                description: 'Kumpulan paket ujian yang belum dikelompokkan ke dalam kategori program tertentu.',
                is_active: true,
                exam_count: uncategorizedCount,
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
                result.sort((a, b) => (b.exam_count || 0) - (a.exam_count || 0));
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
            router.push(`/admin/exams?category=${newCategory}`);
        }
    };

    const handleExamTypeChange = (newExamType: string) => {
        setExamType(newExamType);
        setPage(1);
    };

    const handleAllowRemedialChange = (newAllow: string) => {
        setAllowRemedial(newAllow);
        setPage(1);
    };

    const handleQuestionStatusChange = (newStatus: string) => {
        setQuestionStatus(newStatus);
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
        setExamType('all');
        setAllowRemedial('all');
        setQuestionStatus('all');
        setSort('created_desc');
        setPage(1);
    };

    const handleOpenFolder = (categoryId: string) => {
        router.push(`/admin/exams?category=${categoryId}`);
    };

    const handleBackToFolders = () => {
        router.push('/admin/exams');
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
        examType !== 'all' ||
        allowRemedial !== 'all' ||
        questionStatus !== 'all' ||
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
            id: 'exam_type',
            label: 'Tipe Paket',
            value: examType,
            onChange: handleExamTypeChange,
            options: [
                { label: 'Semua Tipe', value: 'all' },
                { label: 'Ujian Reguler', value: 'regular' },
                { label: 'Paket Remedial Saja', value: 'remedial' },
            ],
        },
        {
            id: 'allow_remedial',
            label: 'Fitur Remedial',
            value: allowRemedial,
            onChange: handleAllowRemedialChange,
            options: [
                { label: 'Semua Status Remedial', value: 'all' },
                { label: 'Remedial Diaktifkan', value: 'yes' },
                { label: 'Remedial Nonaktif', value: 'no' },
            ],
        },
        {
            id: 'question_status',
            label: 'Ketersediaan Soal',
            value: questionStatus,
            onChange: handleQuestionStatusChange,
            options: [
                { label: 'Semua Status Soal', value: 'all' },
                { label: 'Sudah Ada Soal', value: 'has_questions' },
                { label: 'Belum Ada Soal', value: 'no_questions' },
            ],
        },
    ];

    const duplicateExam = async (id: string, title: string) => {
        const confirmed = await confirm({
            title: `Duplikasi paket ujian "${title}"?`,
            message: 'Seluruh konfigurasi dan seluruh butir bank soal di dalamnya akan diduplikasi menjadi paket baru.',
            confirmLabel: 'Duplikasi ujian',
        });

        if (!confirmed) return;

        setDuplicatingId(id);
        try {
            const response = await fetch(`/api/exams/${id}/duplicate`, { method: 'POST' });
            const body = await response.json();
            if (!response.ok || !body.success) {
                toast.error(body.error || 'Gagal menduplikasi paket ujian');
                return;
            }
            toast.success('Paket ujian berhasil diduplikasi');
            fetchExams(page, pageSize);
            fetchCategories();
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menduplikasi ujian');
        } finally {
            setDuplicatingId(null);
        }
    };

    const deleteExam = async (id: string, title: string) => {
        const confirmed = await confirm({
            title: `Hapus ujian "${title}"?`,
            message: 'Ujian yang sudah dihapus tidak dapat dipulihkan. Pastikan ujian ini tidak lagi digunakan dalam modul atau sesi aktif.',
            confirmLabel: 'Hapus ujian',
            isDestructive: true,
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
            const body = await response.json();
            if (!response.ok || !body.success) {
                toast.error(body.error || 'Gagal menghapus ujian');
                return;
            }
            toast.success('Ujian berhasil dihapus');
            fetchExams(page, pageSize);
            fetchCategories();
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menghapus ujian');
        }
    };

    const isFolderRoot = viewMode === 'folder' && !activeCategoryParam;

    return (
        <div className="relative max-w-6xl space-y-6 pb-12">
            <ConfirmComponent />

            <ManagementPageHeader
                title="Bank Soal & Ujian"
                description={
                    isFolderRoot
                        ? 'Pilih folder kategori program untuk melihat, merancang, atau mengelola paket evaluasi belajar di dalamnya.'
                        : userRole === 'trainer'
                        ? 'Daftar bank soal dan konfigurasi ujian yang ditugaskan kepada Anda.'
                        : 'Kelola paket evaluasi, batas waktu, passing grade, dan bank butir soal yang siap diujikan.'
                }
                icon={<FileQuestion className="size-7" />}
                actionLabel={userRole === 'admin' ? 'Buat Ujian Baru' : undefined}
                actionHref={
                    userRole === 'admin'
                        ? activeCategoryParam
                            ? `/admin/exams/new?category_id=${activeCategoryParam}`
                            : '/admin/exams/new'
                        : undefined
                }
                onRefresh={() => {
                    fetchCategories();
                    if (!isFolderRoot) {
                        fetchExams(page, pageSize);
                    }
                }}
                isRefreshing={isLoading || isLoadingCategories}
            />

            {/* Breadcrumb Navigation & View Mode Switcher */}
            <CategoryFolderBreadcrumb
                resourceTitle="Paket Ujian"
                categoryName={activeCategory?.name}
                categoryCode={activeCategory?.code}
                categoryColor={activeCategory?.color}
                isUncategorized={activeCategoryParam === 'uncategorized'}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onBackToFolders={handleBackToFolders}
                totalCategoryItems={activeCategoryParam ? totalItems : undefined}
                itemLabel="ujian"
            />

            {/* LEVEL 1: FOLDER EXPLORER VIEW */}
            {isFolderRoot ? (
                <div className="space-y-6">
                    {/* Folder Search and Filter Bar */}
                    <LearningFilterBar
                        search={folderSearch}
                        onSearchChange={setFolderSearch}
                        searchPlaceholder="Cari folder kategori atau kode ujian..."
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
                                    itemCount={cat.exam_count || 0}
                                    resourceType="exam"
                                    onOpen={handleOpenFolder}
                                />
                            ))}

                            {/* Uncategorized Folder Card if items exist */}
                            {uncategorizedCount > 0 && !folderSearch && (
                                <CategoryFolderCard
                                    id="uncategorized"
                                    name="Tanpa Kategori"
                                    code="UNCAT"
                                    description="Paket ujian yang belum dikaitkan dengan kategori program tertentu."
                                    color="#64748b"
                                    isActive={true}
                                    itemCount={uncategorizedCount}
                                    resourceType="exam"
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
                                        href={`/admin/exams/new?category_id=${activeCategory.id}`}
                                        className={cn(buttonVariants({ size: 'sm' }), 'rounded-lg')}
                                    >
                                        <Plus className="size-4 mr-1.5" />
                                        Buat Ujian di Kategori Ini
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Filter Bar */}
                    <LearningFilterBar
                        search={search}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder="Cari judul ujian..."
                        filters={filterConfigs}
                        sort={sort}
                        onSortChange={handleSortChange}
                        sortOptions={SORT_OPTIONS}
                        onReset={handleReset}
                        totalItems={totalItems}
                        itemLabel="ujian"
                    />

                    {error && (
                        <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                            <AlertCircle className="mt-0.5 size-5 shrink-0" />
                            <div>
                                <h2 className="text-sm font-medium">Ujian tidak dapat dimuat</h2>
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
                    ) : exams.length === 0 ? (
                        isFilterActive ? (
                            <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                                <FileQuestion className="mx-auto size-9 text-muted-foreground/50" />
                                <h2 className="mt-4 font-medium">Tidak ada ujian yang cocok</h2>
                                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                                    Pencarian atau filter yang Anda gunakan tidak menemukan hasil. Coba ganti kata kunci atau reset filter.
                                </p>
                                <Button variant="outline" onClick={handleReset} className="mt-5">
                                    <RotateCcw className="size-4 mr-1.5" /> Reset Filter
                                </Button>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                                <FileQuestion className="mx-auto size-9 text-muted-foreground/50" />
                                <h2 className="mt-4 font-medium">
                                    {activeCategory ? `Folder "${activeCategory.name}" belum memiliki paket ujian` : 'Belum ada paket ujian'}
                                </h2>
                                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                                    {userRole === 'trainer'
                                        ? 'Belum ada paket ujian dalam kategori ini yang ditugaskan kepada Anda.'
                                        : 'Mulai rancang evaluasi belajar dengan menentukan durasi, passing grade, dan butir soal.'}
                                </p>
                                {userRole === 'admin' && (
                                    <Link
                                        href={
                                            activeCategoryParam
                                                ? `/admin/exams/new?category_id=${activeCategoryParam}`
                                                : '/admin/exams/new'
                                        }
                                        className={cn(buttonVariants(), 'mt-5')}
                                    >
                                        <Plus className="size-4 mr-1.5" /> Buat Ujian Pertama
                                    </Link>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {exams.map((exam) => (
                                <Card
                                    key={exam.id}
                                    className="flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                                >
                                    <CardHeader className="space-y-3 p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {/* Category Badge */}
                                                {exam.category_code && (
                                                    <span
                                                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider"
                                                        style={{
                                                            backgroundColor: `${exam.category_color || '#0ea5e9'}18`,
                                                            color: exam.category_color || '#0ea5e9',
                                                        }}
                                                    >
                                                        {exam.category_code}
                                                    </span>
                                                )}
                                                {Boolean(exam.is_remedial_package) ? (
                                                    <Badge
                                                        variant="secondary"
                                                        className="rounded-md border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[11px]"
                                                    >
                                                        Paket Remedial
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="rounded-md text-[11px] font-normal">
                                                        Ujian Reguler
                                                    </Badge>
                                                )}
                                                <Badge variant="outline" className="rounded-md text-[11px] font-normal">
                                                    {exam.question_count || 0} Soal
                                                </Badge>
                                                {Boolean(exam.allow_remedial) && (
                                                    <Badge
                                                        variant="outline"
                                                        className="rounded-md border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-[11px]"
                                                    >
                                                        Remedial Aktif
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                                <CalendarDays className="size-3.5" /> {formatDate(exam.created_at)}
                                            </span>
                                        </div>
                                        <div>
                                            <CardTitle className="line-clamp-2 text-lg font-semibold leading-6">
                                                {exam.title}
                                            </CardTitle>
                                            <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                                                <Tag size={12} className="text-muted-foreground/70" />
                                                <span>Kategori: {exam.category_name || 'Umum'}</span>
                                            </p>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="border-t px-5 py-4">
                                        <dl className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Timer className="size-3.5" /> Durasi ujian
                                                </dt>
                                                <dd className="mt-1 font-medium tabular-nums">{exam.duration_minutes} menit</dd>
                                            </div>
                                            <div>
                                                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Target className="size-3.5" /> Nilai kelulusan
                                                </dt>
                                                <dd className="mt-1 font-medium tabular-nums">{Number(exam.passing_grade).toLocaleString('id-ID')}%</dd>
                                            </div>
                                        </dl>
                                    </CardContent>

                                    <CardFooter className="justify-between gap-3 rounded-b-lg border-t bg-muted/30 px-5 py-3">
                                        <Link
                                            href={`/admin/exams/${exam.id}/questions`}
                                            className={buttonVariants({ size: 'sm' })}
                                        >
                                            <ListChecks className="size-4 mr-1.5" /> {userRole === 'admin' ? 'Kelola bank soal' : 'Lihat bank soal'}
                                        </Link>
                                        {userRole === 'admin' && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => duplicateExam(exam.id, exam.title)}
                                                    disabled={duplicatingId === exam.id}
                                                    aria-label={`Duplikasi ujian ${exam.title}`}
                                                    title="Duplikasi ujian beserta seluruh bank soal"
                                                >
                                                    {duplicatingId === exam.id ? (
                                                        <Loader2 className="size-4 animate-spin text-blue-600" />
                                                    ) : (
                                                        <Copy className="size-4" />
                                                    )}
                                                </Button>
                                                <Link
                                                    href={`/admin/exams/${exam.id}/edit`}
                                                    className={buttonVariants({ variant: 'outline', size: 'icon' })}
                                                    aria-label={`Edit ujian ${exam.title}`}
                                                    title="Edit parameter ujian"
                                                >
                                                    <Pencil size={15} />
                                                </Link>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    onClick={() => deleteExam(exam.id, exam.title)}
                                                    aria-label={`Hapus ujian ${exam.title}`}
                                                    title="Hapus ujian"
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

export default function ExamsManagerPage() {
    return (
        <Suspense fallback={<div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>}>
            <ExamsManagerContent />
        </Suspense>
    );
}
