'use client';

import { useState } from 'react';
import { UserAdd01Icon, FloppyDiskIcon, ArrowLeft01Icon, Copy01Icon, Tick01Icon, Key01Icon, MailSend01Icon, IdIcon, Building02Icon, Calendar01Icon } from 'hugeicons-react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';

type Credentials = {
    username: string;
    password: string;
    nip?: string;
    batch?: string;
    registration_date?: string;
    institution?: string;
};

export default function NewParticipantPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [credentials, setCredentials] = useState<Credentials | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone_number: '',
        address: '',
        date_of_birth: '',
        gender: '',
        institution: '',
        batch: '1',
        registration_date: new Date().toISOString().slice(0, 10),
    });

    const handleCopy = async (value: string, field: string) => {
        await navigator.clipboard.writeText(value);
        setCopiedField(field);
        toast.success('Disalin ke clipboard!');
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleCopyAll = async () => {
        if (!credentials) return;
        const text = `Data Akun Peserta\nNama: ${formData.name}\nNIP: ${credentials.nip || '-'}\nUsername: ${credentials.username}\nPassword: ${credentials.password}\nBatch: ${credentials.batch || '1'}\nInstansi: ${credentials.institution || '-'}`;
        await navigator.clipboard.writeText(text);
        toast.success('Semua kredensial disalin!');
    };

    const handleSendEmail = async () => {
        if (!credentials) return;
        setIsSendingEmail(true);
        try {
            const res = await fetch('/api/admin/users/send-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    nip: credentials.nip,
                })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                toast.success('Berhasil!', { description: result.message || 'Kredensial berhasil dikirim ke email peserta.' });
            } else {
                toast.error('Gagal mengirim email', { description: result.error });
            }
        } catch (err: any) {
            toast.error('Gagal mengirim email', { description: err.message });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch('/api/admin/participants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (res.ok && result.success) {
                // Show credentials modal instead of redirecting
                setCredentials(result.credentials);
                toast.success('Peserta berhasil didaftarkan!');
            } else {
                let errorMsg = result.error || 'Gagal menyimpan peserta';
                if (result.details) {
                    const firstKey = Object.keys(result.details)[0];
                    if (firstKey) errorMsg = result.details[firstKey][0];
                }
                toast.error('Gagal menyimpan data', { description: errorMsg });
            }
        } catch (err: any) {
            toast.error('Gagal menyimpan data', { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    // Credentials Success Modal
    if (credentials) {
        return (
            <div className="space-y-8 max-w-lg mx-auto py-8">
                <GlassCard className="p-8 space-y-6 text-center">
                    {/* Success Icon */}
                    <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                        <Key01Icon size={32} />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">Peserta Berhasil Didaftarkan!</h2>
                        <p className="text-sm text-muted-foreground">
                            Akun dan NIP resmi peserta telah otomatis dibuat oleh sistem.
                        </p>
                    </div>

                    {/* Credentials Display */}
                    <div className="space-y-3 text-left">
                        {/* NIP */}
                        {credentials.nip && (
                            <div className="bg-primary/[0.06] border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Nomor Induk Peserta (NIP)</p>
                                    <p className="text-sm font-mono font-bold mt-0.5 tracking-wider text-primary truncate">{credentials.nip}</p>
                                </div>
                                <button
                                    onClick={() => handleCopy(credentials.nip || '', 'nip')}
                                    className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors shrink-0"
                                    title="Salin NIP"
                                >
                                    {copiedField === 'nip' ? <Tick01Icon size={16} className="text-emerald-600" /> : <Copy01Icon size={16} />}
                                </button>
                            </div>
                        )}

                        {/* Username */}
                        <div className="bg-black/[0.03] rounded-xl p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Username (Email)</p>
                                <p className="text-sm font-bold mt-0.5 truncate">{credentials.username}</p>
                            </div>
                            <button
                                onClick={() => handleCopy(credentials.username, 'username')}
                                className="p-2 rounded-lg hover:bg-black/5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                title="Salin username"
                            >
                                {copiedField === 'username' ? <Tick01Icon size={16} className="text-emerald-600" /> : <Copy01Icon size={16} />}
                            </button>
                        </div>

                        {/* Password */}
                        <div className="bg-black/[0.03] rounded-xl p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Password Awal</p>
                                <p className="text-sm font-mono font-bold mt-0.5 tracking-wider text-foreground">{credentials.password}</p>
                            </div>
                            <button
                                onClick={() => handleCopy(credentials.password, 'password')}
                                className="p-2 rounded-lg hover:bg-black/5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                title="Salin password"
                            >
                                {copiedField === 'password' ? <Tick01Icon size={16} className="text-emerald-600" /> : <Copy01Icon size={16} />}
                            </button>
                        </div>

                        {/* Batch & Institution Info */}
                        <div className="bg-black/[0.02] border border-black/[0.06] rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="text-muted-foreground">Institusi:</span>
                                <p className="font-semibold text-foreground truncate">{credentials.institution || '-'}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Angkatan / Batch:</span>
                                <p className="font-semibold text-foreground">{/^\d+$/.test(String(credentials.batch || '1')) ? `Batch ${credentials.batch}` : credentials.batch}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="flex gap-3">
                            <button
                                onClick={handleCopyAll}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl border border-black/10 hover:bg-black/5 transition-colors active:scale-95 cursor-pointer"
                            >
                                <Copy01Icon size={16} />
                                Salin Semua
                            </button>

                            <button
                                onClick={handleSendEmail}
                                disabled={isSendingEmail}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl border border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                {isSendingEmail ? (
                                    <div className="w-4 h-4 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <MailSend01Icon size={16} />
                                )}
                                Kirim via Email
                            </button>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setCredentials(null);
                                    setFormData({
                                        name: '',
                                        email: '',
                                        phone_number: '',
                                        address: '',
                                        date_of_birth: '',
                                        gender: '',
                                        institution: '',
                                        batch: '1',
                                        registration_date: new Date().toISOString().slice(0, 10),
                                    });
                                }}
                                className="flex-1 px-5 py-3 text-sm font-semibold rounded-xl border border-black/10 hover:bg-black/5 transition-colors active:scale-95 cursor-pointer"
                            >
                                Tambah Peserta Lagi
                            </button>
                            <Link
                                href="/admin/participants"
                                className="flex-1 px-5 py-3 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors text-center active:scale-95"
                            >
                                Ke Daftar Peserta
                            </Link>
                        </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground/70 bg-amber-50 text-amber-700 px-3 py-2 rounded-lg">
                        ⚠️ Password ini hanya ditampilkan sekali. Pastikan Anda sudah menyalinnya sebelum meninggalkan halaman ini.
                    </p>
                </GlassCard>
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
                        <UserAdd01Icon size={28} className="text-muted-foreground" />
                        Tambah Peserta Baru
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        NIP resmi dan akun peserta akan otomatis digenerate oleh sistem.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <GlassCard className="p-4 sm:p-6 md:p-8 space-y-6">
                    <h2 className="text-lg font-bold border-b border-black/5 pb-3 flex items-center gap-2">
                        <Building02Icon size={20} className="text-muted-foreground" />
                        Informasi Identitas & Instansi
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
                                placeholder="Contoh: PT Telkom Indonesia"
                                value={formData.institution}
                                onChange={e => setFormData({ ...formData, institution: e.target.value })}
                            />
                            <p className="text-[11px] text-muted-foreground">Inisial institusi akan digunakan sebagai prefix NIP.</p>
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
                            <p className="text-[11px] text-muted-foreground">Dapat berupa angka gelombang (1) atau kode sertifikasi (CSBA-SEP26).</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <Calendar01Icon size={16} className="text-muted-foreground" />
                                Tanggal Pendaftaran
                            </label>
                            <input
                                type="date"
                                required
                                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none"
                                value={formData.registration_date}
                                onChange={e => setFormData({ ...formData, registration_date: e.target.value })}
                            />
                            <p className="text-[11px] text-muted-foreground">Menentukan komponen tahun-bulan (YYMM) pada NIP.</p>
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
                            {isLoading ? 'Menyimpan...' : 'Simpan & Daftarkan'}
                        </button>
                    </div>
                </GlassCard>
            </form>
        </div>
    );
}
