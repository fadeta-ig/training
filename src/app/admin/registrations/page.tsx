'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ClientPortal } from '@/components/ui/ClientPortal';
import { toast } from 'sonner';
import {
    UserCheck01Icon,
    Search01Icon,
    RefreshIcon,
    Calendar01Icon,
    Building01Icon,
    CallIcon,
    Mail01Icon,
    Award01Icon,
    CheckmarkCircle02Icon,
    CancelCircleIcon,
    Clock01Icon,
    InformationCircleIcon
} from 'hugeicons-react';

interface RegistrationItem {
    id: string; // user id
    full_name: string;
    username: string; // email
    approval_status: 'pending' | 'approved' | 'rejected';
    rejection_reason: string | null;
    approved_at: string | null;
    created_at: string;
    nip: string | null;
    phone_number: string | null;
    address: string | null;
    gender: 'L' | 'P' | null;
    date_of_birth: string | null;
    institution: string | null;
    institution_code: string | null;
    batch: string;
    target_certification_id: string | null;
    target_certification_name: string | null;
    target_period: string | null;
}

/**
 * Smart Batch Suggestion — auto-generates batch code from certification name + target period.
 * E.g. "Certified Strategic Business Analyst" + "September 2026" → "CSBA-SEP26"
 */
function generateBatchSuggestion(certName: string | null, targetPeriod: string | null): string {
    if (!certName) return '1';

    // Extract initials/code from certification name (skip noise words)
    const NOISE = new Set(['DAN', 'DAN/ATAU', 'OF', 'THE', 'AND', 'FOR', 'IN', 'PELATIHAN', 'SERTIFIKASI', '&']);
    const words = certName
        .replace(/[^a-zA-Z\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0 && !NOISE.has(w.toUpperCase()));

    const code = words.length >= 2
        ? words.map(w => w[0].toUpperCase()).join('').slice(0, 6)
        : certName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();

    if (!targetPeriod) return code;

    // Parse month + year from target period (e.g. "September 2026" → "SEP26")
    const MONTH_MAP: Record<string, string> = {
        januari: 'JAN', februari: 'FEB', maret: 'MAR', april: 'APR',
        mei: 'MEI', juni: 'JUN', juli: 'JUL', agustus: 'AGS',
        september: 'SEP', oktober: 'OKT', november: 'NOV', desember: 'DES',
    };

    const parts = targetPeriod.trim().split(/\s+/);
    const monthKey = (parts[0] || '').toLowerCase();
    const yearStr = parts[1] || '';
    const monthCode = MONTH_MAP[monthKey] || monthKey.slice(0, 3).toUpperCase();
    const yearShort = yearStr.length === 4 ? yearStr.slice(-2) : yearStr;

    return yearShort ? `${code}-${monthCode}${yearShort}` : code;
}

/**
 * Generates a preview NIP string for display purposes (client-side only).
 * Uses the same logic as server formatNip but without DB sequence lookup.
 */
function previewNip(institution: string | null, batch: string): string {
    // Extract institution code (simplified client-side version)
    const NOISE = new Set(['PT', 'CV', 'TBK', 'PERSERO', 'PERUM', 'YAYASAN', 'DAN']);
    let code = 'GEN';
    if (institution && institution.trim()) {
        const clean = institution.replace(/[^\w\s]/gi, ' ').trim().toUpperCase();
        const words = clean.split(/\s+/).filter(Boolean);
        const significant = words.filter(w => !NOISE.has(w));
        const src = significant.length > 0 ? significant : words;
        if (src.length === 1) {
            const single = src[0];
            if (single.length <= 4) {
                code = single;
            } else {
                const consonants = single.replace(/[AEIOU]/g, '');
                code = consonants.length >= 3 ? consonants.slice(0, 4) : single.slice(0, 4);
            }
        } else if (src.length >= 2) {
            code = src.map(w => w[0]).join('').slice(0, 5);
        }
    }

    const safeBatch = (batch || '1').trim().toUpperCase();
    const isNumeric = /^\d+$/.test(safeBatch);

    if (isNumeric) {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        return `${code}-B${safeBatch.padStart(2, '0')}-${yy}${mm}-001`;
    }

    return `${code}-${safeBatch}-001`;
}

export default function RegistrationsAdminPage() {
    const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingCount, setPendingCount] = useState(0);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Modals
    const [selectedItem, setSelectedItem] = useState<RegistrationItem | null>(null);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [batchInput, setBatchInput] = useState<string>('1');
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchRegistrations = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(
                `/api/admin/registrations?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}&page=${page}&limit=${pageSize}`
            );
            const data = await res.json();
            if (data.success) {
                setRegistrations(data.data || []);
                setPendingCount(data.pendingCount || 0);
                if (data.pagination) {
                    setTotalPages(data.pagination.totalPages);
                    setTotalItems(data.pagination.total);
                }
            } else {
                toast.error(data.error || 'Gagal memuat antrean pendaftaran');
            }
        } catch {
            toast.error('Gagal terhubung ke server');
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, searchQuery, page, pageSize]);

    useEffect(() => {
        fetchRegistrations();
    }, [fetchRegistrations]);

    const handleOpenApprove = (item: RegistrationItem) => {
        setSelectedItem(item);
        // Smart Batch Suggestion — auto pre-fill dari Program Sertifikasi + Target Periode
        const suggested = generateBatchSuggestion(
            item.target_certification_name,
            item.target_period
        );
        setBatchInput(suggested);
        setIsApproveModalOpen(true);
    };

    const handleOpenReject = (item: RegistrationItem) => {
        setSelectedItem(item);
        setRejectionReason('');
        setIsRejectModalOpen(true);
    };

    const handleApproveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/admin/registrations/${selectedItem.id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: batchInput }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || 'Pendaftaran berhasil disetujui & NIP resmi telah diterbitkan');
                setIsApproveModalOpen(false);
                fetchRegistrations();
            } else {
                toast.error(data.error || 'Gagal menyetujui pendaftaran');
            }
        } catch {
            toast.error('Terjadi kesalahan koneksi');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/admin/registrations/${selectedItem.id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rejection_reason: rejectionReason }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Pendaftaran peserta telah ditolak');
                setIsRejectModalOpen(false);
                fetchRegistrations();
            } else {
                toast.error(data.error || 'Gagal menolak pendaftaran');
            }
        } catch {
            toast.error('Terjadi kesalahan koneksi');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <PageHeader
                title="Persetujuan Pendaftaran Peserta"
                subtitle="Tinjau antrean pendaftar akun baru, verifikasi program sertifikasi peminatan, tetapkan batch, dan terbitkan Nomor Induk Peserta (NIP) resmi."
                icon={<UserCheck01Icon size={24} className="text-primary" />}
                actions={
                    <ActionButton
                        variant="secondary"
                        onClick={fetchRegistrations}
                        icon={<RefreshIcon size={16} />}
                    >
                        Segarkan Antrean
                    </ActionButton>
                }
            />

            {/* Filter Tabs & Search Bar */}
            <GlassCard className="p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                        <button
                            type="button"
                            onClick={() => { setStatusFilter('pending'); setPage(1); }}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                statusFilter === 'pending'
                                    ? 'bg-white text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Clock01Icon size={14} className="text-amber-500" />
                            <span>Menunggu Persetujuan</span>
                            {pendingCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold text-[10px]">
                                    {pendingCount}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setStatusFilter('approved'); setPage(1); }}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                statusFilter === 'approved'
                                    ? 'bg-white text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <CheckmarkCircle02Icon size={14} className="text-emerald-600" />
                            <span>Disetujui</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setStatusFilter('rejected'); setPage(1); }}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                statusFilter === 'rejected'
                                    ? 'bg-white text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <CancelCircleIcon size={14} className="text-rose-600" />
                            <span>Ditolak</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setStatusFilter('all'); setPage(1); }}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                statusFilter === 'all'
                                    ? 'bg-white text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Semua Data
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative flex items-center min-w-[280px]">
                        <Search01Icon size={16} className="absolute left-3 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-foreground placeholder:text-muted-foreground focus:bg-white focus:outline-none focus:border-foreground"
                            placeholder="Cari nama, email, instansi, atau program..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>
            </GlassCard>

            {/* Registrations Table */}
            <GlassCard className="overflow-hidden p-0">
                {isLoading ? (
                    <div className="p-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Memuat data pendaftar...</span>
                    </div>
                ) : registrations.length === 0 ? (
                    <div className="p-8">
                        <EmptyState
                            icon={<UserCheck01Icon size={40} />}
                            title="Tidak Ada Antrean Pendaftaran"
                            description={
                                statusFilter === 'pending'
                                    ? 'Semua pendaftaran telah ditinjau dan disetujui. Tidak ada pendaftar baru yang menunggu saat ini.'
                                    : 'Tidak ada data pendaftar yang sesuai dengan filter atau pencarian Anda.'
                            }
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Calon Peserta</th>
                                    <th className="py-3.5 px-4">Instansi & Kontak</th>
                                    <th className="py-3.5 px-4">Program Peminatan & Target</th>
                                    <th className="py-3.5 px-4 text-center">NIP & Batch</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {registrations.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        {/* Name & Username/Email */}
                                        <td className="py-3.5 px-4">
                                            <div className="font-semibold text-foreground">{item.full_name}</div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                                <Mail01Icon size={12} />
                                                <span>{item.username}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                Daftar: {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>

                                        {/* Instansi & Phone */}
                                        <td className="py-3.5 px-4 text-xs">
                                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                                                <Building01Icon size={13} className="text-muted-foreground shrink-0" />
                                                <span>{item.institution || '-'}</span>
                                            </div>
                                            {item.phone_number && (
                                                <div className="flex items-center gap-1.5 text-muted-foreground mt-1 font-mono">
                                                    <CallIcon size={12} className="shrink-0" />
                                                    <span>{item.phone_number}</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Program Peminatan & Target Month */}
                                        <td className="py-3.5 px-4 text-xs">
                                            <div className="flex items-start gap-1.5 font-semibold text-foreground max-w-xs">
                                                <Award01Icon size={14} className="text-primary shrink-0 mt-0.5" />
                                                <span>{item.target_certification_name || 'Program Standar'}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-emerald-700 font-medium mt-1">
                                                <Calendar01Icon size={12} />
                                                <span>Target: {item.target_period || 'Segera'}</span>
                                            </div>
                                        </td>

                                        {/* NIP & Batch */}
                                        <td className="py-3.5 px-4 text-center text-xs">
                                            {item.nip ? (
                                                <div className="space-y-0.5">
                                                    <span className="font-mono font-bold text-foreground bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 block">
                                                        {item.nip}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                                        {item.batch}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-slate-400 italic">Belum Diterbitkan</span>
                                            )}
                                        </td>

                                        {/* Status Badge */}
                                        <td className="py-3.5 px-4 text-center">
                                            {item.approval_status === 'pending' && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                                                    <Clock01Icon size={12} />
                                                    Menunggu ACC
                                                </span>
                                            )}
                                            {item.approval_status === 'approved' && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                                                    <CheckmarkCircle02Icon size={12} />
                                                    Disetujui
                                                </span>
                                            )}
                                            {item.approval_status === 'rejected' && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold" title={item.rejection_reason || undefined}>
                                                    <CancelCircleIcon size={12} />
                                                    Ditolak
                                                </span>
                                            )}
                                        </td>

                                        {/* Action Buttons */}
                                        <td className="py-3.5 px-4 text-right">
                                            {item.approval_status === 'pending' ? (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenApprove(item)}
                                                        className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-xs inline-flex items-center gap-1"
                                                    >
                                                        <CheckmarkCircle02Icon size={14} />
                                                        <span>Setujui</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenReject(item)}
                                                        className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-muted-foreground font-semibold text-xs transition-all"
                                                        title="Tolak Pendaftaran"
                                                    >
                                                        Tolak
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    {item.approval_status === 'approved' ? 'Akun Aktif' : 'Ditolak'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Menampilkan {registrations.length} dari {totalItems} pendaftar
                        </span>
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={(p) => setPage(p)}
                        />
                    </div>
                )}
            </GlassCard>

            {/* Modal Setujui (Approve) & Generate NIP — with Smart Batch Suggestion & Live NIP Preview */}
            {isApproveModalOpen && selectedItem && (
                <ClientPortal>
                    <div 
                        className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setIsApproveModalOpen(false)}
                    >
                        <div 
                            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                                    <CheckmarkCircle02Icon size={20} className="text-emerald-600" />
                                    <span>Persetujuan Akun Peserta</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsApproveModalOpen(false)}
                                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                                >
                                    <CancelCircleIcon size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleApproveSubmit} className="p-6 space-y-4">
                                {/* Summary Detail */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Nama Peserta:</span>
                                        <span className="font-bold text-foreground">{selectedItem.full_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Instansi:</span>
                                        <span className="font-semibold text-foreground">{selectedItem.institution || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Program Diminati:</span>
                                        <span className="font-semibold text-foreground text-right">{selectedItem.target_certification_name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Rencana Pelaksanaan:</span>
                                        <span className="font-bold text-emerald-700">{selectedItem.target_period || '-'}</span>
                                    </div>
                                </div>

                                {/* Batch Input — Smart Pre-fill */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Kode Batch Pelatihan <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={50}
                                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-foreground focus:bg-white focus:outline-none focus:border-foreground uppercase tracking-wide"
                                        placeholder="Contoh: CSBA-SEP26 atau 1"
                                        value={batchInput}
                                        onChange={(e) => setBatchInput(e.target.value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, ''))}
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Otomatis diusulkan dari program &amp; periode target. Anda dapat mengedit jika diperlukan.
                                    </p>
                                </div>

                                {/* Live Reactive NIP Preview */}
                                <div className="bg-slate-800 rounded-xl p-3.5 space-y-1">
                                    <span className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold block">
                                        Preview NIP Resmi
                                    </span>
                                    <span className="text-emerald-400 text-sm font-mono font-bold tracking-wide block">
                                        {batchInput.trim()
                                            ? previewNip(selectedItem.institution, batchInput)
                                            : '—'}
                                    </span>
                                    <p className="text-slate-500 text-[10px]">
                                        Nomor urut (001) akan dihitung otomatis oleh sistem saat data disimpan.
                                    </p>
                                </div>

                                {/* Auto-NIP Notice */}
                                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
                                    <InformationCircleIcon size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                                    <div className="space-y-1 leading-relaxed">
                                        <span className="font-bold">Penerbitan NIP Otomatis:</span>
                                        <p className="text-[11px] text-emerald-800">
                                            Saat disetujui, sistem akan secara atomik men-generate <strong>NIP resmi</strong> berbasis kode instansi & batch yang Anda tentukan, kemudian mengaktifkan akun peserta.
                                        </p>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsApproveModalOpen(false)}
                                        className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !batchInput.trim()}
                                        className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                                    >
                                        {isSubmitting ? 'Memproses...' : 'Setujui & Terbitkan NIP'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ClientPortal>
            )}

            {/* Modal Tolak (Reject) */}
            {isRejectModalOpen && selectedItem && (
                <ClientPortal>
                    <div 
                        className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setIsRejectModalOpen(false)}
                    >
                        <div 
                            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-base text-destructive flex items-center gap-2">
                                    <CancelCircleIcon size={20} />
                                    <span>Tolak Pendaftaran Peserta</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                                >
                                    <CancelCircleIcon size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Anda akan menolak pengajuan pendaftaran akun untuk <strong>{selectedItem.full_name}</strong> ({selectedItem.username}).
                                </p>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Alasan Penolakan (Opsional)
                                    </label>
                                    <textarea
                                        rows={3}
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground"
                                        placeholder="Contoh: Instansi atau data kontak tidak valid..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsRejectModalOpen(false)}
                                        className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Memproses...' : 'Konfirmasi Penolakan'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ClientPortal>
            )}
        </div>
    );
}
