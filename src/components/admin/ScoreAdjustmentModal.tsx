'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Cancel01Icon,
    PencilEdit01Icon,
    Tick01Icon,
    AlertCircleIcon,
    InformationCircleIcon
} from 'hugeicons-react';
import { toast } from 'sonner';
import { Calculator, ArrowRight, RotateCcw, Plus, Minus, Sparkles } from 'lucide-react';

interface ScoreAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    sessionId: string;
    participant: {
        id: string;
        full_name: string;
        username: string;
        final_score?: number | null;
        original_score?: number | null;
        score_adjustment?: number | null;
        adjustment_reason?: string | null;
        exam_module_item_id?: string | null;
    } | null;
}

const PRESET_REASONS = [
    'Bonus Koreksi Kunci Soal',
    'Dispensasi Gangguan Jaringan',
    'Bonus Keaktifan & Tugas Praktik',
    'Penyesuaian Kurva Standar Kelulusan',
    'Kebijakan Khusus Dewan Asesor',
];

export function ScoreAdjustmentModal({
    isOpen,
    onClose,
    onSuccess,
    sessionId,
    participant,
}: ScoreAdjustmentModalProps) {
    const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');
    const [value, setValue] = useState<number>(5);
    const [reason, setReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const originalScore = participant?.original_score !== null && participant?.original_score !== undefined
        ? Number(participant.original_score)
        : Number(participant?.final_score || 0);

    const currentAdjustment = Number(participant?.score_adjustment || 0);
    const currentScore = Number(participant?.final_score || originalScore);

    useEffect(() => {
        if (participant) {
            setAdjustmentType('add');
            setValue(5);
            setReason(participant.adjustment_reason || '');
        }
    }, [participant]);

    if (!isOpen || !participant) return null;

    // Hitung proyeksi skor baru
    let projectedAdjustment = currentAdjustment;
    let projectedFinalScore = currentScore;

    if (adjustmentType === 'add') {
        projectedAdjustment = Math.round((currentAdjustment + Number(value || 0)) * 100) / 100;
        projectedFinalScore = Math.min(100, Math.max(0, Math.round((originalScore + projectedAdjustment) * 100) / 100));
    } else if (adjustmentType === 'subtract') {
        projectedAdjustment = Math.round((currentAdjustment - Number(value || 0)) * 100) / 100;
        projectedFinalScore = Math.min(100, Math.max(0, Math.round((originalScore + projectedAdjustment) * 100) / 100));
    } else if (adjustmentType === 'set') {
        projectedFinalScore = Math.min(100, Math.max(0, Math.round(Number(value || 0) * 100) / 100));
        projectedAdjustment = Math.round((projectedFinalScore - originalScore) * 100) / 100;
    }

    const handleSave = async () => {
        if (!reason.trim()) {
            toast.error('Alasan Wajib Diisi', {
                description: 'Mohon tuliskan alasan penyesuaian nilai untuk keperluan audit trail.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/admin/sessions/${sessionId}/participants/${participant.id}/score-adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adjustment_type: adjustmentType,
                    value: Number(value) || 0,
                    reason: reason.trim(),
                    module_item_id: participant.exam_module_item_id || undefined,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Nilai Berhasil Disesuaikan!', {
                    description: `Nilai ${participant.full_name} kini menjadi ${data.data.final_score.toFixed(1)}`,
                });
                onSuccess();
                onClose();
            } else {
                toast.error('Gagal Menyesuaikan Nilai', {
                    description: data.error || 'Terjadi kesalahan sistem',
                });
            }
        } catch (err: any) {
            toast.error('Kesalahan Jaringan', { description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetToOriginal = async () => {
        if (currentAdjustment === 0) {
            toast.info('Nilai sudah merupakan nilai asli.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/admin/sessions/${sessionId}/participants/${participant.id}/score-adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adjustment_type: 'set',
                    value: originalScore,
                    reason: 'Direset kembali ke nilai asli pengerjaan ujian.',
                    module_item_id: participant.exam_module_item_id || undefined,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Nilai Direset ke Nilai Asli!', {
                    description: `Nilai ${participant.full_name} kembali menjadi ${originalScore.toFixed(1)}`,
                });
                onSuccess();
                onClose();
            } else {
                toast.error('Gagal Reset Nilai', {
                    description: data.error || 'Terjadi kesalahan sistem',
                });
            }
        } catch (err: any) {
            toast.error('Kesalahan Jaringan', { description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-black/10 p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-black/5 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                            <Calculator size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-foreground">Penyesuaian Nilai Ujian</h3>
                            <p className="text-xs text-muted-foreground">
                                Peserta: <strong className="text-foreground">{participant.full_name}</strong> ({participant.username})
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        aria-label="Tutup"
                    >
                        <Cancel01Icon size={16} />
                    </button>
                </div>

                {/* Score Projection Card */}
                <div className="rounded-xl border border-indigo-200/80 bg-linear-to-br from-indigo-50/50 via-white to-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Pratinjau Perubahan Nilai</span>
                        {currentAdjustment !== 0 && (
                            <span className="text-indigo-700 font-mono text-[11px] normal-case bg-indigo-100/70 px-2 py-0.5 rounded-md">
                                Sedang Disesuaikan ({currentAdjustment > 0 ? `+${currentAdjustment}` : currentAdjustment})
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-3 items-center gap-2 pt-1 text-center">
                        <div className="bg-white p-2.5 rounded-lg border border-black/5 shadow-2xs">
                            <div className="text-[10px] text-muted-foreground font-medium uppercase">Nilai Asli</div>
                            <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
                                {originalScore.toFixed(1)}
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center">
                            <ArrowRight size={18} className="text-indigo-600" />
                            <span className="text-[11px] font-mono font-bold mt-1 text-indigo-700">
                                {projectedAdjustment >= 0 ? `+${projectedAdjustment.toFixed(1)}` : projectedAdjustment.toFixed(1)}
                            </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-indigo-300 shadow-2xs ring-2 ring-indigo-500/10">
                            <div className="text-[10px] text-indigo-800 font-bold uppercase">Nilai Akhir</div>
                            <div className="text-xl font-extrabold font-mono text-indigo-950 mt-0.5">
                                {projectedFinalScore.toFixed(1)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Operation Mode Tabs */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                        Metode Penyesuaian:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setAdjustmentType('add');
                                if (value === 0) setValue(5);
                            }}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                                adjustmentType === 'add'
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-black/5'
                            }`}
                        >
                            <Plus size={14} /> Tambah (+)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAdjustmentType('subtract');
                                if (value === 0) setValue(5);
                            }}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                                adjustmentType === 'subtract'
                                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-black/5'
                            }`}
                        >
                            <Minus size={14} /> Kurang (-)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAdjustmentType('set');
                                setValue(Math.round(currentScore));
                            }}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                                adjustmentType === 'set'
                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-black/5'
                            }`}
                        >
                            <PencilEdit01Icon size={14} /> Tetapkan (=)
                        </button>
                    </div>
                </div>

                {/* Value Input */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground">
                            {adjustmentType === 'set' ? 'Nilai Target Akhir (0 - 100):' : 'Besaran Poin Penyesuaian:'}
                        </label>
                        <div className="flex items-center gap-1">
                            {[1, 2, 5, 10].map((step) => (
                                <button
                                    key={step}
                                    type="button"
                                    onClick={() => setValue(step)}
                                    className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-black/5"
                                >
                                    {step}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={value}
                            onChange={(e) => setValue(Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            placeholder="Contoh: 5"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                            Poin
                        </span>
                    </div>
                </div>

                {/* Reason Input & Presets */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                        Alasan Penyesuaian <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Tuliskan alasan penyesuaian nilai..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />

                    {/* Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {PRESET_REASONS.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setReason(preset)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-black/5 transition-colors cursor-pointer"
                            >
                                <Sparkles size={10} /> {preset}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-black/5">
                    {currentAdjustment !== 0 ? (
                        <button
                            type="button"
                            onClick={handleResetToOriginal}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            title="Kembalikan ke nilai asli hasil ujian"
                        >
                            <RotateCcw size={13} /> Reset ke Asli ({originalScore.toFixed(1)})
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSubmitting || !reason.trim()}
                            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Tick01Icon size={14} />
                            )}
                            <span>Simpan Nilai ({projectedFinalScore.toFixed(1)})</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
