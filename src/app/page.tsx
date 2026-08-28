import Link from "next/link";
import Image from "next/image";
import {
    ShieldCheck,
    ArrowRight,
    Lock,
    GraduationCap,
    Users,
    FileBadge2
} from "lucide-react";

export const metadata = {
    title: "LMS Nusamitra Consulting - Platform Pelatihan & Sertifikasi Profesional",
    description: "Sistem Manajemen Pembelajaran dan Penilaian Kompetensi Terstandar Nusamitra Consulting.",
};

export default function HomePage() {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white antialiased">
            {/* Ambient Lighting Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl" />
                <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
            </div>

            {/* Navigation Bar */}
            <header className="relative z-20 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-2xl shadow-sm">
                            <Image
                                src="/logo-nusamitra-tr.png"
                                alt="Nusamitra Consulting"
                                width={160}
                                height={44}
                                priority
                                className="h-9 w-auto object-contain"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/auth/login"
                            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                        >
                            Masuk Akun
                        </Link>
                        <Link
                            href="/auth/register"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs active:scale-95"
                        >
                            <Users className="size-4" />
                            <span>Daftar Peserta Baru</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
                <div className="max-w-5xl mx-auto text-center space-y-8">
                    {/* Badge Pill */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-emerald-400 text-xs font-semibold tracking-wide">
                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Professional Assessment & Certification Portal</span>
                    </div>

                    {/* Headline */}
                    <div className="space-y-4 max-w-3xl mx-auto">
                        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                            Tingkatkan Kompetensi Bersama <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">Nusamitra</span>
                        </h1>
                        <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
                            Platform pembelajaran interaktif, evaluasi terstandar berbasis Safe Exam Browser, dan penerbitan Surat Keterangan Lulus (SKL) serta Sertifikat Resmi terverifikasi.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <Link
                            href="/auth/login"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 transition-all shadow-lg active:scale-95"
                        >
                            <span>Masuk Portal Pelatihan</span>
                            <ArrowRight className="size-4" />
                        </Link>

                        <Link
                            href="/auth/register"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white font-bold text-sm border border-white/15 transition-all shadow-xs active:scale-95"
                        >
                            <GraduationCap className="size-4 text-emerald-400" />
                            <span>Registrasi Peserta Baru</span>
                        </Link>
                    </div>

                    {/* 3 Core Value Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-12 text-left">
                        {/* Card 1 */}
                        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xs p-6 space-y-3 hover:border-white/20 transition-all">
                            <div className="size-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-xs">
                                <Lock className="size-5" />
                            </div>
                            <h2 className="text-base font-bold text-white">Safe Exam Browser & Anti-Cheat</h2>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Evaluasi dengan sistem keamanan tinggi, penguncian browser otomatis, serta monitoring proctoring foto berkala.
                            </p>
                        </div>

                        {/* Card 2 */}
                        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xs p-6 space-y-3 hover:border-white/20 transition-all">
                            <div className="size-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-xs">
                                <FileBadge2 className="size-5" />
                            </div>
                            <h2 className="text-base font-bold text-white">Penerbitan SKL & Sertifikat</h2>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Surat Keterangan Lulus (SKL) otomatis terbit setelah evaluasi kelulusan resmi dan berkas sertifikat resmi dapat diunduh langsung.
                            </p>
                        </div>

                        {/* Card 3 */}
                        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xs p-6 space-y-3 hover:border-white/20 transition-all">
                            <div className="size-11 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center shadow-xs">
                                <ShieldCheck className="size-5" />
                            </div>
                            <h2 className="text-base font-bold text-white">Verifikasi Dokumen Publik</h2>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Dilengkapi QR Code dan portal verifikasi publik untuk menjamin keaslian dan keabsahan dokumen lulusan bagi mitra instansi.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/10 bg-slate-950/60 py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                    <p>© {new Date().getFullYear()} Nusamitra Consulting. Hak Cipta Dilindungi.</p>
                    <div className="flex items-center gap-6">
                        <Link href="/auth/login" className="hover:text-white transition-colors">
                            Portal Peserta
                        </Link>
                        <Link href="/auth/login" className="hover:text-white transition-colors">
                            Portal Penguji & Admin
                        </Link>
                        <Link href="/auth/forgot-password" className="hover:text-white transition-colors">
                            Bantuan Akun
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
