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
    Search,
    RotateCcw,
    AlertCircle,
    Loader2,
    Layers,
    Tag,
} from 'lucide-react';
import { ManagementPageHeader } from '@/components/admin/ManagementPageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { useConfirm } from '@/hooks/useConfirm';
import { CategoryFormModal } from './_components/CategoryFormModal';
import { AssignTrainersModal } from './_components/AssignTrainersModal';
import { toast } from 'sonner';
import type { LearningCategory } from '@/types';

export default function CategoriesManagerPage() {
    const [categories, setCategories] = useState<LearningCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(9);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Search and Status Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modals state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<LearningCategory | null>(null);

    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState<{ id: string; name: string } | null>(null);

    const { confirm, ConfirmComponent } = useConfirm();

    const fetchCategories = useCallback(
        async (targetPage: number, limit: number, currentSearch = search, currentStatus = statusFilter) => {
            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    page: String(targetPage),
                    limit: String(limit),
                    search: currentSearch,
                    status: currentStatus,
                });
                const res = await fetch(`/api/admin/categories?${params.toString()}`);
                const data = await res.json();

                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Gagal memuat kategori');
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
        [search, statusFilter]
    );

    useEffect(() => {
        fetchCategories(page, pageSize);
    }, [fetchCategories, page, pageSize]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchCategories(1, pageSize, search, statusFilter);
    };

    const handleReset = () => {
        setSearch('');
        setStatusFilter('all');
        setPage(1);
        fetchCategories(1, pageSize, '', 'all');
    };

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

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <ConfirmComponent />

            {/* Header */}
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

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Kategori</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{totalItems}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                        <Layers size={22} />
                    </div>
                </div>
                <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kategori Aktif</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                        <Tag size={22} />
                    </div>
                </div>
                <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Penugasan Trainer</p>
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{totalTrainersAssigned}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
                        <Users size={22} />
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3 rounded-2xl bg-card border border-border/70 shadow-xs">
                <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari nama, kode, atau deskripsi kategori..."
                        className="w-full h-10 pl-10 pr-4 text-xs sm:text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                </form>

                <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="h-10 px-3 text-xs sm:text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    >
                        <option value="all">Semua Status</option>
                        <option value="active">Aktif Saja</option>
                        <option value="inactive">Nonaktif Saja</option>
                    </select>

                    {(search || statusFilter !== 'all') && (
                        <button
                            type="button"
                            onClick={handleReset}
                            className="flex items-center gap-1.5 h-10 px-3 text-xs sm:text-sm rounded-xl border border-input hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                        >
                            <RotateCcw size={14} />
                            <span>Reset</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Grid */}
            {isLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <p className="text-sm">Memuat data kategori...</p>
                </div>
            ) : error ? (
                <div className="py-16 text-center space-y-3 bg-card border border-destructive/20 rounded-2xl p-6">
                    <AlertCircle className="size-10 text-destructive mx-auto" />
                    <p className="text-sm font-semibold text-destructive">{error}</p>
                    <button
                        onClick={() => fetchCategories(page, pageSize)}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
                    >
                        Coba Lagi
                    </button>
                </div>
            ) : categories.length === 0 ? (
                <div className="py-20 text-center space-y-2 bg-card border border-border/70 rounded-2xl p-6">
                    <Layers className="size-12 text-muted-foreground/40 mx-auto" />
                    <h3 className="text-base font-semibold text-foreground">Tidak Ada Kategori Ditemukan</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        {search || statusFilter !== 'all'
                            ? 'Tidak ada kategori yang cocok dengan filter pencarian Anda.'
                            : 'Belum ada kategori yang dibuat. Klik tombol Tambah Kategori untuk memulai.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {categories.map((cat) => (
                        <div
                            key={cat.id}
                            className="group relative rounded-2xl bg-card border border-border/80 shadow-xs hover:shadow-md hover:border-border transition-all duration-200 overflow-hidden flex flex-col justify-between"
                        >
                            {/* Color Accent Bar on Top */}
                            <div
                                className="h-1.5 w-full"
                                style={{ backgroundColor: cat.color || '#0ea5e9' }}
                            />

                            <div className="p-5 space-y-4 flex-1">
                                {/* Header with Badge & Status */}
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold font-mono uppercase tracking-wider"
                                        style={{
                                            backgroundColor: `${cat.color || '#0ea5e9'}18`,
                                            color: cat.color || '#0ea5e9',
                                        }}
                                    >
                                        {cat.code}
                                    </span>
                                    <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                            cat.is_active
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        {cat.is_active ? 'Aktif' : 'Nonaktif'}
                                    </span>
                                </div>

                                {/* Title & Description */}
                                <div>
                                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                        {cat.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[32px]">
                                        {cat.description || 'Tidak ada deskripsi.'}
                                    </p>
                                </div>

                                {/* Content Counts Metrics */}
                                <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-muted/30 border border-border/40 text-center">
                                    <div>
                                        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[11px]">
                                            <BookOpen size={12} />
                                            <span>Materi</span>
                                        </div>
                                        <p className="text-sm font-bold text-foreground mt-0.5">
                                            {cat.training_count || 0}
                                        </p>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[11px]">
                                            <FileQuestion size={12} />
                                            <span>Ujian</span>
                                        </div>
                                        <p className="text-sm font-bold text-foreground mt-0.5">
                                            {cat.exam_count || 0}
                                        </p>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-center gap-1 text-muted-foreground text-[11px]">
                                            <Boxes size={12} />
                                            <span>Modul</span>
                                        </div>
                                        <p className="text-sm font-bold text-foreground mt-0.5">
                                            {cat.module_count || 0}
                                        </p>
                                    </div>
                                </div>

                                {/* Assigned Trainers Counter */}
                                <div className="flex items-center justify-between text-xs pt-1">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Users size={14} className="text-primary" />
                                        <span>Pengajar Ditugaskan:</span>
                                    </span>
                                    <span className="font-bold text-foreground">
                                        {cat.trainer_count || 0} Trainer
                                    </span>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="px-5 py-3.5 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAssignTarget({ id: cat.id, name: cat.name });
                                        setIsAssignOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                                >
                                    <Users size={13} />
                                    <span>Kelola Trainer</span>
                                </button>

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
                                        <Pencil size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(cat)}
                                        title="Hapus Kategori"
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
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
