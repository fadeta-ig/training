'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });

            const data = await res.json();
            if (data.success) {
                setMessage(data.message);
                setUsername('');
            } else {
                setError(data.error || 'Terjadi kesalahan. Coba lagi.');
            }
        } catch (err) {
            setError('Gagal terhubung ke server.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Lupa Password?</h1>
                    <p className="text-sm text-slate-500 mt-2">
                        Masukkan email akun Anda terkait untuk mereset password.
                    </p>
                </div>

                {message && (
                    <div className="mb-6 p-4 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
                        {message}
                    </div>
                )}
                
                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                            Username / Email
                        </label>
                        <input
                            id="username"
                            type="email"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                            placeholder="nama@email.com"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !username}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            'Kirim Link Reset'
                        )}
                    </button>
                    
                    <div className="text-center mt-6">
                        <Link href="/auth/login" className="text-sm text-emerald-600 font-medium hover:text-emerald-700">
                            Kembali ke Halaman Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
