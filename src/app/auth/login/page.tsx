'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
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
                setError(result.error || 'Username atau password yang Anda masukkan tidak valid.');
            }
        } catch {
            setError('Terjadi kendala koneksi ke server. Silakan coba lagi.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background font-sans antialiased selection:bg-primary/20 selection:text-primary">
            {/* ── Left Hero Panel (60% Desktop) - Pure Visual & Atmosphere ── */}
            <div className="hidden lg:flex lg:w-[58%] xl:w-[60%] relative overflow-hidden bg-slate-950 select-none">
                {/* Background Hero Image */}
                <Image
                    src="/images/auth-hero.jpg"
                    alt="Sesi Pelatihan dan Sertifikasi Profesional Nusamitra"
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    priority
                    className="object-cover object-center transform scale-105 transition-transform duration-1000 ease-out"
                />

                {/* Ambient Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-950/60" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-950/40" />

                {/* Subtle Clean Watermark / Tagline at Bottom */}
                <div className="absolute bottom-8 left-8 right-8 z-10">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/90 text-xs font-medium tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        LMS Nusamitra Consulting • Professional Assessment Portal
                    </div>
                </div>
            </div>

            {/* ── Right Login Panel (40% Desktop) - High UX & Clean Form ── */}
            <div className="w-full lg:w-[42%] xl:w-[40%] flex flex-col justify-between min-h-screen bg-white p-6 sm:p-10 md:p-14 lg:p-10 xl:p-14">
                {/* Top Section / Header */}
                <div className="w-full max-w-md mx-auto my-auto py-8">
                    {/* Brand Logo (Clean, no card border/shadow) */}
                    <div className="mb-8">
                        <Image
                            src="/logo-nusamitra-tr.png"
                            alt="Nusamitra Consulting"
                            width={180}
                            height={52}
                            priority
                            className="h-12 w-auto object-contain"
                        />
                    </div>

                    {/* Page Title & Instructions */}
                    <div className="space-y-2 mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            Masuk ke Akun
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Silakan masukkan kredensial akun Anda untuk melanjutkan ke portal pelatihan dan ujian.
                        </p>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div
                            role="alert"
                            className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
                        >
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username Input */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-foreground/80 tracking-wider uppercase">
                                Username / Email / NIP
                            </label>
                            <div className="relative flex items-center">
                                <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                    <User className="w-4 h-4" />
                                </span>
                                <input
                                    type="text"
                                    required
                                    autoComplete="username"
                                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/70 focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                    placeholder="Masukkan username, email, atau NIP"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Password Input with Show/Hide Toggle */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-semibold text-foreground/80 tracking-wider uppercase">
                                    Password
                                </label>
                                <Link
                                    href="/auth/forgot-password"
                                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors"
                                >
                                    Lupa Password?
                                </Link>
                            </div>
                            <div className="relative flex items-center">
                                <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
                                    <Lock className="w-4 h-4" />
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    className="w-full h-12 pl-10 pr-11 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-foreground placeholder:text-muted-foreground/70 focus:bg-white focus:outline-none focus:border-foreground focus:ring-4 focus:ring-foreground/5 transition-all"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                    className="absolute right-3 text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors focus:outline-none"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 mt-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-foreground/10"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Memverifikasi Akun...</span>
                                </>
                            ) : (
                                <>
                                    <span>Masuk ke Dashboard</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>

                        {/* Register CTA Link */}
                        <div className="text-center pt-2">
                            <p className="text-sm text-muted-foreground">
                                Belum memiliki akun peserta?{' '}
                                <Link
                                    href="/auth/register"
                                    className="font-semibold text-foreground hover:underline transition-colors"
                                >
                                    Daftar di sini
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>


                {/* Footer Info */}
                <div className="w-full max-w-md mx-auto pt-6 text-center lg:text-left border-t border-slate-100">
                    <p className="text-xs text-muted-foreground">
                        © {new Date().getFullYear()} Nusamitra Consulting. Hak Cipta Dilindungi.
                    </p>
                </div>
            </div>
        </div>
    );
}
