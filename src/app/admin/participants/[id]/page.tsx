'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PencilEdit01Icon, FloppyDiskIcon, ArrowLeft01Icon, RefreshIcon } from 'hugeicons-react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';

export default function EditParticipantPage() {
    const router = useRouter();
    const params = useParams();
    const participantId = params.id as string;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone_number: '',
        address: '',
        date_of_birth: '',
        gender: '',
        institution: ''
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchParticipant = async () => {
            try {
                const res = await fetch(`/api/admin/participants/${participantId}`);
                const result = await res.json();

                if (res.ok && result.success) {
                    const data = result.data;
                    setFormData({
                        name: data.name || '',
                        email: data.email || '',
                        phone_number: data.phone_number || '',
                        address: data.address || '',
                        date_of_birth: data.date_of_birth ? data.date_of_birth.split('T')[0] : '', // format to YYYY-MM-DD for date input
                        gender: data.gender || '',
                        institution: data.institution || '',
                    });
                } else {
                    throw new Error(result.error || 'Peserta tidak ditemukan');
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsFetching(false);
            }
        };

        if (participantId) fetchParticipant();
    }, [participantId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

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
                        Perbarui informasi kontak dan data diri peserta secara manual.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <GlassCard className="p-8">
                    <h2 className="text-lg font-bold mb-6 border-b border-black/5 pb-2">Informasi Akun & Kontak Lengkap</h2>
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
                            <label className="text-sm font-bold text-foreground">Nomor HP</label>
                            <input
                                type="text"
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                placeholder="+62 8..."
                                value={formData.phone_number}
                                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Institusi/Instansi</label>
                            <input
                                type="text"
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                placeholder="Asal Instansi"
                                value={formData.institution}
                                onChange={e => setFormData({ ...formData, institution: e.target.value })}
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
                            <label className="text-sm font-bold text-foreground">Jenis Kelamin</label>
                            <select
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

                    <div className="pt-8 flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-3 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50"
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
