'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { ManagementPageHeader } from '@/components/admin/ManagementPageHeader';
import {
    LearningFilterBar,
    FilterItemConfig,
    SortOption,
} from '@/components/admin/LearningFilterBar';
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
}

const SORT_OPTIONS: SortOption[] = [
    { label: 'Terbaru Dibuat', value: 'created_desc' },
    { label: 'Terlama Dibuat', value: 'created_asc' },
    { label: 'Judul (A - Z)', value: 'title_asc' },
    { label: 'Judul (Z - A)', value: 'title_desc' },
    { label: 'Terakhir Diperbarui', value: 'updated_desc' },
];

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function ContentManagerPage() {
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [userRole, setUserRole] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Search, Filter, Sort States
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [mediaType, setMediaType] = useState('all');
    const [usage, setUsage] = useState('all');
    const [sort, setSort] = useState('created_desc');

    const { confirm, ConfirmComponent } = useConfirm();

    // Fetch accessible categories for filter dropdown
    useEffect(() => {
        fetch('/api/admin/categories?all=true')
            .then((res) => res.json())
            .then((data) => {
                if (data.success && Array.isArray(data.data)) {
                    setCategories(data.data);
                }
            })
            .catch(() => undefined);
    }, []);

    const fetchTrainings = useCallback(
        async (
            targetPage: number,
            limit: number,
            currentSearch = search,
            currentCategory = category,
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
        [search, category, mediaType, usage, sort]
    );

    useEffect(() => {
        fetchTrainings(page, pageSize);
    }, [page, pageSize, fetchTrainings]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((response) => response.json())
            .then((body) => {
                if (body.success) setUserRole(body.data.role);
            })
            .catch(() => undefined);
    }, []);

    const handleSearchChange = (newSearch: string) => {
        setSearch(newSearch);
        setPage(1);
    };

    const handleCategoryChange = (newCategory: string) => {
        setCategory(newCategory);
        setPage(1);
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
        setCategory('all');
        setMediaType('all');
        setUsage('all');
        setSort('created_desc');
        setPage(1);
    };

    const isFilterActive =
        search.trim() !== '' ||
        category !== 'all' ||
        mediaType !== 'all' ||
        usage !== 'all' ||
        sort !== 'created_desc';

    const filterConfigs: FilterItemConfig[] = [
        {
            id: 'category',
            label: 'Kategori',
            value: category,
            onChange: handleCategoryChange,
            options: [
                { label: 'Semua Kategori', value: 'all' },
                ...categories.map((c) => ({
                    label: `${c.name} (${c.code})`,
                    value: c.id,
                })),
            ],
        },
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
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menghapus materi');
        }
    };

    return (
        <div className="relative max-w-6xl space-y-6 pb-12">
            <ConfirmComponent />
            <ManagementPageHeader
                title="Materi Pelatihan"
                description={
                    userRole === 'trainer'
                        ? 'Daftar bahan pembelajaran, artikel, video, dan materi yang ditugaskan kepada Anda.'
                        : 'Kelola bacaan, artikel, video, dan bahan pembelajaran yang akan digunakan dalam modul.'
                }
                icon={<BookOpen className="size-7" />}
                actionLabel={userRole === 'admin' ? 'Buat Materi Baru' : undefined}
                actionHref={userRole === 'admin' ? '/admin/content/new' : undefined}
                onRefresh={() => fetchTrainings(page, pageSize)}
                isRefreshing={isLoading}
            />

            {/* Filter Bar */}
            <LearningFilterBar
                search={search}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Cari judul materi atau kode kategori..."
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
                    {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-60 rounded-lg" />)}
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
                        <h2 className="mt-4 font-medium">Belum ada materi pelatihan</h2>
                        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                            {userRole === 'trainer'
                                ? 'Belum ada materi yang ditugaskan oleh Administrator kepada Anda.'
                                : 'Mulai buat materi baru dengan teks kaya dan lampiran video atau dokumen.'}
                        </p>
                        {userRole === 'admin' && (
                            <Link href="/admin/content/new" className={cn(buttonVariants(), 'mt-5')}>
                                <Plus /> Buat Materi Pertama
                            </Link>
                        )}
                    </div>
                )
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {trainings.map((training) => (
                        <Card key={training.id} className="flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-shadow">
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
                                            <Badge variant="secondary" className="rounded-md text-xs font-normal border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                                                {training.media_count} Media
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="rounded-md text-[11px] font-normal text-muted-foreground">
                                                Teks Saja
                                            </Badge>
                                        )}
                                        {Number(training.module_count) > 0 ? (
                                            <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px]">
                                                {training.module_count} Modul
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="rounded-md border-slate-200 text-slate-500 dark:border-slate-800 text-[11px]">
                                                Standalone
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                        <CalendarDays className="size-3.5" /> {formatDate(training.created_at)}
                                    </span>
                                </div>
                                <div>
                                    <CardTitle className="line-clamp-2 text-lg font-semibold leading-6">{training.title}</CardTitle>
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
                                            {Number(training.media_count) > 0 ? `${training.media_count} berkas lampiran` : 'Tanpa lampiran'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Dibuat pada</dt>
                                        <dd className="mt-1 font-medium">{formatDate(training.created_at)}</dd>
                                    </div>
                                </dl>
                            </CardContent>

                            <CardFooter className="justify-between gap-3 rounded-b-lg border-t bg-muted/30 px-5 py-3">
                                <Link href={`/admin/content/${training.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
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
    );
}
