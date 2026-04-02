'use client';

import { useState, useEffect } from 'react';
import {
    UserGroupIcon,
    PencilEdit02Icon,
    Delete02Icon,
    RefreshIcon,
    Alert02Icon,
    PlusSignIcon,
    Search01Icon
} from 'hugeicons-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useConfirm } from '@/hooks/useConfirm';
import { Pagination } from '@/components/ui/Pagination';
import { BulkImportModal } from './_components/BulkImportModal';
import { FileExportIcon } from 'hugeicons-react';

type User = {
    id: string;
    username: string;
    full_name: string;
    role: string;
    created_at: string;
};

export default function UsersManagerPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const { confirm, ConfirmComponent } = useConfirm();

    const fetchUsers = async (targetPage = page, search = searchQuery) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/users?page=${targetPage}&limit=10&search=${encodeURIComponent(search)}`);
            if (!res.ok) throw new Error('Gagal memuat data pengguna');
            const result = await res.json();
            if (result.success) {
                setUsers(result.data);
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
        fetchUsers(page, searchQuery);
    }, [page, searchQuery]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setPage(1); // Reset to first page on new search
    };

    const deleteUser = async (id: string, name: string) => {
        const isConfirmed = await confirm({
            title: 'Hapus Pengguna?',
            message: `Apakah Anda yakin ingin menghapus Pengguna "${name}" secara permanen?`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus',
            cancelLabel: 'Batal'
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            const result = await res.json();

            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Gagal menghapus pengguna');
            }
            toast.success('Pengguna berhasil dihapus');
            fetchUsers(page, searchQuery);
        } catch (err: any) {
            toast.error(err.message || 'Terjadi kesalahan saat menghapus pengguna');
        }
    };

    return (
        <div className="space-y-8 max-w-6xl relative">
            <ConfirmComponent />
            <PageHeader
                title="Kelola Pengguna (Sistem)"
                description="Manajemen akun Administrator dan Pelatih/Trainer"
                icon={<UserGroupIcon size={28} className="text-muted-foreground" />}
                actionLabel="Tambah Pengguna"
                actionHref="/admin/users/new"
                onRefresh={() => fetchUsers(page, searchQuery)}
                isRefreshing={isLoading}
            />

            <BulkImportModal 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => fetchUsers(1, '')}
            />

            <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Search01Icon size={18} />
                    </span>
                    <input
                        type="text"
                        placeholder="Cari username atau nama..."
                        value={searchQuery}
                        onChange={handleSearch}
                        className="w-full glass-input pl-11 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                    />
                </div>
                
                {/* Tombol Import Massal */}
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex shrink-0 items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-4 py-2.5 rounded-xl text-sm border border-blue-200 transition-colors"
                >
                    <FileExportIcon size={18} /> Import Massal
                </button>
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

            {/* Custom Flex Group is already placed above above error */}

            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/5 border-b border-black/5 text-muted-foreground font-medium uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-2xl">Nama Lengkap</th>
                                <th className="px-6 py-4">Username</th>
                                <th className="px-6 py-4">Peran (Role)</th>
                                <th className="px-6 py-4">Terdaftar</th>
                                <th className="px-6 py-4 text-right rounded-tr-2xl">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                                        <RefreshIcon size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                        Memuat data...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10">
                                        <EmptyState
                                            icon={<UserGroupIcon size={48} className="mb-4 opacity-20" />}
                                            title="Belum ada pengguna"
                                            description="Sistem belum memiliki akun yang terdaftar."
                                            actionLabel="Buat Pengguna Baru"
                                            actionHref="/admin/users/new"
                                        />
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-black/5 transition-colors group">
                                        <td className="px-6 py-4 font-semibold text-foreground">
                                            {user.full_name}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            @{user.username}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${user.role === 'admin'
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                }`}>
                                                {user.role === 'admin' ? 'Administrator' : 'Pelatih / Trainer'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {new Date(user.created_at).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-1.5 flex justify-end gap-1.5">
                                            <ActionButton
                                                href={`/admin/users/${user.id}/edit`}
                                                icon={<PencilEdit02Icon size={16} />}
                                                title="Edit Pengguna"
                                            />
                                            {user.id !== 'admin-uuid-001' && (
                                                <ActionButton
                                                    onClick={() => deleteUser(user.id, user.username)}
                                                    variant="destructive"
                                                    icon={<Delete02Icon size={16} />}
                                                    title="Hapus Pengguna"
                                                />
                                            )}
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
