import Link from 'next/link';
import { Search01Icon, ArrowLeft01Icon } from 'hugeicons-react';

/**
 * Global 404 Not Found page with premium glassmorphism design.
 */
export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="glass-card max-w-md w-full p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-black/5 text-muted-foreground flex items-center justify-center mx-auto">
                    <Search01Icon size={32} />
                </div>

                <div className="space-y-2">
                    <h1 className="text-6xl font-extrabold tracking-tighter text-foreground/10">
                        404
                    </h1>
                    <h2 className="text-xl font-bold tracking-tight text-foreground -mt-3">
                        Halaman Tidak Ditemukan
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Halaman yang Anda cari tidak ada atau telah dipindahkan.
                    </p>
                </div>

                <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-xl text-sm font-bold hover:bg-foreground/90 transition-colors active:scale-95"
                >
                    <ArrowLeft01Icon size={16} />
                    Kembali ke Beranda
                </Link>
            </div>
        </div>
    );
}
