'use client';

import Link from 'next/link';

export default function UnauthorizedPage() {
    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div className="glass-card p-10 max-w-md text-center space-y-6 page-transition">
                {/* Icon */}
                <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                    <svg
                        className="w-10 h-10 text-destructive"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-foreground">Akses Ditolak</h1>
                <p className="text-muted-foreground leading-relaxed">
                    Halaman ujian hanya dapat diakses melalui{' '}
                    <strong className="text-foreground">Safe Exam Browser (SEB)</strong>.
                    Pastikan Anda membuka ujian menggunakan SEB yang telah dikonfigurasi.
                </p>

                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                >
                    ← Kembali ke Dashboard
                </Link>
            </div>
        </main>
    );
}
