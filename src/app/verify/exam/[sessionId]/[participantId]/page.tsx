import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';
import { getParticipantAnswerSheetData } from '@/lib/answer-sheet';
import { verifyAnswerSheetDocumentId } from '@/lib/answer-sheet-verification';

export const metadata: Metadata = {
    title: 'Verifikasi Lembar Jawaban - Nusamitra Consulting',
    description: 'Portal verifikasi resmi lembar jawaban ujian LMS Nusamitra Consulting.',
    robots: { index: false, follow: false, nocache: true },
};

function maskIdentifier(value: string | null | undefined): string {
    if (!value) return '-';
    const visible = value.slice(-4);
    return `${'*'.repeat(Math.max(4, value.length - visible.length))}${visible}`;
}

interface PageProps {
    params: Promise<{ sessionId: string; participantId: string }>;
    searchParams: Promise<{ doc?: string; exam?: string }>;
}

export default async function AnswerSheetVerificationPage({ params, searchParams }: PageProps) {
    const { sessionId, participantId } = await params;
    const { doc, exam } = await searchParams;

    let data = null;
    if (doc && exam) {
        data = await getParticipantAnswerSheetData(sessionId, participantId, exam);
    }

    const isVerified = Boolean(
        data
        && doc
        && verifyAnswerSheetDocumentId(doc, data.document_id),
    );

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
            <div className="mx-auto max-w-2xl space-y-6">
                <div className="text-center">
                    <Image
                        src="/logo-nusamitra-tr.png"
                        alt="Nusamitra Consulting"
                        width={180}
                        height={52}
                        priority
                        className="mx-auto h-12 w-auto object-contain"
                    />
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Verifikasi Lembar Jawaban Ujian
                    </p>
                </div>

                {isVerified && data ? (
                    <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
                        <div className="bg-emerald-600 px-6 py-8 text-center text-white">
                            <ShieldCheck className="mx-auto size-14" />
                            <h1 className="mt-3 text-2xl font-bold">Dokumen terverifikasi</h1>
                            <p className="mt-1 text-sm text-emerald-100">Lembar jawaban cocok dengan data resmi LMS.</p>
                        </div>
                        <div className="space-y-5 p-6 sm:p-8">
                            <dl className="grid gap-4 text-sm sm:grid-cols-2">
                                <div><dt className="text-slate-500">Peserta</dt><dd className="font-semibold">{data.participant.full_name}</dd></div>
                                <div><dt className="text-slate-500">NIP</dt><dd className="font-semibold">{maskIdentifier(data.participant.nip)}</dd></div>
                                <div><dt className="text-slate-500">Sesi</dt><dd className="font-semibold">{data.session.title}</dd></div>
                                <div><dt className="text-slate-500">Ujian</dt><dd className="font-semibold">{data.exam.title}</dd></div>
                                <div><dt className="text-slate-500">Attempt</dt><dd className="font-semibold">{data.exam.attempt_number}</dd></div>
                                <div><dt className="text-slate-500">Nilai akhir</dt><dd className="font-semibold">{data.stats.final_score.toFixed(2)}</dd></div>
                            </dl>
                            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                                <CheckCircle2 className="size-4 shrink-0" />
                                <span>ID dokumen: <span className="font-mono font-semibold">{data.document_id}</span></span>
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className="rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
                        <AlertTriangle className="mx-auto size-14 text-amber-500" />
                        <h1 className="mt-4 text-xl font-bold">Dokumen tidak valid</h1>
                        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                            ID dokumen tidak cocok, parameter QR tidak lengkap, atau data lembar jawaban tidak ditemukan.
                        </p>
                    </section>
                )}

                <div className="text-center">
                    <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                        <FileCheck2 className="size-4" /> Kembali ke LMS
                    </Link>
                </div>
            </div>
        </main>
    );
}
