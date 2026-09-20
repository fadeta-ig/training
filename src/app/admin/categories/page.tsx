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
    Shield,
    Sparkles,
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

    // Handle search change from LearningFilterBar (debounced)
    const handleSearchChange = (val: string) => {
        setSearch(val);
        setPage(1);
    };

    // Handle sort change from LearningFilterBar
    const handleSortChange = (val: string) => {
        setSort(val);
        setPage(1);
    };

    // Handle reset filter
    const handleReset = () => {
        setSearch('');
        setStatusFilter('all');
        setSort('created_desc');
        setPage(1);
    };

    // Filter Configs for LearningFilterBar
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

    // Quick Stats Calculation
    const activeCount = categories.filter((c) => c.is_active).length;
    const totalTrainersAssigned = categories.reduce((acc, c) => acc + (c.trainer_count || 0), 0);
    const totalContentItems = categories.reduce(
        (acc, c) => acc + (c.training_count || 0) + (c.exam_count || 0) + (c.module_count || 0),
        0
    );

    return (
        <div className="relative max-w-6xl mx-auto space-y-6 pb-14">
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

            {/* Metric Summary Ribbon */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="p-4 sm:p-5 shadow-2xs border-border/80 flex items-center justify-between transition-all hover:shadow-xs">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Total Kategori
                        </p>
                        <p className="text-2xl font-bold text-foreground mt-0.5">{totalItems}</p>
                    </div>
                    <div className="size-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Layers className="size-5" />
                    </div>
                </Card>

                <Card className="p-4 sm:p-5 shadow-2xs border-border/80 flex items-center justify-between transition-all hover:shadow-xs">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Kategori Aktif
                        </p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {activeCount}
                        </p>
                    </div>
                    <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Tag className="size-5" />
                    </div>
                </Card>

                <Card className="p-4 sm:p-5 shadow-2xs border-border/80 flex items-center justify-between transition-all hover:shadow-xs">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Penugasan Trainer
                        </p>
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {totalTrainersAssigned}
                        </p>
                    </div>
                    <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Users className="size-5" />
                    </div>
                </Card>

                <Card className="p-4 sm:p-5 shadow-2xs border-border/80 flex items-center justify-between transition-all hover:shadow-xs">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Total Konten
                        </p>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            {totalContentItems}
                        </p>
                    </div>
                    <div className="size-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Boxes className="size-5" />
                    </div>
                </Card>
            </div>

            {/* Standard LMS Filter Bar & View Switcher */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex-1">
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
                    />
                </div>

                {/* Grid / Table View Switcher */}
                <div className="flex items-center gap-1 self-end sm:self-center p-1 rounded-xl border border-border/80 bg-card shadow-2xs shrink-0">
                    <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            'p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                            viewMode === 'grid'
                                ? 'bg-primary text-primary-foreground shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                        title="Tampilan Kartu (Grid View)"
                    >
                        <LayoutGrid className="size-4" />
                        <span className="hidden md:inline">Grid</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={cn(
                            'p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                            viewMode === 'table'
                                ? 'bg-primary text-primary-foreground shadow-2xs'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                        title="Tampilan Tabel (Table View)"
                    >
                        <TableIcon className="size-4" />
                        <span className="hidden md:inline">Tabel</span>
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-destructive">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                    <div>
                        <h2 className="text-sm font-semibold">Data Kategori Tidak Dapat Dimuat</h2>
                        <p className="mt-1 text-sm opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {/* Content Display */}
            {isLoading ? (
                viewMode === 'grid' ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-64 rounded-2xl" />
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
                <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center bg-card/40">
                    <div className="size-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground/60 shadow-2xs">
                        <Layers className="size-7" />
                    </div>
                    <h2 className="mt-4 text-base font-bold text-foreground">
                        {isFilterActive ? 'Tidak Ada Kategori yang Cocok' : 'Belum Ada Kategori Pembelajaran'}
                    </h2>
                    <p className="mx-auto mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {isFilterActive
                            ? 'Pencarian atau filter yang Anda pilih tidak menemukan hasil yang sesuai. Coba ubah kata kunci atau reset filter.'
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {categories.map((cat) => {
                        const catColor = cat.color || '#0ea5e9';
                        return (
                            <Card
                                key={cat.id}
                                className="group relative overflow-hidden flex flex-col justify-between border-border/80 shadow-2xs hover:shadow-md transition-all duration-200"
                            >
                                {/* Subtle Top Glow Stripe */}
                                <div
                                    className="h-1.5 w-full shrink-0"
                                    style={{ backgroundColor: catColor }}
                                />

                                <CardHeader className="p-5 pb-3 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold font-mono uppercase tracking-wider border shadow-2xs"
                                            style={{
                                                backgroundColor: `${catColor}14`,
                                                color: catColor,
                                                borderColor: `${catColor}35`,
                                            }}
                                        >
                                            {cat.code}
                                        </span>

                                        <Badge
                                            variant={cat.is_active ? 'success' : 'secondary'}
                                            className="text-[11px] font-semibold"
                                        >
                                            {cat.is_active ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                    </div>

                                    <div>
                                        <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                            {cat.name}
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[32px] leading-relaxed">
                                            {cat.description || 'Tidak ada deskripsi cakupan.'}
                                        </p>
                                    </div>
                                </CardHeader>

                                <CardContent className="px-5 py-2 space-y-3.5">
                                    {/* Content Metric Badges */}
                                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-center">
                                        <div className="space-y-0.5">
                                            <span className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                                                <BookOpen className="size-3 text-blue-500" />
                                                <span>Materi</span>
                                            </span>
                                            <p className="text-sm font-bold text-foreground">
                                                {cat.training_count || 0}
                                            </p>
                                        </div>
                                        <div className="space-y-0.5 border-x border-border/60">
                                            <span className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                                                <FileQuestion className="size-3 text-amber-500" />
                                                <span>Ujian</span>
                                            </span>
                                            <p className="text-sm font-bold text-foreground">
                                                {cat.exam_count || 0}
                                            </p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <span className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                                                <Boxes className="size-3 text-emerald-500" />
                                                <span>Modul</span>
                                            </span>
                                            <p className="text-sm font-bold text-foreground">
                                                {cat.module_count || 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Assigned Trainers Status */}
                                    <div className="flex items-center justify-between text-xs py-1 px-1">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <Users className="size-3.5 text-primary" />
                                            <span>Trainer Ditugaskan:</span>
                                        </span>
                                        <Badge
                                            variant="secondary"
                                            className="font-semibold text-foreground text-[11px]"
                                        >
                                            {cat.trainer_count || 0} Trainer
                                        </Badge>
                                    </div>
                                </CardContent>

                                <CardFooter className="p-4 pt-3 border-t border-border/70 bg-muted/20 flex items-center justify-between gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setAssignTarget({ id: cat.id, name: cat.name });
                                            setIsAssignOpen(true);
                                        }}
                                        className="gap-1.5 rounded-xl text-xs font-semibold hover:border-primary/50 hover:bg-primary/5"
                                    >
                                        <Users className="size-3.5 text-primary" />
                                        <span>Kelola Trainer</span>
                                    </Button>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingCategory(cat);
                                                setIsFormOpen(true);
                                            }}
                                            title="Edit Kategori"
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                        >
                                            <Pencil className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(cat)}
                                            title="Hapus Kategori"
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
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
                                    <th className="py-3.5 px-4 sm:px-6">Kategori</th>
                                    <th className="py-3.5 px-4 hidden md:table-cell">Deskripsi</th>
                                    <th className="py-3.5 px-4 text-center">Konten Binaan</th>
                                    <th className="py-3.5 px-4 text-center">Trainer</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 sm:px-6 text-right">Aksi</th>
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
                                            <td className="py-3.5 px-4 sm:px-6">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="size-3 rounded-full shrink-0 shadow-xs"
                                                        style={{ backgroundColor: catColor }}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
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

                                            <td className="py-3.5 px-4 hidden md:table-cell max-w-xs truncate text-muted-foreground text-xs">
                                                {cat.description || '-'}
                                            </td>

                                            <td className="py-3.5 px-4 text-center">
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

                                            <td className="py-3.5 px-4 text-center">
                                                <Badge variant="outline" className="font-semibold text-[11px]">
                                                    {cat.trainer_count || 0} Trainer
                                                </Badge>
                                            </td>

                                            <td className="py-3.5 px-4 text-center">
                                                <Badge
                                                    variant={cat.is_active ? 'success' : 'secondary'}
                                                    className="text-[11px]"
                                                >
                                                    {cat.is_active ? 'Aktif' : 'Nonaktif'}
                                                </Badge>
                                            </td>

                                            <td className="py-3.5 px-4 sm:px-6 text-right">
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

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingCategory(cat);
                                                            setIsFormOpen(true);
                                                        }}
                                                        title="Edit Kategori"
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(cat)}
                                                        title="Hapus Kategori"
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
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
                <div className="pt-4 flex justify-center">
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={(p) => setPage(p)}
                    />
                </div>
            )}

            {/* Modal Forms with ClientPortal & Scroll Lock */}
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
