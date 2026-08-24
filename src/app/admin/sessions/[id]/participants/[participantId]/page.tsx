'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    UserCircleIcon,
    Tick01Icon,
    Book01Icon,
    Edit01Icon,
    AlertCircleIcon,
    Clock01Icon
} from 'hugeicons-react';
import { GraduationVerdictModal } from '@/components/admin/GraduationVerdictModal';
import { CertificateUploadModal } from '@/components/admin/CertificateUploadModal';
import { Award, FileBadge2, Printer, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';

type DetailData = {
    session: { id: string; title: string };
    participant: {
        id: string;
        username: string;
        full_name: string;
        nip?: string | null;
        institution?: string | null;
        batch?: number | null;
        graduation_status?: 'pending' | 'passed' | 'failed';
        graduation_decided_at?: string | null;
        graduation_notes?: string | null;
        skl_number?: string | null;
        certificate_file_url?: string | null;
        certificate_number?: string | null;
    };
    progress: {
        total_items: number;
        completed_items: number;
        percentage: number;
        items: Array<{
            module_item_id: string;
            item_type: 'training' | 'exam';
            item_id: string;
            item_title: string;
            sequence_order: number;
            status: 'locked' | 'open' | 'completed';
            score: number | null;
            updated_at: string | null;
        }>;
    };
};

export default function ParticipantSessionDetailAdminPage({ params }: { params: Promise<{ id: string; participantId: string }> }) {
    const { id: sessionId, participantId } = use(params);
    const [data, setData] = useState<DetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showVerdictModal, setShowVerdictModal] = useState(false);
    const [showCertModal, setShowCertModal] = useState(false);

    // Modal state for Admin Exam Override
    const [overrideTarget, setOverrideTarget] = useState<{ examId: string; title: string; status: string } | null>(null);
    const [overrideAction, setOverrideAction] = useState<'resume' | 'reset'>('resume');
    const [extraMinutes, setExtraMinutes] = useState<number>(15);
    const [reason, setReason] = useState<string>('');
    const [submittingOverride, setSubmittingOverride] = useState<boolean>(false);
    const [overrideMessage, setOverrideMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadData = () => {
        setLoading(true);
        fetch(`/api/sessions/${sessionId}/participants/${participantId}`)
            .then((res) => res.json())
            .then((result) => {
                if (result.success) setData(result.data);
                else setError(result.error || 'Gagal memuat detail peserta');
            })
            .catch(() => setError('Kesalahan jaringan'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadData();
    }, [sessionId, participantId]);

    const handleExecuteOverride = async () => {
        if (!overrideTarget) return;
        setSubmittingOverride(true);
        setOverrideMessage(null);

        try {
            const res = await fetch(`/api/admin/sessions/${sessionId}/participants/${participantId}/override`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exam_id: overrideTarget.examId,
                    action: overrideAction,
                    extra_minutes: Number(extraMinutes) || 0,
                    reason: reason.trim() || 'Admin Override Akses Ujian',
                }),
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Gagal memperbarui akses ujian');
            }

            setOverrideMessage({ type: 'success', text: result.message || 'Akses ujian berhasil diperbarui' });
            setTimeout(() => {
                setOverrideTarget(null);
                setOverrideMessage(null);
                loadData();
            }, 1200);
        } catch (err) {
            setOverrideMessage({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
        } finally {
            setSubmittingOverride(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-pulse">
                <div className="h-4 w-32 bg-slate-100 rounded" />
                <div className="h-20 w-full bg-slate-100 rounded-xl" />
                <div className="h-48 w-full bg-slate-100 rounded-xl" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="max-w-7xl mx-auto space-y-4 pt-4">
                <Link
                    href={`/admin/sessions/${sessionId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                    <ArrowLeft01Icon size={15} /> Kembali ke Detail Sesi
                </Link>
                <div className="bg-white rounded-xl border border-black/5 p-6 text-center shadow-2xs">
                    <AlertCircleIcon size={32} className="mx-auto text-red-500 mb-2" />
                    <p className="text-xs font-semibold text-red-600">{error || 'Detail peserta tidak ditemukan'}</p>
                </div>
            </div>
        );
    }

    const { session, participant, progress } = data;
    const isCompleted = progress.percentage === 100;

    return (
        <div className="space-y-4 max-w-7xl mx-auto pb-12">
            {/* Navigation & Header */}
            <div className="space-y-3">
                <Link
                    href={`/admin/sessions/${sessionId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                    <ArrowLeft01Icon size={15} />
                    <span>Kembali ke Detail Sesi</span>
                </Link>

                {/* Integrated Banner & Profile Bar */}
                <div className="bg-white rounded-xl border border-black/5 p-4 sm:p-5 shadow-2xs">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Left: User Profile & Session Context */}
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-100 text-slate-700 border border-black/5 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                                <UserCircleIcon size={26} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight break-words">
                                        {participant.full_name}
                                    </h1>
                                    <span className="text-xs text-muted-foreground font-mono break-all">({participant.username})</span>
                                    {isCompleted ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            Selesai 100%
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            Sedang Berlangsung
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground break-words">
                                    Sesi: <span className="font-medium text-foreground">{session.title}</span>
                                </p>
                            </div>
                        </div>

                        {/* Right: Compact Metrics & Progress */}
                        <div className="shrink-0 bg-slate-50 md:bg-transparent rounded-xl p-3 md:p-0 border border-black/5 md:border-0">
                            <div className="flex md:flex-col items-center md:items-end justify-between gap-1.5">
                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                    Penyelesaian
                                </span>
                                <span className="text-xs font-semibold text-foreground font-mono">
                                    {progress.completed_items} / {progress.total_items} Modul ({progress.percentage}%)
                                </span>
                            </div>
                            <div className="w-full md:w-36 h-1.5 bg-slate-200/80 rounded-full overflow-hidden mt-2 md:mt-1.5">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        isCompleted ? 'bg-emerald-500' : 'bg-primary'
                                    }`}
                                    style={{ width: `${progress.percentage}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Graduation Verdict & Certificate Management Card */}
                <div className="bg-white rounded-xl border border-black/5 p-4 sm:p-5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                participant.graduation_status === 'passed'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : participant.graduation_status === 'failed'
                                    ? 'bg-red-50 text-red-700 border border-red-200/60'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            }`}>
                                <Award className="size-5" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Status Kelulusan:
                                    </span>
                                    {participant.graduation_status === 'passed' ? (
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                            <CheckCircle2 size={12} className="text-emerald-600" /> LULUS
                                        </span>
                                    ) : participant.graduation_status === 'failed' ? (
                                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200/80 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                            <AlertCircle size={12} className="text-red-600" /> TIDAK LULUS
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/80 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                            <Sparkles size={12} className="text-amber-600" /> Menunggu Keputusan
                                        </span>
                                    )}

                                    {participant.skl_number && (
                                        <span className="font-mono text-[11px] text-muted-foreground">
                                            • No. SKL: <strong className="text-foreground">{participant.skl_number}</strong>
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {participant.graduation_notes || 'Belum ada catatan evaluasi khusus untuk peserta ini.'}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons for Graduation & Certificate */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {participant.graduation_status === 'passed' && (
                                <>
                                    <a
                                        href={`/api/participant/sessions/${sessionId}/skl?userId=${participantId}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors border border-black/5"
                                    >
                                        <Printer className="size-3.5 text-slate-600" />
                                        <span>Cetak SKL</span>
                                    </a>

                                    <button
                                        type="button"
                                        onClick={() => setShowCertModal(true)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                            participant.certificate_file_url
                                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                        }`}
                                    >
                                        <FileBadge2 className="size-3.5" />
                                        <span>{participant.certificate_file_url ? 'Kelola Sertifikat' : '+ Upload Sertifikat'}</span>
                                    </button>
                                </>
                            )}

                            <button
                                type="button"
                                onClick={() => setShowVerdictModal(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-2xs"
                            >
                                <Award className="size-3.5" />
                                <span>Tetapkan Kelulusan</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Daftar Materi & Ujian Card (Full-Width & Responsive) */}
            <div className="bg-white rounded-xl border border-black/5 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Daftar Materi & Ujian
                    </h2>
                    <span className="text-xs font-medium text-muted-foreground">
                        {progress.total_items} Modul Total
                    </span>
                </div>

                <div className="divide-y divide-black/5">
                    {progress.items.map((item, idx) => {
                        const done = item.status === 'completed';
                        const isExam = item.item_type === 'exam';

                        return (
                            <div
                                key={item.module_item_id}
                                className="p-3.5 sm:p-4 hover:bg-slate-50/50 transition-colors"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    {/* Left: Number / Check Badge + Info */}
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div
                                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold mt-0.5 sm:mt-0 ${
                                                done
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                                                    : 'bg-slate-100 text-slate-500 border border-black/5'
                                            }`}
                                        >
                                            {done ? <Tick01Icon size={16} /> : idx + 1}
                                        </div>

                                        {/* Title & Meta Info */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span
                                                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded ${
                                                        isExam
                                                            ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                                                            : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                                    }`}
                                                >
                                                    {isExam ? <Edit01Icon size={11} /> : <Book01Icon size={11} />}
                                                    {isExam ? 'Ujian' : 'Materi'}
                                                </span>
                                                {item.updated_at && (
                                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-normal">
                                                        <Clock01Icon size={11} /> {new Date(item.updated_at).toLocaleString('id-ID')}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-sm font-medium text-foreground break-words leading-snug">
                                                {item.item_title || 'Untitled'}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Right / Bottom: Score & Actions */}
                                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2.5 sm:pt-0 border-t border-black/5 sm:border-t-0 pl-10 sm:pl-0 flex-wrap">
                                        {isExam && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOverrideTarget({
                                                        examId: item.item_id,
                                                        title: item.item_title,
                                                        status: item.status,
                                                    });
                                                    setOverrideAction('resume');
                                                    setExtraMinutes(15);
                                                    setReason('');
                                                    setOverrideMessage(null);
                                                }}
                                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-black/5 active:scale-98"
                                            >
                                                <Edit01Icon size={12} />
                                                <span>Kelola Akses Ujian</span>
                                            </button>
                                        )}

                                        {isExam && done ? (
                                            <div className="flex items-center gap-2.5 ml-auto sm:ml-0">
                                                <Link
                                                    href={`/admin/sessions/${sessionId}/participants/${participantId}/answers?exam=${item.item_id}`}
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-1 py-0.5"
                                                >
                                                    Lihat Jawaban
                                                </Link>
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-black/5">
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                                        Skor
                                                    </span>
                                                    <span className="text-xs font-semibold font-mono">
                                                        {item.score !== null ? item.score : 0}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : !done ? (
                                            <span className="inline-flex items-center text-xs font-medium text-muted-foreground ml-auto sm:ml-0">
                                                Belum
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 ml-auto sm:ml-0">
                                                Diselesaikan
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal Override Akses Ujian Peserta */}
            {overrideTarget && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-black/10 shadow-2xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-black/5 pb-3">
                            <h3 className="text-base font-semibold text-foreground">
                                Kelola Akses Ujian Peserta
                            </h3>
                            <button
                                type="button"
                                onClick={() => setOverrideTarget(null)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Ujian:</p>
                            <p className="text-sm font-semibold text-foreground">{overrideTarget.title}</p>
                            <p className="text-xs text-muted-foreground">
                                Status Peserta Saat Ini:{' '}
                                <span className="font-semibold text-foreground capitalize">{overrideTarget.status}</span>
                            </p>
                        </div>

                        {overrideMessage && (
                            <div
                                className={`p-3 rounded-xl text-xs font-medium ${
                                    overrideMessage.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                            >
                                {overrideMessage.text}
                            </div>
                        )}

                        <div className="space-y-3 pt-1">
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">
                                    Pilih Aksi Override:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <label
                                        className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${
                                            overrideAction === 'resume'
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <input
                                                type="radio"
                                                name="overrideAction"
                                                value="resume"
                                                checked={overrideAction === 'resume'}
                                                onChange={() => setOverrideAction('resume')}
                                                className="accent-primary"
                                            />
                                            <span className="text-xs font-semibold">Lanjutkan Ujian</span>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground leading-snug">
                                            Simpan jawaban draft lama, buka akses pengerjaan.
                                        </span>
                                    </label>

                                    <label
                                        className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${
                                            overrideAction === 'reset'
                                                ? 'border-red-500 bg-red-50 text-red-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <input
                                                type="radio"
                                                name="overrideAction"
                                                value="reset"
                                                checked={overrideAction === 'reset'}
                                                onChange={() => setOverrideAction('reset')}
                                                className="accent-red-500"
                                            />
                                            <span className="text-xs font-semibold">Ulang dari Awal</span>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground leading-snug">
                                            Hapus draft & nilai lama, mulai bersih dari nol.
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                    {overrideAction === 'resume' ? 'Tambahan Waktu (Menit):' : 'Batas Durasi Ujian (Menit):'}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="180"
                                    value={extraMinutes}
                                    onChange={(e) => setExtraMinutes(Number(e.target.value))}
                                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Contoh: 15"
                                />
                                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                                    {overrideAction === 'resume'
                                        ? 'Tambahan menit akan ditambahkan ke batas waktu sesi peserta.'
                                        : '0 = Mengikuti durasi standar ujian.'}
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                    Alasan Override (Untuk Audit Log):
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={2}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Contoh: Kendala Wi-Fi padam saat pengerjaan"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
                            <button
                                type="button"
                                onClick={() => setOverrideTarget(null)}
                                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                                disabled={submittingOverride}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteOverride}
                                disabled={submittingOverride}
                                className={`px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors shadow-2xs ${
                                    overrideAction === 'reset'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-primary hover:bg-primary/90'
                                }`}
                            >
                                {submittingOverride ? 'Memproses...' : 'Konfirmasi & Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Individual Graduation Verdict Modal */}
            <GraduationVerdictModal
                isOpen={showVerdictModal}
                onClose={() => setShowVerdictModal(false)}
                onSuccess={loadData}
                sessionId={sessionId}
                participant={participant}
            />

            {/* Official Certificate Upload Modal */}
            <CertificateUploadModal
                isOpen={showCertModal}
                onClose={() => setShowCertModal(false)}
                onSuccess={loadData}
                sessionId={sessionId}
                participant={participant}
            />
        </div>
    );
}
