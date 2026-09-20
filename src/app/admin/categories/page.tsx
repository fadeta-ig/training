'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    Users,
    BookOpen,
    FileQuestion,
    Boxes,
    AlertCircle,
    Layers,
    Tag,
    LayoutGrid,
    Table as TableIcon,
    CalendarDays,
} from 'lucide-react';
import { ManagementPageHeader } from '@/components/admin/ManagementPageHeader';
import {
    LearningFilterBar,
    FilterItemConfig,
    SortOption,
} from '@/components/admin/LearningFilterBar';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { CategoryFormModal } from './_components/CategoryFormModal';
import { AssignTrainersModal } from './_components/AssignTrainersModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { LearningCategory } from '@/types';

const SORT_OPTIONS: SortOption[] = [
    { label: 'Terbaru Dibuat', value: 'created_desc' },
    { label: 'Terlama Dibuat', value: 'created_asc' },
    { label: 'Nama (A - Z)', value: 'name_asc' },
    { label: 'Nama (Z - A)', value: 'name_desc' },
    { label: 'Trainer Terbanyak', value: 'trainers_desc' },
    { label: 'Konten Terbanyak', value: 'items_desc' },
];

function formatDate(value?: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export default function CategoriesManagerPage() {
    const [categories, setCategories] = useState<LearningCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(9);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // View Mode: 'grid' | 'table'
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // Filter, Search, and Sort States
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sort, setSort] = useState('created_desc');

    // Modals state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<LearningCategory | null>(null);

    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState<{ id: string; name: string } | null>(null);

    const { confirm, ConfirmComponent } = useConfirm();

    const fetchCategories = useCallback(
        async (
            targetPage: number,
            limit: number,
            currentSearch = search,
            currentStatus = statusFilter,
            currentSort = sort
        ) => {
            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    page: String(targetPage),
                    limit: String(limit),
                    search: currentSearch,
                    status: currentStatus,
                    sort: currentSort,
                });
                const res = await fetch(`/api/admin/categories?${params.toString()}`);
                const data = await res.json();

                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Gagal memuat kategori pembelajaran');
                }

                setCategories(data.data || []);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotalItems(data.pagination?.total || 0);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
            } finally {
                setIsLoading(false);
            }
        },
        [search, statusFilter, sort]
    );

    useEffect(() => {
        fetchCategories(page, pageSize, search, statusFilter, sort);
    }, [fetchCategories, page, pageSize, search, statusFilter, sort]);

    const handleSearchChange = (val: string) => {
        setSearch(val);
        setPage(1);
    };

    const handleSortChange = (val: string) => {
        setSort(val);
        setPage(1);
    };

    const handleReset = () => {
        setSearch('');
        setStatusFilter('all');
        setSort('created_desc');
        setPage(1);
    };

    const filterConfigs: FilterItemConfig[] = [
        {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: (val) => {
                setStatusFilter(val);
                setPage(1);
            },
            options: [
                { label: 'Semua Status', value: 'all' },
                { label: 'Aktif Saja', value: 'active' },
                { label: 'Nonaktif Saja', value: 'inactive' },
            ],
        },
    ];

    const isFilterActive = search.trim() !== '' || statusFilter !== 'all' || sort !== 'created_desc';

    const handleDelete = async (cat: LearningCategory) => {
        const confirmed = await confirm({
            title: `Hapus Kategori "${cat.name}"?`,
            message:
                'Pastikan kategori ini tidak lagi menaungi materi, ujian, atau modul aktif. Tindakan ini tidak dapat dibatalkan.',
            confirmLabel: 'Hapus Kategori',
            isDestructive: true,
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
            const data = await res.json();

            if (!res.ok || !data.success) {
                toast.error(data.error || 'Gagal menghapus kategori');
                return;
            }

            toast.success('Kategori berhasil dihapus');
            fetchCategories(page, pageSize);
        } catch {
            toast.error('Terjadi kesalahan saat menghapus kategori');
        }
    };

    return (
        <div className="relative max-w-6xl mx-auto space-y-5 pb-12">
            <ConfirmComponent />

            {/* Page Header */}
            <ManagementPageHeader
                title="Kategori Pembelajaran"
                description="Kelola pengelompokan materi, bank soal, dan modul pelatihan serta tentukan instruktur/trainer yang bertugas."
                icon={<Tag className="size-7" />}
                actionLabel="Tambah Kategori"
                onActionClick={() => {
                    setEditingCategory(null);
                    setIsFormOpen(true);
                }}
                onRefresh={() => fetchCategories(page, pageSize)}
                isRefreshing={isLoading}
            />

            {/* Filter Bar with Inline View Switcher */}
            <LearningFilterBar
                search={search}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Cari nama kategori, kode unik, atau deskripsi..."
                filters={filterConfigs}
                sort={sort}
                onSortChange={handleSortChange}
                sortOptions={SORT_OPTIONS}
                onReset={handleReset}
                totalItems={totalItems}
                itemLabel="kategori"
            >
                {/* Compact View Switcher */}
                <div className="inline-flex items-center p-0.5 rounded-lg border border-border/80 bg-muted/30">
                    <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer',
                            viewMode === 'grid'
                                ? 'bg-background text-foreground shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                        title="Tampilan Grid Kartu"
                    >
                        <LayoutGrid className="size-3.5" />
                        <span>Grid</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer',
                            viewMode === 'table'
                                ? 'bg-background text-foreground shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                        title="Tampilan Tabel Ringkas"
                    >
                        <TableIcon className="size-3.5" />
                        <span>Tabel</span>
                    </button>
                </div>
            </LearningFilterBar>

            {/* Error State */}
            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                    <div>
                        <h2 className="text-sm font-semibold">Data Kategori Tidak Dapat Dimuat</h2>
                        <p className="mt-1 text-sm opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            {isLoading ? (
                viewMode === 'grid' ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-56 rounded-2xl" />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-border/80 p-4 space-y-3 bg-card">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-12 w-full rounded-xl" />
                        ))}
                    </div>
                )
            ) : categories.length === 0 ? (
                /* Empty State */
                <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center bg-card/40">
                    <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground/60 shadow-2xs">
                        <Layers className="size-6" />
                    </div>
                    <h2 className="mt-4 text-base font-bold text-foreground">
                        {isFilterActive ? 'Tidak Ada Kategori yang Cocok' : 'Belum Ada Kategori Pembelajaran'}
                    </h2>
                    <p className="mx-auto mt-1 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {isFilterActive
                            ? 'Pencarian atau filter yang Anda pilih tidak menemukan hasil. Coba ganti kata kunci atau reset filter.'
                            : 'Mulai buat kategori pertama untuk mengelompokkan materi, ujian, dan modul serta menugaskan trainer terkait.'}
                    </p>
                    {isFilterActive ? (
                        <Button variant="outline" onClick={handleReset} className="mt-5 rounded-xl">
                            Reset Filter
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={() => {
                                setEditingCategory(null);
                                setIsFormOpen(true);
                            }}
                            className="mt-5 rounded-xl"
                        >
                            <Plus className="size-4 mr-1.5" />
                            Tambah Kategori Pertama
                        </Button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                /* Grid View (Cards) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((cat) => {
                        const catColor = cat.color || '#0ea5e9';
                        return (
                            <Card
                                key={cat.id}
                                className="group flex flex-col justify-between overflow-hidden border-border/80 shadow-2xs hover:shadow-md hover:border-border transition-all duration-150"
                            >
                                <CardHeader className="p-4 sm:p-5 pb-3 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono uppercase tracking-wider border shadow-2xs"
                                                style={{
                                                    backgroundColor: `${catColor}14`,
                                                    color: catColor,
                                                    borderColor: `${catColor}30`,
                                                }}
                                            >
                                                {cat.code}
                                            </span>
                                            <Badge
                                                variant={cat.is_active ? 'success' : 'secondary'}
                                                className="text-[10px] font-semibold h-5 px-2"
                                            >
                                                {cat.is_active ? 'Aktif' : 'Nonaktif'}
                                            </Badge>
                                        </div>

                                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                                            <CalendarDays className="size-3" />
                                            <span>{formatDate(cat.created_at)}</span>
                                        </span>
                                    </div>

                                    <div>
                                        <CardTitle className="text-base font-semibold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                            {cat.name}
                                        </CardTitle>
                                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 min-h-[2rem] leading-relaxed">
                                            {cat.description || 'Tidak ada deskripsi cakupan.'}
                                        </p>
                                    </div>
                                </CardHeader>

                                <CardContent className="border-t px-4 sm:px-5 py-3 space-y-2.5">
                                    {/* Content Metric Pills */}
                                    <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                                            <dt className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 font-medium">
                                                <BookOpen className="size-3 text-blue-500" />
                                                <span>Materi</span>
                                            </dt>
                                            <dd className="mt-0.5 text-sm font-bold text-foreground">
                                                {cat.training_count || 0}
                                            </dd>
                                        </div>
                                        <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                                            <dt className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 font-medium">
                                                <FileQuestion className="size-3 text-amber-500" />
                                                <span>Ujian</span>
                                            </dt>
                                            <dd className="mt-0.5 text-sm font-bold text-foreground">
                                                {cat.exam_count || 0}
                                            </dd>
                                        </div>
                                        <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                                            <dt className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 font-medium">
                                                <Boxes className="size-3 text-emerald-500" />
                                                <span>Modul</span>
                                            </dt>
                                            <dd className="mt-0.5 text-sm font-bold text-foreground">
                                                {cat.module_count || 0}
                                            </dd>
                                        </div>
                                    </dl>

                                    {/* Assigned Trainer Count */}
                                    <div className="flex items-center justify-between text-xs pt-0.5 px-0.5">
                                        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                                            <Users className="size-3.5 text-primary" />
                                            <span>Pengajar Ditugaskan:</span>
                                        </span>
                                        <Badge variant="outline" className="font-semibold text-foreground text-[11px]">
                                            {cat.trainer_count || 0} Trainer
                                        </Badge>
                                    </div>
                                </CardContent>

                                <CardFooter className="justify-between gap-2 rounded-b-xl border-t bg-muted/30 px-4 sm:px-5 py-2.5">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setAssignTarget({ id: cat.id, name: cat.name });
                                            setIsAssignOpen(true);
                                        }}
                                        className="gap-1.5 rounded-xl text-xs font-semibold h-8 px-3"
                                    >
                                        <Users className="size-3.5 text-primary" />
                                        <span>Kelola Trainer</span>
                                    </Button>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => {
                                                setEditingCategory(cat);
                                                setIsFormOpen(true);
                                            }}
                                            title="Edit Kategori"
                                            className="rounded-lg text-muted-foreground hover:text-foreground"
                                        >
                                            <Pencil className="size-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleDelete(cat)}
                                            title="Hapus Kategori"
                                            className="rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                /* Table View */
                <Card className="overflow-hidden border-border/80 shadow-2xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-border/80 bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                                    <th className="py-3 px-4 sm:px-5">Kategori</th>
                                    <th className="py-3 px-4 hidden md:table-cell">Deskripsi</th>
                                    <th className="py-3 px-4 text-center">Cakupan Konten</th>
                                    <th className="py-3 px-4 text-center">Trainer</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                    <th className="py-3 px-4 sm:px-5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {categories.map((cat) => {
                                    const catColor = cat.color || '#0ea5e9';
                                    return (
                                        <tr
                                            key={cat.id}
                                            className="hover:bg-muted/30 transition-colors group"
                                        >
                                            <td className="py-3 px-4 sm:px-5">
                                                <div className="flex items-center gap-2.5">
                                                    <div
                                                        className="size-2.5 rounded-full shrink-0 shadow-xs"
                                                        style={{ backgroundColor: catColor }}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                                            {cat.name}
                                                        </p>
                                                        <span
                                                            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold font-mono uppercase tracking-wider border mt-0.5"
                                                            style={{
                                                                backgroundColor: `${catColor}14`,
                                                                color: catColor,
                                                                borderColor: `${catColor}30`,
                                                            }}
                                                        >
                                                            {cat.code}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4 hidden md:table-cell max-w-xs truncate text-muted-foreground text-xs">
                                                {cat.description || '-'}
                                            </td>

                                            <td className="py-3 px-4 text-center">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <Badge variant="secondary" className="text-[11px] font-normal" title="Materi">
                                                        <BookOpen className="size-3 text-blue-500 mr-1" />
                                                        {cat.training_count || 0}
                                                    </Badge>
                                                    <Badge variant="secondary" className="text-[11px] font-normal" title="Ujian">
                                                        <FileQuestion className="size-3 text-amber-500 mr-1" />
                                                        {cat.exam_count || 0}
                                                    </Badge>
                                                    <Badge variant="secondary" className="text-[11px] font-normal" title="Modul">
                                                        <Boxes className="size-3 text-emerald-500 mr-1" />
                                                        {cat.module_count || 0}
                                                    </Badge>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4 text-center">
                                                <Badge variant="outline" className="font-semibold text-[11px]">
                                                    {cat.trainer_count || 0} Trainer
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-4 text-center">
                                                <Badge
                                                    variant={cat.is_active ? 'success' : 'secondary'}
                                                    className="text-[11px]"
                                                >
                                                    {cat.is_active ? 'Aktif' : 'Nonaktif'}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-4 sm:px-5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="xs"
                                                        onClick={() => {
                                                            setAssignTarget({ id: cat.id, name: cat.name });
                                                            setIsAssignOpen(true);
                                                        }}
                                                        className="rounded-lg gap-1 font-semibold"
                                                    >
                                                        <Users className="size-3 text-primary" />
                                                        <span>Trainer</span>
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-xs"
                                                        onClick={() => {
                                                            setEditingCategory(cat);
                                                            setIsFormOpen(true);
                                                        }}
                                                        title="Edit Kategori"
                                                        className="rounded-lg text-muted-foreground hover:text-foreground"
                                                    >
                                                        <Pencil className="size-3" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-xs"
                                                        onClick={() => handleDelete(cat)}
                                                        title="Hapus Kategori"
                                                        className="rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="size-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pt-2 flex justify-center">
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={(p) => setPage(p)}
                    />
                </div>
            )}

            {/* Modal Forms */}
            <CategoryFormModal
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setEditingCategory(null);
                }}
                onSuccess={() => fetchCategories(page, pageSize)}
                category={editingCategory}
            />

            {assignTarget && (
                <AssignTrainersModal
                    isOpen={isAssignOpen}
                    onClose={() => {
                        setIsAssignOpen(false);
                        setAssignTarget(null);
                    }}
                    onSuccess={() => fetchCategories(page, pageSize)}
                    categoryId={assignTarget.id}
                    categoryName={assignTarget.name}
                />
            )}
        </div>
    );
}
