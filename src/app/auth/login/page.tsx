'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Login02Icon, Key01Icon, UserIcon, Alert02Icon } from 'hugeicons-react';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (res.ok && result.success) {
                // Redirect based on role
                if (result.user.role === 'admin' || result.user.role === 'trainer') {
                    router.replace('/admin');
                } else {
                    router.replace('/dashboard');
                }
                router.refresh();
            } else {
                setError(result.error || 'Login gagal');
            }
        } catch (err: any) {
            setError('Terjadi kesalahan koneksi');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 p-12 -z-10 opacity-30 select-none pointer-events-none">
                <div className="w-[500px] h-[500px] bg-gradient-to-br from-black/5 to-transparent rounded-full blur-3xl absolute -top-40 -right-40" />
            </div>

            <div className="w-full max-w-md p-8">
                <div className="mb-8 text-center">
                    <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-black/10">
                        <Key01Icon size={32} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Sistem E-Learning</h1>
                    <p className="text-muted-foreground mt-2">Masuk untuk melanjutkan ke akun Anda</p>
                </div>

                <div className="glass-card p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)]">
                    {error && (
                        <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium">
                            <Alert02Icon size={18} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground">Username</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    <UserIcon size={18} />
                                </span>
                                <input
                                    type="text"
                                    required
                                    className="w-full glass-input pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none"
                                    placeholder="Masukkan username"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-foreground">Password</label>
                                <Link href="/auth/forgot-password" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors">
                                    Lupa Password?
                                </Link>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    <Key01Icon size={18} />
                                </span>
                                <input
                                    type="password"
                                    required
                                    className="w-full glass-input pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 bg-foreground text-background font-semibold px-6 py-3.5 rounded-xl hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10 focus:ring-2 focus:ring-ring focus:outline-none active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Login02Icon size={20} />
                                    Masuk ke Dashboard
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
