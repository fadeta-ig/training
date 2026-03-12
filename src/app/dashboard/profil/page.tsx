'use client';

import { useState, useEffect } from 'react';
import { UserCircleIcon, Tick01Icon, AlertCircleIcon } from 'hugeicons-react';

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

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
            .catch(() => setMessage({ type: 'error', text: 'Gagal memuat profil' }))
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (formData.new_password && formData.new_password !== formData.confirm_password) {
            setMessage({ type: 'error', text: 'Konfirmasi password baru tidak cocok' });
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
                setFormData(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
            } else {
                setMessage({ type: 'error', text: data.error || 'Terjadi kesalahan' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan' });
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
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Profil & Pengaturan</h1>
                <p className="text-muted-foreground text-sm mt-1">Kelola detail personal dan keamanan akun Anda.</p>
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold ${message.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-100 text-emerald-800'}`}>
                    {message.type === 'error' ? <AlertCircleIcon size={20} /> : <Tick01Icon size={20} />}
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass-card p-6 md:p-8 space-y-6">
                    <div className="flex items-center gap-6 border-b border-black/5 pb-6">
                        <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center text-muted-foreground shrink-0 border border-black/10">
                            <UserCircleIcon size={40} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">{formData.full_name || 'Peserta'}</h2>
                            <p className="text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-full inline-block mt-1">Peserta Aktif</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nama Lengkap</label>
                            <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} required
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Username</label>
                            <input type="text" value={formData.username} disabled
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-black/5 text-muted-foreground text-sm cursor-not-allowed" />
                            <p className="text-[10px] text-muted-foreground px-1">Username tidak dapat diubah.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nomor Telepon</label>
                            <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jenis Kelamin</label>
                            <select name="gender" value={formData.gender} onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all">
                                <option value="">Pilih...</option>
                                <option value="male">Laki-Laki</option>
                                <option value="female">Perempuan</option>
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
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alamat Lengkap</label>
                            <textarea name="address" value={formData.address} onChange={handleChange} rows={3}
                                className="w-full px-4 py-2.5 rounded-xl border border-black/10 bg-white/50 focus:ring-2 focus:ring-foreground/20 outline-none text-sm transition-all resize-none"></textarea>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-6 md:p-8 space-y-6">
                    <div>
                        <h3 className="text-base font-bold">Keamanan Akun</h3>
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
                        className="flex items-center gap-2 bg-foreground text-background px-8 py-3 rounded-xl text-sm font-bold hover:bg-foreground/90 transition-colors active:scale-95 disabled:opacity-50">
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
