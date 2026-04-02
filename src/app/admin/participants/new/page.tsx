'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserAdd01Icon, FloppyDiskIcon, ArrowLeft01Icon, Copy01Icon, Tick01Icon, Key01Icon, MailSend01Icon } from 'hugeicons-react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { toast } from 'sonner';

type Credentials = {
    username: string;
    password: string;
};

export default function NewParticipantPage() {
    const router = useRouter();
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
        institution: ''
    });

    const handleCopy = async (value: string, field: string) => {
        await navigator.clipboard.writeText(value);
        setCopiedField(field);
        toast.success('Disalin ke clipboard!');
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleCopyAll = async () => {
        if (!credentials) return;
        const text = `Login Peserta\nUsername: ${credentials.username}\nPassword: ${credentials.password}`;
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
                    password: credentials.password
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
            <div className="space-y-8 max-w-lg mx-auto pt-8">
                <GlassCard className="p-8 space-y-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                        <Key01Icon size={32} />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Peserta Berhasil Dibuat!</h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            Berikut adalah kredensial login peserta. Salin dan kirimkan secara manual ke peserta.
                        </p>
                    </div>

                    <div className="space-y-3 text-left">
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
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Password</p>
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
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="flex gap-3">
                            <button
                                onClick={handleCopyAll}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl border border-black/10 hover:bg-black/5 transition-colors active:scale-95"
                            >
                                <Copy01Icon size={16} />
                                Salin
                            </button>

                            <button
                                onClick={handleSendEmail}
                                disabled={isSendingEmail}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl border border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors active:scale-95 disabled:opacity-50"
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
                                    setFormData({ name: '', email: '', phone_number: '', address: '', date_of_birth: '', gender: '', institution: '' });
                                }}
                                className="flex-1 px-5 py-3 text-sm font-semibold rounded-xl border border-black/10 hover:bg-black/5 transition-colors active:scale-95"
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
                        Akun akan otomatis dibuat dan password akan ditampilkan di halaman ini.
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
                            {isLoading ? 'Menyimpan...' : 'Simpan & Daftarkan'}
                        </button>
                    </div>
                </GlassCard>
            </form>
        </div>
    );
}
