'use client';

import { useState, useEffect } from 'react';
import {
    CubeIcon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon,
    ViewIcon
} from 'hugeicons-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useConfirm } from '@/hooks/useConfirm';
import { toast } from 'sonner';

type Module = {
    id: string;
    title: string;
    description: string;
    created_at: string;
};

export default function ModulesManagerPage() {
    const [modules, setModules] = useState<Module[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [userRole, setUserRole] = useState<string>('');
    const [totalPages, setTotalPages] = useState(1);
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchModules = async (targetPage = page) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/modules?page=${targetPage}&limit=10`);
            if (!res.ok) throw new Error('Gagal mengambil data modul');
            const result = await res.json();
            if (result.success) {
                setModules(result.data);
                if (result.pagination) {
                    setTotalPages(result.pagination.totalPages);
                }
            } else {
                throw new Error(result.error || 'Terjadi kesalahan sistem');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchModules(page);
    }, [page]);

    useEffect(() => {
        fetch('/api/auth/me').then(res => res.json()).then(data => {
            if (data.success) {
                setUserRole(data.data.role);
            }
        }).catch(() => {});
    }, []);

    const deleteModule = async (id: string, title: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Modul?',
            message: `Apakah Anda yakin ingin menghapus Modul "${title}" secara permanen? Sesi yang sedang berjalan untuk modul ini akan terganggu.`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus',
            cancelLabel: 'Batal'
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/modules/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus modul');
            toast.success('Modul berhasil dihapus');
            fetchModules(page);
        } catch (err: any) {
            toast.error(err.message || 'Gagal menghapus modul');
        }
    };

    return (
        <div className="space-y-8 max-w-6xl relative">
            <ConfirmComponent />
            <PageHeader
                title="Perakit Modul (Builder)"
                description="Susun kurikulum dengan menyatukan Materi Pelatihan dan Ujian menjadi satu alur linier utuh."
                icon={<CubeIcon size={28} className="text-muted-foreground" />}
                actionLabel={userRole === 'admin' ? "Rakit Modul Baru" : undefined}
                actionHref={userRole === 'admin' ? "/admin/modules/new" : undefined}
                onRefresh={fetchModules}
                isRefreshing={isLoading}
            />

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-start gap-3">
                    <Alert02Icon size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Gagal Memuat Data Modul</h4>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground glass-card flex flex-col items-center justify-center">
                        <RefreshIcon size={32} className="animate-spin mb-4 opacity-50" />
                        <p>Memuat deret modul...</p>
                    </div>
                ) : modules.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={<CubeIcon size={48} className="mb-4 opacity-20" />}
                            title="Belum ada modul yang terdaftar."
                            description="Mulai rakit alur pembelajaran Anda dengan menyatukan materi dan ujian."
                            actionLabel={userRole === 'admin' ? "Rakit Modul Pertama" : undefined}
                            actionHref={userRole === 'admin' ? "/admin/modules/new" : undefined}
                        />
                    </div>
                ) : (
                    modules.map((mod) => (
                        <GlassCard key={mod.id} className="flex flex-col group transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                            <div className="p-6 flex-1">
                                <h3 className="text-xl font-bold tracking-tight text-foreground line-clamp-2 mb-2">
                                    {mod.title}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                                    {mod.description || 'Tidak ada deskripsi detail tambahan.'}
                                </p>
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Dibuat pada: {new Date(mod.created_at).toLocaleDateString('id-ID')}
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-black/5 flex justify-end gap-2 bg-black/5 rounded-b-2xl">
                                <ActionButton
                                    href={`/admin/modules/${mod.id}`}
                                    icon={<ViewIcon size={16} />}
                                    title="Detail"
                                />
                                {userRole === 'admin' && (
                                    <>
                                        <ActionButton
                                            href={`/admin/modules/${mod.id}/edit`}
                                            icon={<PencilEdit02Icon size={16} />}
                                            title="Edit"
                                        />
                                        <ActionButton
                                            onClick={() => deleteModule(mod.id, mod.title)}
                                            icon={<Delete02Icon size={16} />}
                                            variant="destructive"
                                            title="Hapus"
                                        />
                                    </>
                                )}
                            </div>
                        </GlassCard>
                    ))
                )}
            </div>

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
    );
}
