'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Cancel01Icon,
    Tick01Icon
} from 'hugeicons-react';
import { toast } from 'sonner';
import { Calculator, Plus, Minus, Sparkles, Users, RotateCcw } from 'lucide-react';

export interface BulkScoreAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    sessionId: string;
    participantIds: string[];
    moduleItemId?: string | null;
    selectedCount?: number;
    participantCount?: number;
}

const ADJUST_PRESET_REASONS = [
    'Bonus Soal Ujian Dianulir Bersama',
    'Dispensasi Gangguan Teknis Sesi',
    'Penyesuaian Nilai Kurva Kelulusan Massal',
    'Bonus Kehadiran & Evaluasi Praktik',
];

const RESET_PRESET_REASONS = [
    'Pembatalan Penyesuaian Nilai Bersama',
    'Reset Massal ke Nilai Asli Ujian',
    'Koreksi Nilai Pasca Evaluasi',
    'Anulir Bonus Sesi Ujian',
];

export function BulkScoreAdjustmentModal({
    isOpen,
    onClose,
    onSuccess,
    sessionId,
    moduleItemId,
    selectedCount,
    participantCount,
    participantIds,
}: BulkScoreAdjustmentModalProps) {
    const effectiveCount = participantCount ?? selectedCount ?? participantIds.length;
    const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'reset'>('add');
    const [value, setValue] = useState<number>(5);
    const [reason, setReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!reason.trim()) {
            toast.error('Alasan Wajib Diisi', {
                description: 'Mohon tuliskan alasan penyesuaian nilai massal untuk keperluan audit trail.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/admin/sessions/${sessionId}/participants/score-adjust-bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participant_ids: participantIds,
                    module_item_id: moduleItemId || undefined,
                    adjustment_type: adjustmentType,
                    value: Number(value) || 0,
                    reason: reason.trim(),
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Penyesuaian Nilai Massal Berhasil!', {
                    description: data.message,
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

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-black/10 p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-black/5 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-foreground">Penyesuaian Nilai Massal</h3>
                            <p className="text-xs text-muted-foreground">
                                Diterapkan ke <strong className="text-foreground">{effectiveCount} peserta</strong> terpilih
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

                {/* Info Callout */}
                {adjustmentType === 'reset' ? (
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1 animate-in fade-in duration-150">
                        <p className="font-semibold flex items-center gap-1.5 text-amber-900">
                            <RotateCcw size={14} className="text-amber-700 shrink-0" />
                            Pemulihan ke Nilai Murni Ujian
                        </p>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                            Seluruh penyesuaian nilai (+/-) pada <strong className="text-amber-950">{effectiveCount} peserta</strong> terpilih akan dinolkan (0.00). Nilai akhir setiap peserta akan kembali sama persis dengan nilai asli pengerjaan ujian masing-masing.
                        </p>
                    </div>
                ) : (
                    <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-950 space-y-1 animate-in fade-in duration-150">
                        <p className="font-semibold flex items-center gap-1.5">
                            <Calculator size={14} className="text-indigo-600 shrink-0" />
                            Kalkulasi Aman Terpantau
                        </p>
                        <p className="text-[11px] text-indigo-800 leading-relaxed">
                            Nilai asli setiap peserta akan tetap disimpan utuh. Nilai akhir akan otomatis dibatasi maksimal 100 dan minimal 0.
                        </p>
                    </div>
                )}

                {/* Operation Mode Tabs */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                        Operasi Nilai:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                        <button
                            type="button"
                            onClick={() => setAdjustmentType('add')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                adjustmentType === 'add'
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-black/5'
                            }`}
                        >
                            <Plus size={13} /> Tambah (+)
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdjustmentType('subtract')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                adjustmentType === 'subtract'
                                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-black/5'
                            }`}
                        >
                            <Minus size={13} /> Kurang (-)
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdjustmentType('reset')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                adjustmentType === 'reset'
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-black/5'
                            }`}
                        >
                            <RotateCcw size={13} /> Reset Awal
                        </button>
                    </div>
                </div>

                {/* Value Input (Only for Add / Subtract) */}
                {adjustmentType !== 'reset' && (
                    <div className="space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-foreground">
                                Besaran Poin Penyesuaian:
                            </label>
                            <div className="flex items-center gap-1">
                                {[1, 2, 5, 10].map((step) => (
                                    <button
                                        key={step}
                                        type="button"
                                        onClick={() => setValue(step)}
                                        className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-black/5 cursor-pointer"
                                    >
                                        {step}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                min="0.5"
                                max="50"
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
                )}

                {/* Reason Input & Presets */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                        Alasan {adjustmentType === 'reset' ? 'Reset Nilai Massal' : 'Penyesuaian Massal'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={adjustmentType === 'reset' ? "Contoh: Pembatalan bonus soal ujian nomor 12..." : "Contoh: Bonus koreksi soal nomor 12..."}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />

                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {(adjustmentType === 'reset' ? RESET_PRESET_REASONS : ADJUST_PRESET_REASONS).map((preset) => (
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
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/5">
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
                        className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 ${
                            adjustmentType === 'reset'
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        {isSubmitting ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                        ) : adjustmentType === 'reset' ? (
                            <RotateCcw size={14} />
                        ) : (
                            <Tick01Icon size={14} />
                        )}
                        <span>
                            {adjustmentType === 'reset'
                                ? `Reset Nilai ${effectiveCount} Peserta ke Nilai Awal`
                                : `Terapkan ${adjustmentType === 'add' ? `+${value}` : `-${value}`} ke ${effectiveCount} Peserta`}
                        </span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
