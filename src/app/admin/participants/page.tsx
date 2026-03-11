'use client';

import { useState, useEffect } from 'react';
import {
    UserGroupIcon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon,
    Search01Icon
} from 'hugeicons-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

type Participant = {
    id: string;
    email: string;
    name: string;
    institution: string | null;
    phone_number: string | null;
    created_at: string;
};

export default function ParticipantsManagerPage() {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchParticipants = async (targetPage = page, search = searchQuery) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/participants?page=${targetPage}&limit=10&search=${encodeURIComponent(search)}`);
            if (!res.ok) throw new Error('Gagal memuat data peserta');
            const result = await res.json();
            if (result.success) {
                setParticipants(result.data);
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
        fetchParticipants(page, searchQuery);
    }, [page, searchQuery]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setPage(1);
    };

    const deleteParticipant = async (id: string, name: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Peserta Permanen?',
            message: `Apakah Anda yakin ingin menghapus Peserta "${name}" secara permanen? Seluruh riwayat ujian peserta ini juga akan terhapus dan tidak bisa dikembalikan.`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus Data',
            cancelLabel: 'Batal'
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/admin/participants/${id}`, { method: 'DELETE' });
            const result = await res.json();

            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Gagal menghapus peserta');
            }
            toast.success('Peserta berhasil dihapus');
            fetchParticipants(page, searchQuery);
        } catch (err: any) {
            toast.error(err.message || 'Terjadi kesalahan sistem');
        }
    };

    return (
        <div className="space-y-8 max-w-6xl relative">
            <ConfirmComponent />
            <PageHeader
                title="Kelola Peserta"
                description="Manajemen data diri peserta pelatihan dan ujian"
                icon={<UserGroupIcon size={28} className="text-muted-foreground" />}
                actionLabel="Tambah Peserta Baru"
                actionHref="/admin/participants/new"
                onRefresh={() => fetchParticipants(page, searchQuery)}
                isRefreshing={isLoading}
            />

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-start gap-3">
                    <Alert02Icon size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Gagal Memuat Data</h4>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Search01Icon size={18} />
                    </span>
                    <input
                        type="text"
                        placeholder="Cari email, nama, atau institusi..."
                        value={searchQuery}
                        onChange={handleSearch}
                        className="w-full glass-input pl-11 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                    />
                </div>
            </div>

            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/5 border-b border-black/5 text-muted-foreground font-medium uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-2xl">Nama Lengkap</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Institusi</th>
                                <th className="px-6 py-4">No. HP</th>
                                <th className="px-6 py-4">Terdaftar</th>
                                <th className="px-6 py-4 text-right rounded-tr-2xl">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                                        <RefreshIcon size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                        Memuat data...
                                    </td>
                                </tr>
                            ) : participants.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10">
                                        <EmptyState
                                            icon={<UserGroupIcon size={48} className="mb-4 opacity-20" />}
                                            title="Belum ada peserta"
                                            description="Sistem belum memiliki data peserta pelatihan."
                                            actionLabel="Tambah Peserta"
                                            actionHref="/admin/participants/new"
                                        />
                                    </td>
                                </tr>
                            ) : (
                                participants.map((p) => (
                                    <tr key={p.id} className="hover:bg-black/5 transition-colors group">
                                        <td className="px-6 py-4 font-semibold text-foreground">
                                            {p.name}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {p.email}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {p.institution || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {p.phone_number || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {new Date(p.created_at).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-1.5 flex justify-end gap-1.5">
                                            <ActionButton
                                                href={`/admin/participants/${p.id}`}
                                                icon={<PencilEdit02Icon size={16} />}
                                                title="Edit Peserta"
                                            />
                                            <ActionButton
                                                onClick={() => deleteParticipant(p.id, p.name)}
                                                variant="destructive"
                                                icon={<Delete02Icon size={16} />}
                                                title="Hapus Peserta"
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
