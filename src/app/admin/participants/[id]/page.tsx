'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PencilEdit01Icon, FloppyDiskIcon, ArrowLeft01Icon, RefreshIcon, Copy01Icon, Tick01Icon, Calendar01Icon, Building02Icon } from 'hugeicons-react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';

export default function EditParticipantPage() {
    const router = useRouter();
    const params = useParams();
    const participantId = params.id as string;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [nip, setNip] = useState<string | null>(null);
    const [copiedNip, setCopiedNip] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone_number: '',
        address: '',
        date_of_birth: '',
        gender: '',
        institution: '',
        batch: '1',
        registration_date: '',
    });

    useEffect(() => {
        const fetchParticipant = async () => {
            try {
                const res = await fetch(`/api/admin/participants/${participantId}`);
                const result = await res.json();

                if (res.ok && result.success) {
                    const data = result.data;
                    setNip(data.nip || null);
                    setFormData({
                        name: data.name || '',
                        email: data.email || '',
                        phone_number: data.phone_number || '',
                        address: data.address || '',
                        date_of_birth: data.date_of_birth ? data.date_of_birth.split('T')[0] : '',
                        gender: data.gender || '',
                        institution: data.institution || '',
                        batch: data.batch ? String(data.batch) : '1',
                        registration_date: data.registration_date ? data.registration_date.split('T')[0] : '',
                    });
                } else {
                    throw new Error(result.error || 'Peserta tidak ditemukan');
                }
            } catch (err: any) {
                toast.error('Gagal memuat peserta', { description: err.message });
            } finally {
                setIsFetching(false);
            }
        };

        if (participantId) fetchParticipant();
    }, [participantId]);

    const handleCopyNip = async () => {
        if (!nip) return;
        await navigator.clipboard.writeText(nip);
        setCopiedNip(true);
        toast.success('NIP disalin ke clipboard!');
        setTimeout(() => setCopiedNip(false), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch(`/api/admin/participants/${participantId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (res.ok && result.success) {
                toast.success('Data peserta berhasil diperbarui!');
                router.push('/admin/participants');
                router.refresh();
            } else {
                let errorMsg = result.error || 'Gagal memperbarui peserta';
                if (result.details) {
                    const firstKey = Object.keys(result.details)[0];
                    if (firstKey) errorMsg = result.details[firstKey][0];
                }
                toast.error('Gagal memperbarui data', { description: errorMsg });
            }
        } catch (err: any) {
            toast.error('Terjadi kesalahan sistem', { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshIcon size={32} className="animate-spin text-muted-foreground opacity-50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="flex items-center gap-4 border-b border-black/5 pb-6">
                <Link
                    href="/admin/participants"
                    className="p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <PencilEdit01Icon size={28} className="text-muted-foreground" />
                        Edit Data Peserta
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Perbarui informasi identitas, instansi, batch, dan tanggal pendaftaran peserta.
                    </p>
                </div>
            </div>

            {/* NIP Official Identity Badge */}
            {nip && (
                <div className="bg-primary/[0.06] border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider">Nomor Induk Peserta (NIP Resmi)</p>
                        <p className="text-lg font-mono font-bold tracking-wider text-primary">{nip}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleCopyNip}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-primary/20 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
                    >
                        {copiedNip ? <Tick01Icon size={16} className="text-emerald-600" /> : <Copy01Icon size={16} />}
                        <span>{copiedNip ? 'Tersalin' : 'Salin NIP'}</span>
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <GlassCard className="p-4 sm:p-6 md:p-8 space-y-6">
                    <h2 className="text-lg font-bold border-b border-black/5 pb-3 flex items-center gap-2">
                        <Building02Icon size={20} className="text-muted-foreground" />
                        Informasi Akun & Instansi
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Nama Lengkap <span className="text-destructive">*</span></label>
                            <input
                                type="text"
                                required
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                placeholder="Sesuai kartu identitas"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Email Aktif <span className="text-destructive">*</span></label>
                            <input
                                type="email"
                                required
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                placeholder="m.peserta@email.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Institusi / Instansi</label>
                            <input
                                type="text"
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                placeholder="Asal Instansi"
                                value={formData.institution}
                                onChange={e => setFormData({ ...formData, institution: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Batch (Angkatan / Gelombang Pelatihan) <span className="text-destructive">*</span></label>
                            <input
                                type="text"
                                maxLength={50}
                                required
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none uppercase"
                                placeholder="Contoh: CSBA-SEP26 atau 1"
                                value={formData.batch}
                                onChange={e => setFormData({ ...formData, batch: e.target.value.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '') })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <Calendar01Icon size={16} className="text-muted-foreground" />
                                Tanggal Pendaftaran
                            </label>
                            <input
                                type="date"
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                value={formData.registration_date}
                                onChange={e => setFormData({ ...formData, registration_date: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Nomor HP / WhatsApp</label>
                            <input
                                type="text"
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                placeholder="+62 8..."
                                value={formData.phone_number}
                                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Tanggal Lahir</label>
                            <input
                                type="date"
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                value={formData.date_of_birth}
                                onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Jenis Kelamin <span className="text-destructive">*</span></label>
                            <select
                                required
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none appearance-none"
                                value={formData.gender}
                                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                            >
                                <option value="">Pilih Jenis Kelamin</option>
                                <option value="L">Laki-laki</option>
                                <option value="P">Perempuan</option>
                            </select>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-bold text-foreground">Alamat Domisili</label>
                            <textarea
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none resize-none"
                                placeholder="Alamat lengkap"
                                rows={3}
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            ></textarea>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-black/5 flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-3 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                            <FloppyDiskIcon size={18} />
                            {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </GlassCard>
            </form>
        </div>
    );
}
