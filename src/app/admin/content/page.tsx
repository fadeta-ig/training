'use client';

import { useState, useEffect } from 'react';
import {
    Book01Icon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon
} from 'hugeicons-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useConfirm } from '@/hooks/useConfirm';
import { toast } from 'sonner';

type Training = {
    id: string;
    title: string;
    created_at: string;
};

export default function ContentManagerPage() {
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchTrainings = async (targetPage = page) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/trainings?page=${targetPage}&limit=10`);
            if (!res.ok) throw new Error('Gagal mengambil data materi');
            const result = await res.json();
            if (result.success) {
                setTrainings(result.data);
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
        fetchTrainings(page);
    }, [page]);

    const deleteTraining = async (id: string, title: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Materi?',
            message: `Apakah Anda yakin ingin menghapus materi "${title}" secara permanen? Aksi ini tidak dapat dibatalkan.`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus Materi',
            cancelLabel: 'Batal'
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/trainings/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus materi');
            toast.success('Materi berhasil dihapus');
            fetchTrainings(page);
        } catch (err: any) {
            toast.error(err.message || 'Gagal menghapus materi');
        }
    };

    return (
        <div className="space-y-8 max-w-5xl relative">
            <ConfirmComponent />
            <PageHeader
                title="Materi Pelatihan"
                description="Kelola bacaan, artikel HTML, dan tautan video yang akan digunakan pada Modul."
                icon={<Book01Icon size={28} className="text-muted-foreground" />}
                actionLabel="Buat Materi Baru"
                actionHref="/admin/content/new"
                onRefresh={fetchTrainings}
                isRefreshing={isLoading}
            />

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-start gap-3">
                    <Alert02Icon size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Gagal Memuat Materi</h4>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/5 border-b border-black/5 text-muted-foreground font-medium uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-2xl">Judul Materi</th>
                                <th className="px-6 py-4">Tanggal Dibuat</th>
                                <th className="px-6 py-4 text-right rounded-tr-2xl">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-muted-foreground">
                                        <RefreshIcon size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                        Memuat materi...
                                    </td>
                                </tr>
                            ) : trainings.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-0">
                                        <EmptyState
                                            icon={<Book01Icon size={40} className="text-black/10" />}
                                            title="Belum ada materi pelatihan"
                                            description="Silakan buat satu materi baru untuk memulai."
                                            actionLabel="Buat Materi Pertama"
                                            actionHref="/admin/content/new"
                                        />
                                    </td>
                                </tr>
                            ) : (
                                trainings.map((training) => (
                                    <tr key={training.id} className="hover:bg-black/5 transition-colors group">
                                        <td className="px-6 py-4 font-semibold text-foreground">
                                            {training.title}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {new Date(training.created_at).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-1.5 flex justify-end gap-1.5">
                                            <ActionButton
                                                href={`/admin/content/${training.id}/edit`}
                                                icon={<PencilEdit02Icon size={16} />}
                                                title="Edit"
                                            />
                                            <ActionButton
                                                onClick={() => deleteTraining(training.id, training.title)}
                                                icon={<Delete02Icon size={16} />}
                                                variant="destructive"
                                                title="Hapus"
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
    );
}
