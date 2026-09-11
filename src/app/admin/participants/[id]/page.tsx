'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
    PencilEdit01Icon, 
    FloppyDiskIcon, 
    ArrowLeft01Icon, 
    RefreshIcon, 
    Copy01Icon, 
    Tick01Icon, 
    Calendar01Icon, 
    Building02Icon, 
    MailSend01Icon,
    Key01Icon,
    ViewIcon,
    ViewOffIcon,
    CheckmarkCircle02Icon,
    Alert02Icon
} from 'hugeicons-react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';

export default function EditParticipantPage() {
    const router = useRouter();
    const params = useParams();
    const participantId = params.id as string;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [isResending, setIsResending] = useState(false);
    const [nip, setNip] = useState<string | null>(null);
    const [copiedNip, setCopiedNip] = useState(false);
    const [initialPassword, setInitialPassword] = useState<string | null>(null);
    const [mustChangePassword, setMustChangePassword] = useState<number>(0);
    const [showPassword, setShowPassword] = useState(false);
    const [copiedPassword, setCopiedPassword] = useState(false);
    const [regenerateNip, setRegenerateNip] = useState(false);
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
                    setInitialPassword(data.initial_password || null);
                    setMustChangePassword(data.must_change_password !== undefined ? Number(data.must_change_password) : 0);
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

    const handleResendCredentials = async () => {
        if (!participantId || !formData.email) return;
        setIsResending(true);
        try {
            const res = await fetch('/api/admin/participants/resend-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participant_ids: [participantId] }),
            });
            const result = await res.json();
            if (res.ok && result.success && result.results?.length > 0) {
                const item = result.results[0];
                if (item.newPassword) {
                    setInitialPassword(item.newPassword);
                    setMustChangePassword(1);
                }
                if (item.emailSent) {
                    toast.success('Kredensial berhasil dikirim!', {
                        description: `Password baru dibuat dan dikirim ke ${formData.email}. Password: ${item.newPassword}`,
                    });
                } else {
                    toast.warning('Password diperbarui (Email tertunda)', {
                        description: `Password baru: ${item.newPassword}`,
                    });
                }
            } else {
                toast.error('Gagal mengirim kredensial', { description: result.error });
            }
        } catch (err: any) {
            toast.error('Terjadi kesalahan koneksi', { description: err.message });
        } finally {
            setIsResending(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch(`/api/admin/participants/${participantId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    regenerate_nip: regenerateNip,
                })
            });

            const result = await res.json();

            if (res.ok && result.success) {
                toast.success('Data peserta berhasil diperbarui!');
                if (result.nip) setNip(result.nip);
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
                <button
                    type="button"
                    onClick={handleResendCredentials}
                    disabled={isResending}
                    className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    title="Reset password dan kirim kredensial baru ke email peserta"
                >
                    {isResending ? <RefreshIcon size={16} className="animate-spin" /> : <MailSend01Icon size={16} />}
                    <span>{isResending ? 'Mengirim...' : 'Kirim Ulang Kredensial'}</span>
                </button>
            </div>

            {/* NIP Official Identity Badge */}
            {nip && (
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:bg-slate-900/60 dark:border-slate-800">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nomor Induk Peserta (NIP Resmi)</p>
                        <p className="text-lg font-mono font-bold tracking-wider text-slate-900 dark:text-white">{nip}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleCopyNip}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
                    >
                        {copiedNip ? <Tick01Icon size={16} className="text-emerald-600" /> : <Copy01Icon size={16} />}
                        <span>{copiedNip ? 'Tersalin' : 'Salin NIP'}</span>
                    </button>
                </div>
            )}

            {/* Kredensial & Password Card */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 dark:bg-slate-900/60 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Key01Icon size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kredensial & Kata Sandi Akun</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Kata sandi akun peserta untuk login ke LMS</p>
                        </div>
                    </div>
                    {mustChangePassword === 1 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                            <Alert02Icon size={14} />
                            Wajib Ubah Sandi (Default)
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckmarkCircle02Icon size={14} />
                            Sandi Mandiri / Aktif
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Username / Email Login</span>
                        <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white truncate">{formData.email || '-'}</span>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (formData.email) {
                                        await navigator.clipboard.writeText(formData.email);
                                        toast.success('Email disalin ke clipboard!');
                                    }
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Salin Email"
                            >
                                <Copy01Icon size={15} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kata Sandi (Initial Password)</span>
                            {initialPassword && (
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                    {showPassword ? <ViewOffIcon size={14} /> : <ViewIcon size={14} />}
                                    <span>{showPassword ? 'Sembunyikan' : 'Tampilkan'}</span>
                                </button>
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                            {initialPassword ? (
                                <span className="font-mono text-sm font-bold tracking-wider text-slate-900 dark:text-white select-all">
                                    {showPassword ? initialPassword : '••••••••••••'}
                                </span>
                            ) : (
                                <span className="text-xs text-slate-400 italic">Tidak tercatat di database (Akun lama)</span>
                            )}
                            {initialPassword && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(initialPassword);
                                        setCopiedPassword(true);
                                        toast.success('Password disalin ke clipboard!');
                                        setTimeout(() => setCopiedPassword(false), 2000);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                                >
                                    {copiedPassword ? <Tick01Icon size={14} className="text-emerald-600" /> : <Copy01Icon size={14} />}
                                    <span>{copiedPassword ? 'Tersalin' : 'Salin Sandi'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {mustChangePassword === 0 && initialPassword && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        * Catatan: Peserta telah mengubah sandi akun. Sandi yang tercatat di atas adalah kata sandi awal saat registrasi/reset terakhir.
                    </p>
                )}
            </div>

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
                            
                            {/* Regenerate NIP Toggle */}
                            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={regenerateNip}
                                    onChange={e => setRegenerateNip(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                                    <RefreshIcon size={14} className="shrink-0" />
                                    Perbarui NIP otomatis sesuai Batch baru saat disimpan
                                </span>
                            </label>
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
