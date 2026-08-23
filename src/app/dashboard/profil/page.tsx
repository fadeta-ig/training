'use client';

import { useState, useEffect } from 'react';
import { UserCircleIcon, Tick01Icon, AlertCircleIcon, Copy01Icon, Building02Icon, Calendar01Icon, IdIcon, SecurityLockIcon } from 'hugeicons-react';
import { toast } from 'sonner';

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [copiedNip, setCopiedNip] = useState(false);

    const [participantInfo, setParticipantInfo] = useState<{
        nip: string | null;
        institution_code: string | null;
        batch: number | null;
        registration_date: string | null;
        created_at: string | null;
    }>({
        nip: null,
        institution_code: null,
        batch: null,
        registration_date: null,
        created_at: null,
    });

    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        phone_number: '',
        address: '',
        date_of_birth: '',
        gender: '',
        institution: '',
        current_password: '',
        new_password: '',
        confirm_password: ''
    });

    useEffect(() => {
        fetch('/api/participant/profile')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    const d = data.data;
                    setParticipantInfo({
                        nip: d.nip || null,
                        institution_code: d.institution_code || null,
                        batch: d.batch || 1,
                        registration_date: d.registration_date || null,
                        created_at: d.created_at || null,
                    });
                    setFormData(prev => ({
                        ...prev,
                        full_name: d.full_name || '',
                        username: d.username || '',
                        phone_number: d.phone_number || '',
                        address: d.address || '',
                        date_of_birth: d.date_of_birth ? d.date_of_birth.split('T')[0] : '',
                        gender: d.gender || '',
                        institution: d.institution || ''
                    }));
                }
            })
            .catch(() => {
                setMessage({ type: 'error', text: 'Gagal memuat data profil. Periksa koneksi jaringan Anda.' });
                toast.error('Gagal Memuat Profil', { description: 'Periksa koneksi jaringan Anda dan coba muat ulang halaman.' });
            })
            .finally(() => setLoading(false));
    }, []);

    const handleCopyNip = async () => {
        if (!participantInfo.nip) return;
        await navigator.clipboard.writeText(participantInfo.nip);
        setCopiedNip(true);
        toast.success('NIP disalin ke clipboard!');
        setTimeout(() => setCopiedNip(false), 2000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (formData.new_password && formData.new_password !== formData.confirm_password) {
            setMessage({ type: 'error', text: 'Konfirmasi password baru tidak cocok' });
            toast.warning('Peringatan', { description: 'Konfirmasi password baru tidak cocok dengan password baru yang Anda masukkan.' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/participant/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Profil berhasil diperbarui' });
                toast.success('Profil Berhasil Diperbarui!', { description: 'Perubahan data profil dan keamanan akun Anda telah tersimpan.' });
                setFormData(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
            } else {
                const errMsg = data.error || 'Terjadi kesalahan saat menyimpan perubahan';
                setMessage({ type: 'error', text: errMsg });
                toast.error('Gagal Menyimpan Profil', { description: errMsg });
            }
        } catch {
            setMessage({ type: 'error', text: 'Terjadi kesalahan koneksi jaringan' });
            toast.error('Kesalahan Jaringan', { description: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-20">
                <div className="w-8 h-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-12">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Profil & Identitas Peserta</h1>
                <p className="text-muted-foreground text-sm mt-1">Kelola detail identitas, instansi, dan keamanan akun pelatihan Anda.</p>
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold ${message.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-100 text-emerald-800'}`}>
                    {message.type === 'error' ? <AlertCircleIcon size={20} /> : <Tick01Icon size={20} />}
                    {message.text}
                </div>
            )}

            {/* Official Participant Identity Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-7 shadow-lg border border-slate-700/50">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
                            <UserCircleIcon size={36} />
                        </div>
                        <div>
                            <span className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full inline-block">
                                Peserta Terverifikasi
                            </span>
                            <h2 className="text-xl font-bold mt-1 text-white">{formData.full_name || 'Peserta'}</h2>
                            <p className="text-xs text-slate-300 font-mono mt-0.5">{formData.username}</p>
                        </div>
                    </div>

                    {participantInfo.nip && (
                        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3.5 flex items-center justify-between gap-3 self-start sm:self-auto">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Nomor Induk Peserta (NIP)</p>
                                <p className="text-sm font-mono font-bold text-white tracking-wider mt-0.5">{participantInfo.nip}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyNip}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                                title="Salin NIP"
                            >
                                {copiedNip ? <Tick01Icon size={16} className="text-emerald-400" /> : <Copy01Icon size={16} />}
                            </button>
                        </div>
                    )}
                </div>

                {/* Identity Metadata Footer */}
                <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                        <span className="text-slate-400 block text-[11px]">Institusi / Organisasi:</span>
                        <p className="font-semibold text-slate-100 truncate mt-0.5">
                            {formData.institution || 'Umum'}
                        </p>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[11px]">Batch Pelatihan:</span>
                        <p className="font-semibold text-emerald-300 mt-0.5">
                            Batch {participantInfo.batch || 1}
                        </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <span className="text-slate-400 block text-[11px]">Tanggal Pendaftaran:</span>
                        <p className="font-semibold text-slate-100 mt-0.5">
                            {participantInfo.registration_date
                                ? new Date(participantInfo.registration_date).toLocaleDateString('id-ID', { dateStyle: 'medium' })
                                : participantInfo.created_at
                                ? new Date(participantInfo.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })
                                : '-'}
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass-card p-6 md:p-8 space-y-6">
                    <h2 className="text-base font-bold border-b border-black/5 pb-3 flex items-center gap-2">
                        <Building02Icon size={18} className="text-muted-foreground" />
                        Data Diri & Kontak
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nama Lengkap</label>
                            <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} required
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email (Akun Login)</label>
                            <input type="text" value={formData.username} disabled
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-black/5 text-muted-foreground text-sm cursor-not-allowed" />
                            <p className="text-[10px] text-muted-foreground px-1">Email login terikat dengan akun dan tidak dapat diubah.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nomor Telepon / WhatsApp</label>
                            <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jenis Kelamin</label>
                            <select name="gender" value={formData.gender} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all">
                                <option value="">Pilih...</option>
                                <option value="L">Laki-Laki</option>
                                <option value="P">Perempuan</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tanggal Lahir</label>
                            <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Institusi / Instansi</label>
                            <input type="text" name="institution" value={formData.institution} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all" />
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alamat Domisili</label>
                            <textarea name="address" value={formData.address} onChange={handleChange} rows={3}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all resize-none"></textarea>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-6 md:p-8 space-y-6">
                    <div>
                        <h3 className="text-base font-bold flex items-center gap-2">
                            <SecurityLockIcon size={18} className="text-muted-foreground" />
                            Keamanan Kata Sandi
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">Kosongkan bagian ini jika Anda tidak ingin mengganti kata sandi.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password Saat Ini</label>
                            <input type="password" name="current_password" value={formData.current_password} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all" />
                        </div>
                        <div className="hidden md:block"></div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password Baru</label>
                            <input type="password" name="new_password" value={formData.new_password} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Konfirmasi Password Baru</label>
                            <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="submit" disabled={submitting}
                        className="flex items-center gap-2 bg-foreground text-background px-8 py-3 rounded-xl text-sm font-bold hover:bg-foreground/90 transition-colors active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm">
                        {submitting ? (
                            <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
                        ) : (
                            <Tick01Icon size={18} />
                        )}
                        Simpan Perubahan
                    </button>
                </div>
            </form>
        </div>
    );
}
