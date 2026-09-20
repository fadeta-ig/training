'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
}

const SORT_OPTIONS: SortOption[] = [
    { label: 'Terbaru Dibuat', value: 'created_desc' },
    { label: 'Terlama Dibuat', value: 'created_asc' },
    { label: 'Judul (A - Z)', value: 'title_asc' },
    { label: 'Judul (Z - A)', value: 'title_desc' },
    { label: 'Jumlah Item Terbanyak', value: 'items_desc' },
];

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function ModulesManagerPage() {
    const [modules, setModules] = useState<LearningModule[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [userRole, setUserRole] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [selectedModuleForDownload, setSelectedModuleForDownload] = useState<{ id: string; title: string } | null>(null);

    // Search, Filter, Sort States
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [sequence, setSequence] = useState('all');
    const [composition, setComposition] = useState('all');
    const [sort, setSort] = useState('created_desc');

    const { confirm, ConfirmComponent } = useConfirm();

    // Fetch accessible categories for filter
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

    const fetchModules = useCallback(
        async (
            targetPage: number,
            limit: number,
            currentSearch = search,
            currentCategory = category,
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
        [search, category, sequence, composition, sort]
    );

    useEffect(() => {
        fetchModules(page, pageSize);
    }, [page, pageSize, fetchModules]);

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
        setCategory('all');
        setSequence('all');
        setComposition('all');
        setSort('created_desc');
        setPage(1);
    };

    const isFilterActive =
        search.trim() !== '' ||
        category !== 'all' ||
        sequence !== 'all' ||
        composition !== 'all' ||
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
            id: 'sequence',
            label: 'Aturan Urutan',
            value: sequence,
            onChange: handleSequenceChange,
            options: [
                { label: 'Semua Aturan Urutan', value: 'all' },
                { label: 'Wajib Berurutan', value: 'enforced' },
                { label: 'Urutan Bebas', value: 'free' },
            ],
        },
        {
            id: 'composition',
            label: 'Komposisi Konten',
            value: composition,
            onChange: handleCompositionChange,
            options: [
                { label: 'Semua Komposisi Konten', value: 'all' },
                { label: 'Lengkap (Materi + Ujian)', value: 'complete' },
                { label: 'Materi Saja', value: 'training_only' },
                { label: 'Ujian Saja', value: 'exam_only' },
                { label: 'Belum Ada Item', value: 'empty' },
            ],
        },
    ];

    const deleteModule = async (id: string, title: string) => {
        const confirmed = await confirm({
            title: `Hapus modul "${title}"?`,
            message: 'Modul yang sudah dihapus tidak dapat dipulihkan. Pastikan modul ini tidak lagi digunakan.',
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
        } catch (caught) {
            toast.error(caught instanceof Error ? caught.message : 'Gagal menghapus modul');
        }
    };

    return (
        <div className="relative max-w-6xl space-y-6 pb-12">
            <ConfirmComponent />
            <ManagementPageHeader
                title="Modul Pelatihan"
                description={
                    userRole === 'trainer'
                        ? 'Daftar alur pembelajaran terstruktur yang ditugaskan kepada Anda.'
                        : 'Susun alur pembelajaran terstruktur yang menggabungkan materi bacaan dan ujian evaluasi.'
                }
                icon={<Boxes className="size-7" />}
                actionLabel={userRole === 'admin' ? 'Buat Modul Baru' : undefined}
                actionHref={userRole === 'admin' ? '/admin/modules/new' : undefined}
                onRefresh={() => fetchModules(page, pageSize)}
                isRefreshing={isLoading}
            />

            {/* Filter Bar */}
            <LearningFilterBar
                search={search}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Cari judul modul atau kode kategori..."
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
                    {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-64 rounded-lg" />)}
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
                        <h2 className="mt-4 font-medium">Belum ada modul pelatihan</h2>
                        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                            {userRole === 'trainer'
                                ? 'Belum ada alur modul pelatihan yang ditugaskan oleh Administrator kepada Anda.'
                                : 'Mulai gabungkan materi dan bank soal ke dalam alur terstruktur untuk peserta.'}
                        </p>
                        {userRole === 'admin' && (
                            <Link href="/admin/modules/new" className={cn(buttonVariants(), 'mt-5')}>
                                <Plus /> Buat Modul Pertama
                            </Link>
                        )}
                    </div>
                )
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {modules.map((module) => (
                        <Card key={module.id} className="flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-shadow">
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
                                        <Badge variant="secondary" className="rounded-md border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-[11px]">
                                            {module.session_count || 0} Sesi
                                        </Badge>
                                        {module.enforce_sequence ? (
                                            <Badge variant="secondary" className="rounded-md border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[11px]">
                                                Urutan Ketat
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="rounded-md border-slate-200 text-slate-500 dark:border-slate-800 text-[11px]">
                                                Urutan Bebas
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                        <CalendarDays className="size-3.5" /> {formatDate(module.created_at)}
                                    </span>
                                </div>
                                <div>
                                    <CardTitle className="line-clamp-2 text-lg font-semibold leading-6">{module.title}</CardTitle>
                                    <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Tag size={12} className="text-muted-foreground/70" />
                                        <span>Kategori: {module.category_name || 'Umum'}</span>
                                    </p>
                                    <p className="mt-2 line-clamp-3 min-h-12 text-sm leading-6 text-muted-foreground">
                                        {module.description || 'Belum ada deskripsi. Buka modul untuk melihat dan menyusun urutan pembelajarannya.'}
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
                                    <Link href={`/admin/modules/${module.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                                        <Eye className="size-4 mr-1.5" /> Buka modul
                                    </Link>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setSelectedModuleForDownload({ id: module.id, title: module.title })}
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
    );
}
