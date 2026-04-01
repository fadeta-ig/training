'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircleIcon, ArrowLeft01Icon, RefreshIcon } from 'hugeicons-react';

/**
 * Global Error Boundary — catches unhandled runtime errors
 * and displays a premium glassmorphism-styled fallback UI.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[GLOBAL_ERROR]', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="glass-card max-w-md w-full p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                    <AlertCircleIcon size={32} />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Terjadi Kesalahan
                    </h1>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Maaf, terjadi kesalahan yang tidak terduga. Tim kami telah diberitahu
                        dan sedang menangani masalah ini.
                    </p>
                </div>

                {error.digest && (
                    <p className="text-[10px] text-muted-foreground/50 font-mono bg-black/5 px-3 py-1.5 rounded-lg inline-block">
                        Error ID: {error.digest}
                    </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <button
                        onClick={reset}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-xl text-sm font-bold hover:bg-foreground/90 transition-colors active:scale-95"
                    >
                        <RefreshIcon size={16} />
                        Coba Lagi
                    </button>
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-black/5 text-foreground rounded-xl text-sm font-bold hover:bg-black/10 transition-colors active:scale-95"
                    >
                        <ArrowLeft01Icon size={16} />
                        Ke Beranda
                    </Link>
                </div>
            </div>
        </div>
    );
}
