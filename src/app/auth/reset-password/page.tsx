'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setError('Token reset password tidak ditemukan di URL. Pastikan Anda membuka link dari email terbaru.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (newPassword !== confirmPassword) {
            return setError('Password baru dan konfirmasi tidak cocok.');
        }
        if (newPassword.length < 6) {
            return setError('Password minimal terdiri dari 6 karakter.');
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setMessage(data.message);
                setTimeout(() => {
                    router.push('/auth/login');
                }, 3000);
            } else {
                setError(data.error || 'Terjadi kesalahan. Token mungkin sudah kedaluwarsa.');
            }
        } catch (err) {
            setError('Gagal terhubung ke server.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Buat Password Baru</h1>
                <p className="text-sm text-slate-500 mt-2">
                    Silakan masukkan password baru Anda yang kuat dan mudah diingat.
                </p>
            </div>

            {message && (
                <div className="mb-6 p-4 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
                    {message}
                    <div className="mt-2 text-xs opacity-75">Mengarahkan ke halaman login...</div>
                </div>
            )}
            
            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                    {error}
                </div>
            )}

            {!message && (
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Password Baru
                        </label>
                        <input
                            type="password"
                            required
                            disabled={!token}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                            placeholder="Minimal 6 karakter"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Konfirmasi Password Baru
                        </label>
                        <input
                            type="password"
                            required
                            disabled={!token}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                            placeholder="Ketik ulang password baru"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !token || !newPassword || !confirmPassword}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            'Simpan Password Baru'
                        )}
                    </button>
                    
                    <div className="text-center mt-6">
                        <Link href="/auth/login" className="text-sm text-slate-500 font-medium hover:text-emerald-700 transition">
                            Batal dan kembali ke Login
                        </Link>
                    </div>
                </form>
            )}
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
            <Suspense fallback={<div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />}>
                <ResetPasswordForm />
            </Suspense>
        </div>
    );
}
