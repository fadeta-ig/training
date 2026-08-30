'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClientPortal } from '@/components/ui/ClientPortal';
import { useConfirm } from '@/hooks/useConfirm';
import { toast } from 'sonner';
import {
    Certificate01Icon,
    PencilEdit02Icon,
    Delete02Icon,
    Search01Icon,
    Add01Icon,
    CheckmarkCircle02Icon,
    CancelCircleIcon,
    RefreshIcon,
    UserGroupIcon
} from 'hugeicons-react';

interface CertificationItem {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    is_active: boolean | number;
    participant_count: number;
    created_at: string;
    updated_at: string;
}

export default function CertificationsAdminPage() {
    const [certifications, setCertifications] = useState<CertificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCert, setEditingCert] = useState<CertificationItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [formState, setFormState] = useState({
        name: '',
        code: '',
        description: '',
        is_active: true,
    });

    const { confirm, ConfirmComponent } = useConfirm();

    const fetchCertifications = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/certifications?search=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data.success) {
                setCertifications(data.data || []);
            } else {
                toast.error(data.error || 'Gagal memuat program sertifikasi');
            }
        } catch {
            toast.error('Gagal terhubung ke server');
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        fetchCertifications();
    }, [fetchCertifications]);

    const handleOpenCreateModal = () => {
        setEditingCert(null);
        setFormState({
            name: '',
            code: '',
            description: '',
            is_active: true,
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (cert: CertificationItem) => {
        setEditingCert(cert);
        setFormState({
            name: cert.name,
            code: cert.code || '',
            description: cert.description || '',
            is_active: Boolean(cert.is_active),
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name.trim()) {
            toast.error('Nama program sertifikasi wajib diisi');
            return;
        }

        setIsSaving(true);
        try {
            const url = editingCert
                ? `/api/admin/certifications/${editingCert.id}`
                : '/api/admin/certifications';
            const method = editingCert ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formState),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(editingCert ? 'Program sertifikasi berhasil diperbarui' : 'Program sertifikasi berhasil ditambahkan');
                setIsModalOpen(false);
                fetchCertifications();
            } else {
                toast.error(data.error || 'Gagal menyimpan program sertifikasi');
            }
        } catch {
            toast.error('Terjadi kesalahan jaringan');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (cert: CertificationItem) => {
        const isConfirmed = await confirm({
            title: 'Hapus Program Sertifikasi?',
            message: `Apakah Anda yakin ingin menghapus program "${cert.name}"? Program ini tidak akan lagi muncul di formulir pendaftaran.`,
            isDestructive: true,
            confirmLabel: 'Ya, Hapus',
            cancelLabel: 'Batal',
        });

        if (!isConfirmed) return;

        try {
            const res = await fetch(`/api/admin/certifications/${cert.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Program sertifikasi berhasil dihapus');
                fetchCertifications();
            } else {
                toast.error(data.error || 'Gagal menghapus program sertifikasi');
            }
        } catch {
            toast.error('Gagal terhubung ke server');
        }
    };

    const handleToggleStatus = async (cert: CertificationItem) => {
        try {
            const newStatus = !cert.is_active;
            const res = await fetch(`/api/admin/certifications/${cert.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: cert.name,
                    code: cert.code,
                    description: cert.description,
                    is_active: newStatus,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(newStatus ? 'Program diaktifkan' : 'Program dinonaktifkan');
                fetchCertifications();
            } else {
                toast.error(data.error || 'Gagal mengubah status');
            }
        } catch {
            toast.error('Gagal mengubah status');
        }
    };

    return (
        <div className="space-y-6">
            <ConfirmComponent />

            {/* Page Header */}
            <PageHeader
                title="Master Program Sertifikasi"
                subtitle="Kelola daftar pilihan program sertifikasi kompetensi yang ditampilkan pada formulir pendaftaran peserta."
                icon={<Certificate01Icon size={24} className="text-primary" />}
                actions={
                    <div className="flex items-center gap-2">
                        <ActionButton
                            variant="secondary"
                            onClick={fetchCertifications}
                            icon={<RefreshIcon size={16} />}
                            title="Segarkan Data"
                        >
                            Refresh
                        </ActionButton>
                        <ActionButton
                            variant="primary"
                            onClick={handleOpenCreateModal}
                            icon={<Add01Icon size={16} />}
                        >
                            Tambah Program
                        </ActionButton>
                    </div>
                }
            />

            {/* Search & Filter Bar */}
            <GlassCard className="p-4">
                <div className="relative flex items-center">
                    <Search01Icon size={18} className="absolute left-3 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground focus:bg-white focus:outline-none focus:border-foreground transition-all"
                        placeholder="Cari program sertifikasi berdasarkan nama, kode, atau deskripsi..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </GlassCard>

            {/* Table / List View */}
            <GlassCard className="overflow-hidden p-0">
                {isLoading ? (
                    <div className="p-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Memuat data program sertifikasi...</span>
                    </div>
                ) : certifications.length === 0 ? (
                    <div className="p-8">
                        <EmptyState
                            icon={<Certificate01Icon size={40} />}
                            title="Belum Ada Program Sertifikasi"
                            description={searchQuery ? 'Tidak ada program yang sesuai dengan pencarian Anda.' : 'Tambahkan program sertifikasi baru untuk ditampilkan pada formulir pendaftaran.'}
                            action={
                                <ActionButton variant="primary" onClick={handleOpenCreateModal} icon={<Add01Icon size={16} />}>
                                    Tambah Program Pertama
                                </ActionButton>
                            }
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Kode</th>
                                    <th className="py-3.5 px-4">Nama Program Sertifikasi</th>
                                    <th className="py-3.5 px-4">Deskripsi Singkat</th>
                                    <th className="py-3.5 px-4 text-center">Pendaftar</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {certifications.map((cert) => {
                                    const isActive = Boolean(cert.is_active);
                                    return (
                                        <tr key={cert.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3.5 px-4 font-mono font-bold text-xs text-foreground shrink-0">
                                                {cert.code ? (
                                                    <span className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-800">
                                                        {cert.code}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 font-semibold text-foreground max-w-xs">
                                                {cert.name}
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-muted-foreground max-w-sm line-clamp-2">
                                                {cert.description || '-'}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-xs">
                                                    <UserGroupIcon size={12} />
                                                    {cert.participant_count || 0}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(cert)}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                                                        isActive
                                                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                                    title="Klik untuk mengubah status aktif"
                                                >
                                                    {isActive ? (
                                                        <>
                                                            <CheckmarkCircle02Icon size={13} />
                                                            <span>Aktif</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CancelCircleIcon size={13} />
                                                            <span>Non-Aktif</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(cert)}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
                                                        title="Edit Program"
                                                    >
                                                        <PencilEdit02Icon size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(cert)}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                        title="Hapus Program"
                                                    >
                                                        <Delete02Icon size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>

            {/* Modal Tambah / Edit Program */}
            {isModalOpen && (
                <ClientPortal>
                    <div 
                        className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <div 
                            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-base text-foreground">
                                    {editingCert ? 'Edit Program Sertifikasi' : 'Tambah Program Sertifikasi Baru'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-100"
                                >
                                    <CancelCircleIcon size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                {/* Nama Program */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Nama Program Sertifikasi <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground"
                                        placeholder="Contoh: Sertifikasi Tata Kelola IT & Cloud Architecture"
                                        value={formState.name}
                                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                    />
                                </div>

                                {/* Kode Program */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Kode Program (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-foreground font-mono uppercase focus:bg-white focus:outline-none focus:border-foreground"
                                        placeholder="Contoh: CERT-TKIT"
                                        value={formState.code}
                                        onChange={(e) => setFormState({ ...formState, code: e.target.value.toUpperCase() })}
                                    />
                                </div>

                                {/* Deskripsi */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                                        Deskripsi Singkat Program
                                    </label>
                                    <textarea
                                        rows={3}
                                        className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-foreground focus:bg-white focus:outline-none focus:border-foreground"
                                        placeholder="Penjelasan ringkas mengenai kompetensi dan materi uji..."
                                        value={formState.description}
                                        onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                    />
                                </div>

                                {/* Status Aktif */}
                                <div className="flex items-center gap-3 pt-2">
                                    <input
                                        type="checkbox"
                                        id="is_active_checkbox"
                                        className="w-4 h-4 rounded text-foreground focus:ring-foreground"
                                        checked={formState.is_active}
                                        onChange={(e) => setFormState({ ...formState, is_active: e.target.checked })}
                                    />
                                    <label htmlFor="is_active_checkbox" className="text-sm font-medium text-foreground cursor-pointer">
                                        Aktifkan program (ditampilkan di formulir pendaftaran peserta)
                                    </label>
                                </div>

                                {/* Modal Footer */}
                                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="h-10 px-5 rounded-xl bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all disabled:opacity-50"
                                    >
                                        {isSaving ? 'Menyimpan...' : editingCert ? 'Perbarui Program' : 'Simpan Program'}
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
