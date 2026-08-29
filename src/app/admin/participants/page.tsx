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
    CloudUploadIcon,
    Tick02Icon,
    Cancel01Icon,
    CheckmarkCircle02Icon
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
    batch: string;
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

    // Selection & Bulk Batch Modal state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkBatchInput, setBulkBatchInput] = useState('');
    const [preserveSequence, setPreserveSequence] = useState(true);
    const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

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

    const handleToggleSelectAll = () => {
        if (selectedIds.size === participants.length && participants.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(participants.map(p => p.id)));
        }
    };

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleOpenBulkModal = () => {
        if (selectedIds.size === 0) {
            toast.error('Pilih minimal satu peserta terlebih dahulu');
            return;
        }
        setBulkBatchInput('');
        setPreserveSequence(true);
        setIsBulkModalOpen(true);
    };

    const handleBulkBatchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bulkBatchInput.trim()) {
            toast.error('Kode batch wajib diisi');
            return;
        }

        setIsBulkSubmitting(true);
        try {
            const res = await fetch('/api/admin/participants/bulk-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participant_ids: Array.from(selectedIds),
                    batch: bulkBatchInput,
                    preserve_sequence: preserveSequence,
                }),
            });

            const result = await res.json();
            if (res.ok && result.success) {
                toast.success(result.message || 'Batch dan NIP peserta berhasil diperbarui!');
                setIsBulkModalOpen(false);
                setSelectedIds(new Set());
                fetchParticipants(page, pageSize, searchQuery);
            } else {
                toast.error(result.error || 'Gagal memperbarui batch peserta');
            }
        } catch (err: any) {
            toast.error('Terjadi kesalahan koneksi', { description: err.message });
        } finally {
            setIsBulkSubmitting(false);
        }
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

    const isAllSelected = participants.length > 0 && selectedIds.size === participants.length;

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

            {/* Floating Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                            {selectedIds.size}
                        </span>
                        <div>
                            <p className="text-sm font-bold">{selectedIds.size} Peserta Terpilih</p>
                            <p className="text-xs text-slate-400">Pilih tindakan massal yang ingin diterapkan</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setSelectedIds(new Set())}
                            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                            Batal Pilih
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenBulkModal}
                            className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                            <RefreshIcon size={14} />
                            <span>Ubah Batch &amp; NIP Massal</span>
                        </button>
                    </div>
                </div>
            )}

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
                    <div className="flex items-center gap-2">
                        <Link
                            href="/admin/participants/import"
                            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-900 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer sm:w-auto"
                        >
                            <CloudUploadIcon size={18} className="text-emerald-700" />
                            <span>Import Massal Excel</span>
                        </Link>
                    </div>
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
                                {userRole === 'admin' && (
                                    <th className="px-4 py-4 w-10 text-center rounded-tl-2xl">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={handleToggleSelectAll}
                                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            title="Pilih Semua di Halaman Ini"
                                        />
                                    </th>
                                )}
                                <th className={`px-6 py-4 ${userRole !== 'admin' ? 'rounded-tl-2xl' : ''}`}>Nama Lengkap</th>
                                <th className="px-6 py-4">NIP Peserta</th>
                                <th className="px-6 py-4">Email / Akun</th>
                                <th className="px-6 py-4">Instansi &amp; Batch</th>
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
                                    <td colSpan={userRole === 'admin' ? 8 : 6} className="px-6 py-10 text-center text-muted-foreground">
                                        <RefreshIcon size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                                        Memuat data peserta...
                                    </td>
                                </tr>
                            ) : participants.length === 0 ? (
                                <tr>
                                    <td colSpan={userRole === 'admin' ? 8 : 6} className="px-6 py-10">
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
                                participants.map((p) => {
                                    const isSelected = selectedIds.has(p.id);
                                    return (
                                        <tr key={p.id} className={`transition-colors group ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-black/5'}`}>
                                            {userRole === 'admin' && (
                                                <td className="px-4 py-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelect(p.id)}
                                                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                </td>
                                            )}
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
                                                            {/^\d+$/.test(String(p.batch).trim()) ? `Batch ${p.batch}` : p.batch}
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
                                    );
                                })
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

            {/* Modal Dialog: Ubah Batch & NIP Massal */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                                <RefreshIcon size={20} className="text-emerald-600" />
                                <span>Ubah Batch &amp; NIP Massal</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsBulkModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                            >
                                <Cancel01Icon size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleBulkBatchSubmit} className="p-6 space-y-4">
                            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1">
                                <p className="font-bold flex items-center gap-1.5">
                                    <CheckmarkCircle02Icon size={16} className="text-emerald-700" />
                                    <span>{selectedIds.size} peserta akan diperbarui:</span>
                                </p>
                                <p className="text-[11px] text-emerald-800">
                                    Batch dan format NIP seluruh peserta terpilih akan disinkronkan secara atomik.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                                    Kode Batch Baru <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={50}
                                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-foreground focus:bg-white focus:outline-none focus:border-foreground uppercase tracking-wide"
                                    placeholder="Contoh: CSBA-SEP26"
                                    value={bulkBatchInput}
                                    onChange={(e) => setBulkBatchInput(e.target.value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, ''))}
                                />
                            </div>

                            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={preserveSequence}
                                    onChange={(e) => setPreserveSequence(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                                />
                                <div className="text-xs">
                                    <span className="font-bold text-foreground block">
                                        Pertahankan 3 Digit Nomor Urut Asli (Rekomendasi)
                                    </span>
                                    <span className="text-muted-foreground text-[11px]">
                                        Contoh: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">UCS-B01-2608-017</code> ➔ <code className="bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-bold">UCS-{bulkBatchInput || 'BATCH'}-017</code>
                                    </span>
                                </div>
                            </label>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsBulkModalOpen(false)}
                                    className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isBulkSubmitting || !bulkBatchInput.trim()}
                                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                                >
                                    {isBulkSubmitting ? 'Memproses...' : 'Simpan & Perbarui NIP'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

