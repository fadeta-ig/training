'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    FileText,
    Info,
    LoaderCircle,
    RotateCcw,
    ShieldCheck,
    UploadCloud,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useConfirm } from '@/hooks/useConfirm';
import { toast } from 'sonner';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const TYPE_LABELS: Record<string, string> = {
    multiple_choice: 'Pilihan Ganda',
    multiple_select: 'Multi-Jawaban',
    true_false: 'Benar / Salah',
    short_answer: 'Isian Singkat',
    essay: 'Esai',
    matching: 'Menjodohkan',
};

interface ImportIssue {
    severity: 'error' | 'warning';
    code: string;
    message: string;
    suggestion?: string;
    sheet?: string;
    row?: number;
    column?: string;
    questionCode?: string;
}

interface PreviewRow {
    sourceCode: string;
    sequence: number;
    type: string;
    typeLabel: string;
    questionText: string;
    points: number;
    answerSummary: string;
    sourceRow: number;
}

interface ImportSummary {
    totalQuestions: number;
    totalPoints: number;
    byType: Record<string, number>;
    errorCount: number;
    warningCount: number;
}

interface PreviewData {
    batchId?: string;
    originalFilename?: string;
    templateVersion?: string;
    summary: ImportSummary;
    previewRows: PreviewRow[];
    issues: ImportIssue[];
    historicalAnswerCount?: number;
    requiresHistoricalAcknowledgement?: boolean;
    expiresInMinutes?: number;
}

interface CommitResult {
    batchId: string;
    importedCount: number;
    totalPoints: number;
    firstSequenceOrder: number | null;
    lastSequenceOrder: number | null;
}

interface ApiEnvelope<T = unknown> {
    success: boolean;
    valid?: boolean;
    error?: string;
    message?: string;
    data?: T;
}

async function readApiResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
    try {
        return await response.json() as ApiEnvelope<T>;
    } catch {
        return { success: false, error: `Respons server tidak valid (HTTP ${response.status})` };
    }
}

export default function QuestionImportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: examId } = use(params);
    const inputRef = useRef<HTMLInputElement>(null);
    const { confirm, ConfirmComponent } = useConfirm();

    const [examTitle, setExamTitle] = useState('Ujian');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [result, setResult] = useState<CommitResult | null>(null);
    const [historicalAcknowledged, setHistoricalAcknowledged] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [isRollingBack, setIsRollingBack] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/exams/${examId}`)
            .then((response) => response.json())
            .then((payload) => {
                if (!cancelled && payload.success && payload.data?.title) setExamTitle(payload.data.title);
            })
            .catch(() => {
                if (!cancelled) setPageError('Detail ujian tidak dapat dimuat. File tetap dapat divalidasi.');
            });
        return () => { cancelled = true; };
    }, [examId]);

    const resetFlow = useCallback(() => {
        setSelectedFile(null);
        setPreview(null);
        setResult(null);
        setHistoricalAcknowledged(false);
        setPageError(null);
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    const selectFile = useCallback((file: File | undefined) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            toast.error('Gunakan file .xlsx dari template resmi LMS');
            return;
        }
        if (file.size < 1 || file.size > MAX_FILE_BYTES) {
            toast.error('Ukuran file harus lebih dari 0 byte dan maksimal 5 MB');
            return;
        }
        setSelectedFile(file);
        setPreview(null);
        setResult(null);
        setHistoricalAcknowledged(false);
        setPageError(null);
    }, []);

    const handlePreview = async () => {
        if (!selectedFile || isPreviewing) return;
        setIsPreviewing(true);
        setPageError(null);
        try {
            const formData = new FormData();
            formData.set('file', selectedFile);
            const response = await fetch(`/api/admin/exams/${examId}/questions/import/preview`, {
                method: 'POST',
                body: formData,
            });
            const payload = await readApiResponse<PreviewData>(response);
            if (payload.data) setPreview(payload.data);
            if (!response.ok || !payload.success) {
                setPageError(payload.error || 'File gagal divalidasi');
                if (response.status !== 422) setPreview(null);
                return;
            }
            toast.success('File valid dan siap diimport');
        } catch (error) {
            setPageError(error instanceof Error ? error.message : 'Koneksi ke server gagal');
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleCommit = async () => {
        if (!preview?.batchId || isCommitting) return;
        if (preview.requiresHistoricalAcknowledgement && !historicalAcknowledged) {
            toast.error('Konfirmasi penggunaan historis wajib dicentang');
            return;
        }
        const approved = await confirm({
            title: 'Import Soal ke Bank Soal?',
            message: `Sistem akan menambahkan ${preview.summary.totalQuestions} soal (${preview.summary.totalPoints} poin) ke akhir bank soal. Seluruh soal masuk bersama-sama atau tidak sama sekali.`,
            confirmLabel: 'Ya, Import Soal',
            cancelLabel: 'Periksa Lagi',
        });
        if (!approved) return;

        setIsCommitting(true);
        setPageError(null);
        try {
            const response = await fetch(`/api/admin/exams/${examId}/questions/import/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batchId: preview.batchId,
                    acknowledgeHistoricalUsage: historicalAcknowledged,
                }),
            });
            const payload = await readApiResponse<CommitResult>(response);
            if (!response.ok || !payload.success || !payload.data) {
                throw new Error(payload.error || 'Import gagal dijalankan');
            }
            setResult(payload.data);
            toast.success(payload.message || 'Semua soal berhasil diimport');
        } catch (error) {
            setPageError(error instanceof Error ? error.message : 'Import gagal dijalankan');
        } finally {
            setIsCommitting(false);
        }
    };

    const handleRollback = async () => {
        if (!result?.batchId || isRollingBack) return;
        const approved = await confirm({
            title: 'Batalkan Hasil Import?',
            message: 'Semua soal dari batch ini akan dihapus dan urutan soal yang tersisa dinormalkan. Rollback ditolak bila jawaban peserta sudah merujuk ke soal hasil import.',
            isDestructive: true,
            confirmLabel: 'Ya, Rollback',
            cancelLabel: 'Jangan Hapus',
        });
        if (!approved) return;

        setIsRollingBack(true);
        setPageError(null);
        try {
            const response = await fetch(`/api/admin/exams/${examId}/questions/import/${result.batchId}/rollback`, {
                method: 'DELETE',
            });
            const payload = await readApiResponse<{ deletedCount: number }>(response);
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Rollback gagal');
            toast.success(payload.message || 'Hasil import berhasil di-rollback');
            resetFlow();
        } catch (error) {
            setPageError(error instanceof Error ? error.message : 'Rollback gagal');
        } finally {
            setIsRollingBack(false);
        }
    };

    const hasErrors = (preview?.summary.errorCount ?? 0) > 0;

    return (
        <div className="mx-auto max-w-6xl space-y-6 pb-12">
            <ConfirmComponent />

            <div className="flex flex-col gap-4 border-b border-black/5 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <Link
                        href={`/admin/exams/${examId}/questions`}
                        aria-label="Kembali ke bank soal"
                        className="shrink-0 rounded-xl border border-black/10 bg-white p-2.5 text-muted-foreground transition-colors hover:bg-slate-50 hover:text-foreground"
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
                            <FileSpreadsheet className="size-7 shrink-0 text-emerald-700" />
                            Import Soal Excel
                        </h1>
                        <p className="mt-1 break-words text-sm text-muted-foreground">{examTitle} · format XLSX terstruktur untuk 6 tipe soal</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href="/Panduan_Import_Soal_Excel.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-700/30 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-800 transition-colors hover:bg-sky-100"
                    >
                        <FileText className="size-4" /> Unduh Panduan PDF
                    </a>
                    <a
                        href={`/api/admin/exams/${examId}/questions/import/template`}
                        download
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-700/30 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                    >
                        <Download className="size-4" /> Unduh Template Resmi
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2" aria-label="Tahapan import">
                {['Pilih File', 'Validasi & Preview', 'Selesai'].map((label, index) => {
                    const activeStep = result ? 3 : preview ? 2 : 1;
                    const step = index + 1;
                    return (
                        <div key={label} className={`rounded-xl border px-2 py-3 text-center text-xs font-semibold sm:text-sm ${step === activeStep ? 'border-blue-600 bg-blue-600 text-white' : step < activeStep ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-black/10 bg-white text-muted-foreground'}`}>
                            <span className="mr-1.5">{step}.</span>{label}
                        </div>
                    );
                })}
            </div>

            {pageError && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                    <div><p className="font-bold">Proses belum dapat dilanjutkan</p><p className="mt-1">{pageError}</p></div>
                </div>
            )}

            {!result && (
                <GlassCard className="p-5 sm:p-7">
                    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                        <div>
                            <h2 className="text-lg font-bold">1. Siapkan dan unggah file</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Gunakan template resmi tanpa mengubah nama sheet atau header. Maksimal 500 soal dan 5 MB.</p>
                            <div
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    selectFile(event.dataTransfer.files?.[0]);
                                }}
                                className="mt-5 flex min-h-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center"
                            >
                                <UploadCloud className="size-10 text-slate-500" />
                                <p className="mt-3 font-semibold">Tarik file XLSX ke area ini</p>
                                <p className="mt-1 text-xs text-muted-foreground">atau pilih dari perangkat</p>
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    className="sr-only"
                                    onChange={(event) => selectFile(event.target.files?.[0])}
                                />
                                <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-100">
                                    Pilih File XLSX
                                </button>
                                {selectedFile && (
                                    <div className="mt-4 max-w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                                        <span className="font-semibold break-all">{selectedFile.name}</span>
                                        <span className="ml-2 text-xs">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handlePreview}
                                disabled={!selectedFile || isPreviewing}
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isPreviewing ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                                {isPreviewing ? 'Memvalidasi seluruh isi...' : 'Validasi dan Tampilkan Preview'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                                <div className="flex items-center gap-2 font-bold"><Info className="size-4" /> Mengapa hanya XLSX?</div>
                                <p className="mt-2 leading-relaxed">XLSX mendukung tabel terstruktur, validasi pilihan, beberapa sheet, dan pemeriksaan baris yang presisi. Dokumen Word cocok untuk penulisan naratif, tetapi ambigu untuk import otomatis enam tipe soal.</p>
                            </div>
                            <div className="rounded-xl border border-black/10 p-4 text-sm">
                                <p className="font-bold">Struktur template</p>
                                <ul className="mt-3 space-y-2 text-muted-foreground">
                                    <li><strong className="text-foreground">SOAL</strong> — data utama, tipe, bobot, dan kunci sederhana.</li>
                                    <li><strong className="text-foreground">OPSI</strong> — pilihan untuk pilihan ganda dan multi-jawaban.</li>
                                    <li><strong className="text-foreground">PASANGAN</strong> — pasangan kiri/kanan untuk menjodohkan.</li>
                                    <li><strong className="text-foreground">CONTOH_6_TIPE</strong> — contoh lengkap yang tidak ikut diimport.</li>
                                </ul>
                            </div>
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                                <p className="font-bold">Kebijakan aman</p>
                                <p className="mt-2">Import menambah soal ke akhir bank soal dan bersifat all-or-nothing. Sistem menolak proses saat ujian sedang aktif atau ada attempt yang masih terbuka.</p>
                            </div>
                        </div>
                    </div>
                </GlassCard>
            )}

            {preview && !result && (
                <div className="space-y-5">
                    <GlassCard className="p-5 sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="text-lg font-bold">2. Hasil validasi</h2>
                                <p className="mt-1 text-sm text-muted-foreground">{preview.originalFilename || selectedFile?.name} · template v{preview.templateVersion || '-'}</p>
                            </div>
                            <button type="button" onClick={resetFlow} className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs font-bold hover:bg-slate-50">
                                <RotateCcw className="size-3.5" /> Ganti File
                            </button>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <Metric label="Total Soal" value={preview.summary.totalQuestions} />
                            <Metric label="Total Bobot" value={preview.summary.totalPoints} />
                            <Metric label="Error" value={preview.summary.errorCount} tone={preview.summary.errorCount ? 'danger' : 'success'} />
                            <Metric label="Peringatan" value={preview.summary.warningCount} tone={preview.summary.warningCount ? 'warning' : 'neutral'} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {Object.entries(TYPE_LABELS).map(([type, label]) => (
                                <span key={type} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold">{label}: {preview.summary.byType[type] || 0}</span>
                            ))}
                        </div>
                    </GlassCard>

                    {preview.issues.length > 0 && (
                        <GlassCard className="overflow-hidden">
                            <div className="border-b border-black/10 p-5">
                                <h3 className="font-bold">Temuan Validasi</h3>
                                <p className="mt-1 text-xs text-muted-foreground">Perbaiki semua error pada lokasi yang disebutkan, lalu upload ulang. Peringatan tidak memblokir import.</p>
                            </div>
                            <div className="max-h-80 overflow-auto">
                                <table className="w-full min-w-[720px] text-left text-sm">
                                    <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-3">Status</th><th className="p-3">Lokasi</th><th className="p-3">Masalah</th><th className="p-3">Saran</th></tr></thead>
                                    <tbody className="divide-y divide-black/5">
                                        {preview.issues.map((issue, index) => (
                                            <tr key={`${issue.code}-${issue.sheet}-${issue.row}-${index}`}>
                                                <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${issue.severity === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{issue.severity === 'error' ? 'ERROR' : 'PERINGATAN'}</span></td>
                                                <td className="p-3 font-mono text-xs">{[issue.sheet, issue.column && issue.row ? `${issue.column}${issue.row}` : issue.row, issue.questionCode].filter(Boolean).join(' · ') || '-'}</td>
                                                <td className="p-3"><p className="font-semibold">{issue.message}</p><p className="mt-0.5 text-xs text-muted-foreground">{issue.code}</p></td>
                                                <td className="p-3 text-muted-foreground">{issue.suggestion || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>
                    )}

                    {preview.previewRows.length > 0 && (
                        <GlassCard className="overflow-hidden">
                            <div className="border-b border-black/10 p-5"><h3 className="font-bold">Preview Soal</h3><p className="mt-1 text-xs text-muted-foreground">Menampilkan hasil normalisasi yang akan disimpan, bukan sekadar isi mentah Excel.</p></div>
                            <div className="max-h-[30rem] overflow-auto">
                                <table className="w-full min-w-[900px] text-left text-sm">
                                    <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-3">Urutan</th><th className="p-3">Kode</th><th className="p-3">Tipe</th><th className="p-3">Pertanyaan</th><th className="p-3">Kunci/Ringkasan</th><th className="p-3 text-right">Bobot</th></tr></thead>
                                    <tbody className="divide-y divide-black/5">
                                        {preview.previewRows.map((row) => (
                                            <tr key={`${row.sourceCode}-${row.sourceRow}`}>
                                                <td className="p-3 font-semibold">{row.sequence}</td><td className="p-3 font-mono text-xs">{row.sourceCode}</td><td className="p-3">{row.typeLabel || TYPE_LABELS[row.type]}</td><td className="max-w-md p-3"><p className="line-clamp-3">{row.questionText}</p><p className="mt-1 text-xs text-muted-foreground">SOAL baris {row.sourceRow}</p></td><td className="max-w-xs p-3 text-xs text-muted-foreground">{row.answerSummary}</td><td className="p-3 text-right font-semibold">{row.points}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>
                    )}

                    {preview.requiresHistoricalAcknowledgement && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                            <input type="checkbox" checked={historicalAcknowledged} onChange={(event) => setHistoricalAcknowledged(event.target.checked)} className="mt-0.5 size-4" />
                            <span><strong>Konfirmasi perubahan untuk penggunaan berikutnya.</strong><br />Ujian ini memiliki {preview.historicalAnswerCount} jawaban historis. Soal lama dan jawaban peserta tidak diubah; soal hasil import hanya ditambahkan ke bank soal.</span>
                        </label>
                    )}

                    <button
                        type="button"
                        onClick={handleCommit}
                        disabled={hasErrors || !preview.batchId || isCommitting || (!!preview.requiresHistoricalAcknowledgement && !historicalAcknowledged)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isCommitting ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        {hasErrors ? 'Perbaiki Error Sebelum Import' : isCommitting ? 'Mengimport secara atomik...' : `Import ${preview.summary.totalQuestions} Soal`}
                    </button>
                </div>
            )}

            {result && (
                <GlassCard className="p-6 sm:p-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-8" /></span>
                        <h2 className="mt-4 text-2xl font-bold">Import Berhasil</h2>
                        <p className="mt-2 text-muted-foreground">{result.importedCount} soal dengan total {result.totalPoints} poin telah ditambahkan secara atomik.</p>
                        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                            <Metric label="Soal Ditambahkan" value={result.importedCount} />
                            <Metric label="Rentang Urutan" value={result.firstSequenceOrder && result.lastSequenceOrder ? `${result.firstSequenceOrder}–${result.lastSequenceOrder}` : '-'} />
                        </div>
                        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link href={`/admin/exams/${examId}/questions`} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">Lihat Bank Soal</Link>
                            <button type="button" onClick={resetFlow} className="rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-bold hover:bg-slate-50">Import File Lain</button>
                            <button type="button" onClick={handleRollback} disabled={isRollingBack} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50">
                                {isRollingBack ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}{isRollingBack ? 'Memeriksa...' : 'Rollback Batch'}
                            </button>
                        </div>
                    </div>
                </GlassCard>
            )}
        </div>
    );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
    const colors = {
        neutral: 'border-black/10 bg-slate-50 text-foreground',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        warning: 'border-amber-200 bg-amber-50 text-amber-950',
        danger: 'border-red-200 bg-red-50 text-red-900',
    };
    return <div className={`rounded-xl border p-3 ${colors[tone]}`}><p className="text-xs font-medium opacity-70">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}
