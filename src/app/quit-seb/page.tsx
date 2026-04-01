'use client';

import { useEffect } from 'react';
import { Logout01Icon, Home01Icon } from 'hugeicons-react';
import Link from 'next/link';

export default function QuitSebPage() {
    useEffect(() => {
        // If SEB JS API is available, try to terminate
        if (typeof window !== 'undefined' && (window as any).SafeExamBrowser) {
            (window as any).SafeExamBrowser.terminateBrowser();
        }
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md w-full glass-card p-10 text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
                    <Logout01Icon size={40} />
                </div>
                
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-slate-800">Menutup Aplikasi SEB...</h1>
                    <p className="text-slate-600">
                        Jika aplikasi Safe Exam Browser tidak menutup secara otomatis, silakan tekan tombol 
                        <span className="font-bold"> Ctrl+Q</span> atau klik tombol keluar di bawah.
                    </p>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                    <button 
                        onClick={() => typeof window !== 'undefined' && window.close()}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 transition-all active:scale-95"
                    >
                        Tutup Browser Sekarang
                    </button>
                    
                    <Link 
                        href="/dashboard"
                        className="w-full py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                    >
                        <Home01Icon size={18} />
                        Kembali ke Dashboard
                    </Link>
                </div>

                <p className="text-xs text-slate-400">
                    LMS Antigravity - Safe Exam Browser Integration
                </p>
            </div>
        </div>
    );
}
