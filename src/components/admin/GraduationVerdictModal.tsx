'use client';

import { useState, useEffect } from 'react';
import { Award, Check, X, AlertCircle, Sparkles, FileText } from 'lucide-react';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 bg-background shadow-2xl animate-in zoom-in-95 duration-200 dark:border-white/10 flex flex-col"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b px-6 py-4.5">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                            <Award className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold tracking-tight text-foreground">
                                Penetapan Status Kelulusan
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Tentukan keputusan kelulusan resmi untuk peserta ini.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Participant Summary Card */}
                    <div className="rounded-xl border border-black/5 bg-muted/40 p-4 space-y-2 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Peserta</span>
                            {participant.nip && (
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                    NIP: {participant.nip}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                            {participant.full_name || participant.username}
                        </p>
                        {participant.final_score !== null && participant.final_score !== undefined && (
                            <div className="flex items-center gap-2 pt-1 text-xs">
                                <span className="text-muted-foreground">Nilai Ujian Tertinggi:</span>
                                <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                                    {Number(participant.final_score).toFixed(2)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Status Radio Choices */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">
                            Keputusan Kelulusan <span className="text-destructive">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                            {/* Passed */}
                            <label
                                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 cursor-pointer transition-all ${
                                    status === 'passed'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-200'
                                        : 'border-input hover:bg-muted text-muted-foreground'
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
                                <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-xs font-bold">LULUS</span>
                            </label>

                            {/* Failed */}
                            <label
                                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 cursor-pointer transition-all ${
                                    status === 'failed'
                                        ? 'border-red-500 bg-red-50 text-red-950 ring-2 ring-red-500/20 dark:bg-red-950/40 dark:text-red-200'
                                        : 'border-input hover:bg-muted text-muted-foreground'
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
                                <AlertCircle className="size-5 text-red-600 dark:text-red-400" />
                                <span className="text-xs font-bold">TIDAK LULUS</span>
                            </label>

                            {/* Pending */}
                            <label
                                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 cursor-pointer transition-all ${
                                    status === 'pending'
                                        ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-500/20 dark:bg-amber-950/40 dark:text-amber-200'
                                        : 'border-input hover:bg-muted text-muted-foreground'
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
                                <Sparkles className="size-5 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs font-bold">PENDING</span>
                            </label>
                        </div>
                    </div>

                    {status === 'passed' && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-start gap-2">
                            <FileText className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                            <p className="leading-relaxed">
                                Peserta yang dinyatakan <strong>LULUS</strong> akan otomatis mendapatkan <strong>Nomor SKL</strong> dan dapat langsung mengunduh Surat Keterangan Lulus (SKL) di portal mereka.
                            </p>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Catatan Kelulusan / Evaluasi <span className="text-muted-foreground">(Opsional)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Contoh: Telah memenuhi seluruh kriteria kelulusan dengan predikat Sangat Baik."
                            className="w-full rounded-xl border border-input bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 text-xs font-medium rounded-xl border border-input hover:bg-muted text-foreground transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Menyimpan...' : 'Simpan Keputusan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
