import { executeQuery } from '@/lib/db';
import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck, CheckCircle2, AlertTriangle, Building, Calendar, Award, User, Hash } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Verifikasi Keaslian Dokumen SKL - Nusamitra Consulting',
    description: 'Portal resmi verifikasi keabsahan dan keaslian Surat Keterangan Lulus (SKL) Nusamitra Consulting.',
};

interface VerificationPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ no?: string }>;
}

export default async function SklVerificationPage({ params, searchParams }: VerificationPageProps) {
    const { id: enrollmentId } = await params;
    const { no: sklNumberParam } = await searchParams;

    let verificationData: any = null;
    let isError = false;

    try {
        const rows = await executeQuery<any[]>(
            `SELECT 
                sp.id AS enrollment_id,
                sp.graduation_status,
                sp.graduation_decided_at,
                sp.graduation_notes,
                sp.skl_number,
                sp.skl_generated_at,
                u.full_name,
                u.username,
                pp.nip,
                pp.institution,
                s.title AS session_title,
                s.start_time,
                s.end_time,
                m.title AS module_title
             FROM session_participants sp
             JOIN users u ON sp.user_id = u.id
             JOIN sessions s ON sp.session_id = s.id
             LEFT JOIN modules m ON s.module_id = m.id
             LEFT JOIN participant_profiles pp ON u.id = pp.user_id
             WHERE sp.id = ?
             LIMIT 1`,
            [enrollmentId]
        );

        if (rows && rows.length > 0) {
            verificationData = rows[0];
        }
    } catch (err) {
        console.error('[SKL_VERIFICATION_ERROR]', err);
        isError = true;
    }

    const isPassed = verificationData && verificationData.graduation_status === 'passed';
    const sklNumber = verificationData?.skl_number || sklNumberParam || 'SKL-REGISTERED';
    const decidedDate = verificationData?.graduation_decided_at
        ? new Date(verificationData.graduation_decided_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Terdaftar Resmi';

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans text-slate-800 antialiased p-4 sm:p-6 md:p-10">
            <div className="max-w-2xl w-full mx-auto my-auto space-y-6">
                {/* Header Brand */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center p-2 bg-white rounded-2xl shadow-sm border border-slate-200">
                        <Image
                            src="/logo-nusamitra-tr.png"
                            alt="Nusamitra Consulting"
                            width={160}
                            height={46}
                            priority
                            className="h-10 w-auto object-contain"
                        />
                    </div>
                    <h1 className="text-xs font-bold text-slate-500 uppercase tracking-widest pt-2">
                        Portal Verifikasi Dokumen Resmi
                    </h1>
                </div>

                {isPassed ? (
                    /* VERIFIED CARD */
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        {/* Banner Status */}
                        <div className="bg-emerald-600 p-6 sm:p-8 text-white text-center space-y-3 relative overflow-hidden">
                            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mx-auto shadow-inner">
                                <ShieldCheck className="w-9 h-9 text-white" />
                            </div>
                            <div className="space-y-1">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white font-bold text-xs tracking-wider uppercase backdrop-blur-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Terverifikasi Sah & Asli
                                </span>
                                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight pt-1">
                                    Surat Keterangan Lulus (SKL)
                                </h2>
                                <p className="text-emerald-100 text-xs font-mono">
                                    Nomor: {sklNumber}
                                </p>
                            </div>
                        </div>

                        {/* Details Table */}
                        <div className="p-6 sm:p-8 space-y-5">
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 divide-y divide-slate-200/70 text-xs space-y-3">
                                {/* Nama Peserta */}
                                <div className="flex items-start justify-between gap-4 pb-3">
                                    <div className="flex items-center gap-2 text-slate-500 font-medium shrink-0">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <span>Nama Lengkap:</span>
                                    </div>
                                    <span className="font-bold text-slate-900 text-right uppercase text-sm">
                                        {verificationData.full_name || verificationData.username}
                                    </span>
                                </div>

                                {/* NIP */}
                                {verificationData.nip && (
                                    <div className="flex items-center justify-between gap-4 py-3">
                                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                                            <Hash className="w-4 h-4 text-slate-400" />
                                            <span>Nomor Induk Pegawai (NIP):</span>
                                        </div>
                                        <span className="font-mono font-bold text-slate-900 bg-slate-200/70 px-2 py-0.5 rounded text-xs">
                                            {verificationData.nip}
                                        </span>
                                    </div>
                                )}

                                {/* Instansi */}
                                <div className="flex items-start justify-between gap-4 py-3">
                                    <div className="flex items-center gap-2 text-slate-500 font-medium shrink-0">
                                        <Building className="w-4 h-4 text-slate-400" />
                                        <span>Instansi / Unit Kerja:</span>
                                    </div>
                                    <span className="font-semibold text-slate-800 text-right">
                                        {verificationData.institution || '-'}
                                    </span>
                                </div>

                                {/* Program Pelatihan */}
                                <div className="flex items-start justify-between gap-4 py-3">
                                    <div className="flex items-center gap-2 text-slate-500 font-medium shrink-0">
                                        <Award className="w-4 h-4 text-slate-400" />
                                        <span>Program Pelatihan:</span>
                                    </div>
                                    <span className="font-semibold text-slate-800 text-right">
                                        {verificationData.session_title}
                                    </span>
                                </div>

                                {/* Tanggal Terbit */}
                                <div className="flex items-center justify-between gap-4 pt-3">
                                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <span>Tanggal Keputusan:</span>
                                    </div>
                                    <span className="font-bold text-emerald-800">
                                        {decidedDate}
                                    </span>
                                </div>
                            </div>

                            {/* Verification Footer Notice */}
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-center text-xs text-emerald-800 space-y-1">
                                <p className="font-bold">Dokumen ini Sah dan Terdaftar Resmi</p>
                                <p className="text-[11px] text-emerald-700 leading-relaxed">
                                    Sistem pangkalan data Nusamitra Consulting memastikan bahwa dokumen Surat Keterangan Lulus (SKL) di atas adalah asli dan diterbitkan secara sah oleh Direktorat Pelatihan & Sertifikasi.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* NOT FOUND / UNVERIFIED CARD */
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-8 text-center space-y-5">
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-slate-900">
                                Dokumen Tidak Ditemukan atau Belum Dinyatakan Lulus
                            </h2>
                            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                                Data pendaftaran dengan ID verifikasi <code>{enrollmentId}</code> tidak ditemukan dalam basis data atau status kelulusan peserta belum disahkan oleh pihak berwenang.
                            </p>
                        </div>
                        <div className="pt-2">
                            <Link
                                href="/"
                                className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-all"
                            >
                                Kembali ke Beranda
                            </Link>
                        </div>
                    </div>
                )}

                {/* Footer Copy */}
                <div className="text-center text-xs text-slate-400">
                    <p>© {new Date().getFullYear()} Nusamitra Consulting. Sistem Verifikasi Dokumen Elektronik Terdaftar.</p>
                </div>
            </div>
        </div>
    );
}
