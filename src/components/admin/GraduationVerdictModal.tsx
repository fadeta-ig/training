'use client';

import { useState, useEffect } from 'react';
import { Award, Check, X, AlertCircle, Sparkles, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface GraduationVerdictModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    sessionId: string;
    participant: {
        id: string; // userId
        full_name?: string;
        username: string;
        nip?: string | null;
        graduation_status?: 'pending' | 'passed' | 'failed';
        graduation_notes?: string | null;
        skl_number?: string | null;
        final_score?: number | null;
    } | null;
}

export function GraduationVerdictModal({
    isOpen,
    onClose,
    onSuccess,
    sessionId,
    participant,
}: GraduationVerdictModalProps) {
    const [status, setStatus] = useState<'pending' | 'passed' | 'failed'>('pending');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (participant) {
            setStatus(participant.graduation_status || 'pending');
            setNotes(participant.graduation_notes || '');
        }
    }, [participant]);

    if (!isOpen || !participant) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch(
                `/api/admin/sessions/${sessionId}/participants/${participant.id}/graduation`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        graduation_status: status,
                        graduation_notes: notes.trim() || null,
                    }),
                }
            );

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success('Keputusan Kelulusan Berhasil Disimpan!', {
                    description: data.message,
                });
                onSuccess();
                onClose();
            } else {
                toast.error('Gagal Menyimpan Keputusan', {
                    description: data.error || 'Terjadi kesalahan sistem.',
                });
            }
        } catch {
            toast.error('Gagal terhubung ke server. Periksa koneksi Anda.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="w-full max-w-lg overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-slate-900 flex flex-col"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-black/5 dark:border-white/5 px-6 py-4.5">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shrink-0 shadow-xs">
                            <Award className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold tracking-tight text-foreground">
                                Penetapan Status Kelulusan
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Tentukan keputusan kelulusan resmi & penerbitan SKL peserta.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Participant Summary Card */}
                    <div className="rounded-2xl border border-black/5 bg-slate-50/80 p-4 space-y-2 dark:border-white/5 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">Informasi Peserta</span>
                            {participant.nip && (
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                                    NIP: {participant.nip}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-bold text-foreground">
                            {participant.full_name || participant.username}
                        </p>
                        {participant.final_score !== null && participant.final_score !== undefined && (
                            <div className="flex items-center gap-2 pt-1 text-xs">
                                <span className="text-muted-foreground">Nilai Ujian Tertinggi:</span>
                                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                                    {Number(participant.final_score).toFixed(2)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Status Radio Choices */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-foreground">
                            Pilih Keputusan Kelulusan <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                            {/* Passed */}
                            <label
                                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                                    status === 'passed'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30 shadow-xs dark:bg-emerald-950/40 dark:text-emerald-200'
                                        : 'border-slate-200 hover:bg-slate-50 text-muted-foreground dark:border-slate-800 dark:hover:bg-slate-800'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="status"
                                    value="passed"
                                    checked={status === 'passed'}
                                    onChange={() => setStatus('passed')}
                                    className="sr-only"
                                />
                                <div className={`size-8 rounded-full flex items-center justify-center ${
                                    status === 'passed' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                }`}>
                                    <Check className="size-4.5 stroke-[3]" />
                                </div>
                                <span className="text-xs font-bold tracking-wide">LULUS</span>
                            </label>

                            {/* Failed */}
                            <label
                                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                                    status === 'failed'
                                        ? 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/30 shadow-xs dark:bg-rose-950/40 dark:text-rose-200'
                                        : 'border-slate-200 hover:bg-slate-50 text-muted-foreground dark:border-slate-800 dark:hover:bg-slate-800'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="status"
                                    value="failed"
                                    checked={status === 'failed'}
                                    onChange={() => setStatus('failed')}
                                    className="sr-only"
                                />
                                <div className={`size-8 rounded-full flex items-center justify-center ${
                                    status === 'failed' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                }`}>
                                    <AlertCircle className="size-4.5 stroke-[2.5]" />
                                </div>
                                <span className="text-xs font-bold tracking-wide">TIDAK LULUS</span>
                            </label>

                            {/* Pending */}
                            <label
                                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                                    status === 'pending'
                                        ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-500/30 shadow-xs dark:bg-amber-950/40 dark:text-amber-200'
                                        : 'border-slate-200 hover:bg-slate-50 text-muted-foreground dark:border-slate-800 dark:hover:bg-slate-800'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="status"
                                    value="pending"
                                    checked={status === 'pending'}
                                    onChange={() => setStatus('pending')}
                                    className="sr-only"
                                />
                                <div className={`size-8 rounded-full flex items-center justify-center ${
                                    status === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                                }`}>
                                    <Sparkles className="size-4.5" />
                                </div>
                                <span className="text-xs font-bold tracking-wide">PENDING</span>
                            </label>
                        </div>
                    </div>

                    {/* Impact Callout */}
                    {status === 'passed' && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-start gap-2.5 animate-in fade-in">
                            <ShieldCheck className="size-4.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                            <div className="space-y-0.5">
                                <p className="font-bold">Otomatisasi SKL & Verifikasi:</p>
                                <p className="text-[11px] leading-relaxed text-emerald-800/90 dark:text-emerald-300">
                                    Peserta yang dinyatakan <strong>LULUS</strong> akan otomatis mendapatkan <strong>Nomor SKL Resmi</strong> dan tombol unduh/cetak SKL langsung aktif di dashboard mereka.
                                </p>
                            </div>
                        </div>
                    )}

                    {status === 'failed' && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 flex items-start gap-2.5 animate-in fade-in">
                            <AlertCircle className="size-4.5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                            <div className="space-y-0.5">
                                <p className="font-bold">Catatan Evaluasi / Remedial:</p>
                                <p className="text-[11px] leading-relaxed text-rose-800/90 dark:text-rose-300">
                                    Peserta akan menerima status Belum Lulus beserta catatan evaluasi di portal mereka, dan akses SKL akan dinonaktifkan.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                            Catatan Kelulusan / Evaluasi <span className="text-muted-foreground font-normal">(Opsional)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Contoh: Telah memenuhi seluruh kriteria kelulusan dengan predikat Sangat Baik."
                            className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all resize-none dark:border-slate-800 dark:bg-slate-950"
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-black/5 dark:border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-100 text-foreground transition-colors dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl text-white shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                                status === 'passed'
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : status === 'failed'
                                    ? 'bg-rose-600 hover:bg-rose-700'
                                    : 'bg-slate-900 hover:bg-slate-800'
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <span>{status === 'passed' ? 'Simpan & Luluskan Peserta' : status === 'failed' ? 'Simpan Status Tidak Lulus' : 'Simpan Keputusan'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
