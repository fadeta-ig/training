'use client';

import React, { useState } from 'react';
import {
    SecurityLockIcon,
    Tick01Icon,
    AlertCircleIcon,
    ViewIcon,
    ViewOffIcon,
    UserIcon,
    Call02Icon,
    Calendar01Icon,
    Location01Icon,
    ArrowRight01Icon,
} from 'hugeicons-react';
import { toast } from 'sonner';
import type { AuthPayload } from '@/types';

interface FirstLoginModalProps {
    user: AuthPayload | null;
}

export function FirstLoginModal({ user }: FirstLoginModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [formData, setFormData] = useState({
        full_name: user?.full_name || '',
        gender: (user?.gender || '') as 'L' | 'P' | '',
        phone_number: user?.phone_number || '',
        date_of_birth: user?.date_of_birth || '',
        address: user?.address || '',
        new_password: '',
        confirm_password: '',
    });

    // Password strength evaluator
    const getPasswordStrength = (pass: string): { score: number; label: string; color: string } => {
        if (!pass) return { score: 0, label: '', color: 'bg-slate-200' };
        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        switch (score) {
            case 1:
                return { score: 25, label: 'Lemah', color: 'bg-rose-500' };
            case 2:
                return { score: 50, label: 'Cukup', color: 'bg-amber-500' };
            case 3:
                return { score: 75, label: 'Baik', color: 'bg-blue-500' };
            case 4:
                return { score: 100, label: 'Sangat Kuat', color: 'bg-emerald-500' };
            default:
                return { score: 10, label: 'Terlalu Pendek', color: 'bg-rose-400' };
        }
    };

    const passwordStrength = getPasswordStrength(formData.new_password);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        if (!formData.gender) {
            setErrorMessage('Silakan pilih jenis kelamin Anda untuk melengkapi data.');
            toast.warning('Data Belum Lengkap', { description: 'Pilih jenis kelamin Anda terlebih dahulu.' });
            return;
        }

        if (formData.new_password.length < 8) {
            setErrorMessage('Kata sandi baru minimal 8 karakter.');
            toast.warning('Kata Sandi Kurang Kuat', { description: 'Kata sandi minimal 8 karakter.' });
            return;
        }

        if (formData.new_password !== formData.confirm_password) {
            setErrorMessage('Konfirmasi kata sandi tidak cocok dengan kata sandi baru.');
            toast.warning('Kata Sandi Berbeda', { description: 'Pastikan kedua kolom kata sandi bernilai sama.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/participant/first-login-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const result = await res.json();

            if (res.ok && result.success) {
                toast.success('Akun Berhasil Diamankan!', {
                    description: 'Demi keamanan akun, Anda diarahkan untuk masuk kembali menggunakan kata sandi baru.',
                    duration: 4000,
                });

                // Short delay to allow user to see success state before redirecting
                setTimeout(() => {
                    window.location.href = '/auth/login?reason=password_changed';
                }, 800);
            } else {
                setErrorMessage(result.error || 'Gagal menyimpan perubahan kata sandi dan profil.');
                toast.error('Gagal Menyimpan', { description: result.error });
                setIsSubmitting(false);
            }
        } catch {
            setErrorMessage('Terjadi kendala koneksi ke server. Silakan periksa jaringan Anda.');
            toast.error('Kesalahan Jaringan');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6 overflow-y-auto bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300">
            <div 
                className="relative w-full max-w-xl my-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top Ambient Highlight */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

                {/* Modal Header */}
                <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-b from-slate-50/70 to-white dark:from-slate-800/40 dark:to-slate-900">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-xs">
                            <SecurityLockIcon size={24} />
                        </div>
                        <div className="min-w-0">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Aktivasi Akun Pertama Kali
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Amankan Akun &amp; Lengkapi Profil
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Anda sedang menggunakan kata sandi awal sementara. Silakan lengkapi data profil dan buat kata sandi baru pribadi Anda untuk melanjutkan.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Modal Body Form */}
                <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
                    {errorMessage && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                            <AlertCircleIcon size={16} className="shrink-0 mt-0.5 text-rose-600" />
                            <span className="font-medium">{errorMessage}</span>
                        </div>
                    )}

                    {/* Section 1: Data Identitas & Profil */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <UserIcon size={14} className="text-emerald-600" />
                                1. Data Diri &amp; Kontak Resmi
                            </h3>
                            <span className="text-[10px] text-slate-400 font-medium">Wajib dipilih</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Nama Lengkap */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    Nama Lengkap Sesuai Dokumen <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Masukkan nama lengkap Anda"
                                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-all font-semibold"
                                />
                            </div>

                            {/* Jenis Kelamin (Segmented Cards) */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    Jenis Kelamin <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, gender: 'L' })}
                                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            formData.gender === 'L'
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/60 dark:border-blue-400 dark:text-blue-200 shadow-xs ring-1 ring-blue-500'
                                                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${formData.gender === 'L' ? 'border-blue-600' : 'border-slate-400'}`}>
                                            {formData.gender === 'L' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                                        </span>
                                        <span>Laki-Laki (L)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, gender: 'P' })}
                                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            formData.gender === 'P'
                                                ? 'bg-pink-50 border-pink-500 text-pink-700 dark:bg-pink-950/60 dark:border-pink-400 dark:text-pink-200 shadow-xs ring-1 ring-pink-500'
                                                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${formData.gender === 'P' ? 'border-pink-600' : 'border-slate-400'}`}>
                                            {formData.gender === 'P' && <span className="w-1.5 h-1.5 rounded-full bg-pink-600" />}
                                        </span>
                                        <span>Perempuan (P)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Nomor WhatsApp / HP */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    No. WhatsApp / HP <span className="text-slate-400 font-normal">(Opsional)</span>
                                </label>
                                <div className="relative flex items-center">
                                    <Call02Icon size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                                    <input
                                        type="tel"
                                        value={formData.phone_number}
                                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                        placeholder="081234567890"
                                        className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-slate-400 transition-all font-mono"
                                    />
                                </div>
                            </div>

                            {/* Tanggal Lahir (Opsional) */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    Tanggal Lahir <span className="text-slate-400 font-normal">(Opsional)</span>
                                </label>
                                <div className="relative flex items-center">
                                    <Calendar01Icon size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                                    <input
                                        type="date"
                                        value={formData.date_of_birth}
                                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                        className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-slate-400 transition-all font-mono"
                                    />
                                </div>
                            </div>

                            {/* Alamat Domisili (Opsional) */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    Alamat Domisili <span className="text-slate-400 font-normal">(Opsional)</span>
                                </label>
                                <div className="relative flex items-center">
                                    <Location01Icon size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Kota / Alamat domisili saat ini"
                                        className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-slate-400 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Buat Kata Sandi Baru */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <SecurityLockIcon size={14} className="text-emerald-600" />
                                2. Buat Kata Sandi Baru Pribadi
                            </h3>
                            <span className="text-[10px] text-slate-400 font-medium">Min. 8 Karakter</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Password Baru */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    Kata Sandi Baru <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        value={formData.new_password}
                                        onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                                        placeholder="Minimal 8 karakter"
                                        className="w-full h-10 pl-3.5 pr-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-slate-400 transition-all font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
                                        title={showPassword ? 'Sembunyikan' : 'Lihat'}
                                    >
                                        {showPassword ? <ViewOffIcon size={15} /> : <ViewIcon size={15} />}
                                    </button>
                                </div>

                                {/* Password Strength Bar */}
                                {formData.new_password && (
                                    <div className="space-y-1 pt-1">
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                                                style={{ width: `${passwordStrength.score}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                            Kekuatan: {passwordStrength.label}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Konfirmasi Password */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    Ulangi Kata Sandi Baru <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        value={formData.confirm_password}
                                        onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                                        placeholder="Ulangi kata sandi"
                                        className="w-full h-10 pl-3.5 pr-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-slate-400 transition-all font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded cursor-pointer"
                                        title={showConfirmPassword ? 'Sembunyikan' : 'Lihat'}
                                    >
                                        {showConfirmPassword ? <ViewOffIcon size={15} /> : <ViewIcon size={15} />}
                                    </button>
                                </div>
                                {formData.confirm_password && formData.new_password !== formData.confirm_password && (
                                    <p className="text-[10px] font-semibold text-rose-500">Kata sandi tidak cocok</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Security Notice Box */}
                    <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-200/90 leading-relaxed flex items-start gap-2.5">
                        <AlertCircleIcon size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <span>
                            <strong>Pemberitahuan Keamanan:</strong> Setelah Anda menyimpan perubahan ini, sistem akan <strong>otomatis mengeluarkan Anda dari sesi</strong> demi memastikan keamanan data. Anda akan diarahkan ke halaman login untuk masuk kembali menggunakan kata sandi baru.
                        </span>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-bold text-xs tracking-wide transition-all shadow-md active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900 rounded-full animate-spin" />
                                    <span>Mengamankan Akun...</span>
                                </>
                            ) : (
                                <>
                                    <Tick01Icon size={16} />
                                    <span>Simpan Profil &amp; Amankan Akun</span>
                                    <ArrowRight01Icon size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
