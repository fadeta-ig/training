'use client';

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import {
    UserGroupIcon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon,
    Search01Icon,
    CloudUploadIcon
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
    nip: string | null;
    institution: string | null;
    institution_code: string | null;
    batch: number;
    registration_date: string | null;
    phone_number: string | null;
    created_at: string;
};

export default function ParticipantsManagerPage() {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [userRole, setUserRole] = useState<string>('');
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchParticipants = useCallback(async (targetPage: number, limit: number, search: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/participants?page=${targetPage}&limit=${limit}&search=${encodeURIComponent(search)}`);
            if (!res.ok) throw new Error('Gagal memuat data peserta');
            const result = await res.json();
            if (result.success) {
                setParticipants(result.data);
                if (result.pagination) {
                    setTotalPages(result.pagination.totalPages);
                    setTotalItems(result.pagination.total || result.data.length);
                }
            } else {
                throw new Error(result.error || 'Terjadi kesalahan sistem');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchParticipants(page, pageSize, searchQuery);
    }, [page, pageSize, searchQuery, fetchParticipants]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setUserRole(data.data.role);
                }
            })
            .catch(() => {});
    }, []);

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
            cancelLabel: 'Batal',
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/admin/participants/${id}`, { method: 'DELETE' });
            const result = await res.json();

            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Gagal menghapus peserta');
            }
            toast.success('Peserta berhasil dihapus');
            fetchParticipants(page, pageSize, searchQuery);
        } catch (err: any) {
            toast.error(err.message || 'Terjadi kesalahan sistem');
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            <ConfirmComponent />
            <PageHeader
                title="Kelola Peserta (Trainee)"
                description="Manajemen akun peserta pelatihan, NIP, batch institusi, dan tanggal pendaftaran"
                icon={<UserGroupIcon size={28} className="text-muted-foreground" />}
                actionLabel={userRole === 'admin' ? 'Tambah Peserta' : undefined}
                actionHref={userRole === 'admin' ? '/admin/participants/new' : undefined}
                onRefresh={() => fetchParticipants(page, pageSize, searchQuery)}
                isRefreshing={isLoading}
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="relative w-full flex-1 sm:max-w-sm">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Search01Icon size={18} />
                    </span>
                    <input
                        type="text"
                        placeholder="Cari NIP, nama, email, instansi..."
                        value={searchQuery}
                        onChange={handleSearch}
                        className="w-full glass-input pl-11 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                    />
                </div>

                {userRole === 'admin' && (
                    <Link
                        href="/admin/participants/import"
                        className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-600/20 bg-emerald-600/10 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-600/20 active:scale-95 sm:w-auto"
                    >
                        <CloudUploadIcon size={18} />
                        Import Massal Excel
                    </Link>
                )}
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-start gap-3">
                    <Alert02Icon size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Gagal Memuat Data</h4>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/5 border-b border-black/5 text-muted-foreground font-medium uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-2xl">Nama Lengkap</th>
                                <th className="px-6 py-4">NIP Peserta</th>
                                <th className="px-6 py-4">Email / Akun</th>
                                <th className="px-6 py-4">Instansi & Batch</th>
                                <th className="px-6 py-4">No. HP</th>
                                <th className="px-6 py-4">Tgl Pendaftaran</th>
                                {userRole === 'admin' && (
                                    <th className="px-6 py-4 text-right rounded-tr-2xl">Aksi</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={userRole === 'admin' ? 7 : 6} className="px-6 py-10 text-center text-muted-foreground">
                                        <RefreshIcon size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                        Memuat data peserta...
                                    </td>
                                </tr>
                            ) : participants.length === 0 ? (
                                <tr>
                                    <td colSpan={userRole === 'admin' ? 7 : 6} className="px-6 py-10">
                                        <EmptyState
                                            icon={<UserGroupIcon size={48} className="mb-4 opacity-20" />}
                                            title="Belum ada peserta"
                                            description="Sistem belum memiliki akun peserta."
                                            actionLabel={userRole === 'admin' ? 'Tambah Peserta' : undefined}
                                            actionHref={userRole === 'admin' ? '/admin/participants/new' : undefined}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                participants.map((p) => (
                                    <tr key={p.id} className="hover:bg-black/5 transition-colors group">
                                        <td className="px-6 py-4 font-semibold text-foreground">{p.name}</td>
                                        <td className="px-6 py-4">
                                            {p.nip ? (
                                                <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                                                    {p.nip}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/50 text-xs italic">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">{p.email}</td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className="font-medium text-foreground">{p.institution || '-'}</span>
                                                {p.batch && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Batch {p.batch}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">{p.phone_number || '-'}</td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {p.registration_date
                                                ? new Date(p.registration_date).toLocaleDateString('id-ID', { dateStyle: 'medium' })
                                                : new Date(p.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                                        </td>
                                        {userRole === 'admin' && (
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
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

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
