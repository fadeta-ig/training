'use client';

import { useState, useEffect } from 'react';
import {
    Download,
    Package,
    FileText,
    Key,
    FileCheck,
    X,
    Loader2,
    BookOpen,
    Edit3,
    Layers,
} from 'lucide-react';
import { toast } from 'sonner';

interface ModuleDownloadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    moduleId: string;
    moduleTitle: string;
}

type DownloadMode = 'bundle' | 'individual';

interface ModuleItemSummary {
    id: string;
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
    title: string;
}

export function ModuleDownloadDialog({
    isOpen,
    onClose,
    moduleId,
    moduleTitle,
}: ModuleDownloadDialogProps) {
    const [downloadMode, setDownloadMode] = useState<DownloadMode>('bundle');
    const [includeAnswers, setIncludeAnswers] = useState<boolean>(true);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [items, setItems] = useState<ModuleItemSummary[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);

    useEffect(() => {
        if (isOpen && moduleId) {
            setIsLoadingItems(true);
            Promise.all([
                fetch(`/api/modules/${moduleId}`).then((res) => res.json()),
                fetch('/api/trainings').then((res) => res.json()),
                fetch('/api/exams').then((res) => res.json()),
            ])
                .then(([mRes, tRes, eRes]) => {
                    if (mRes.success && Array.isArray(mRes.data?.items)) {
                        const trainings = tRes.success ? tRes.data : [];
                        const exams = eRes.success ? eRes.data : [];

                        const mappedItems: ModuleItemSummary[] = mRes.data.items.map((it: any) => {
                            let title = 'Item Tanpa Judul';
                            if (it.item_type === 'training') {
                                const found = trainings.find((t: any) => t.id === it.item_id);
                                if (found) title = found.title;
                            } else if (it.item_type === 'exam') {
                                const found = exams.find((e: any) => e.id === it.item_id);
                                if (found) title = found.title;
                            }
                            return {
                                id: it.id,
                                item_type: it.item_type,
                                item_id: it.item_id,
                                sequence_order: it.sequence_order,
                                title,
                            };
                        });
                        setItems(mappedItems);
                    }
                })
                .catch(() => {
                    // silently handle
                })
                .finally(() => {
                    setIsLoadingItems(false);
                });
        }
    }, [isOpen, moduleId]);

    if (!isOpen) return null;

    const handleDownloadBundle = async () => {
        setIsDownloading(true);
        try {
            const url = `/api/modules/${moduleId}/download?format=zip&includeAnswers=${includeAnswers}`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Gagal mengunduh paket modul');
            }

            const blob = await response.blob();
            const disposition = response.headers.get('Content-Disposition');
            let filename = `${moduleTitle.replace(/[/\\?%*:|"<>]/g, '_')}_Paket_Pelatihan.zip`;

            if (disposition) {
                const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
                if (utf8Match && utf8Match[1]) {
                    try {
                        filename = decodeURIComponent(utf8Match[1]);
                    } catch {}
                } else {
                    const match = disposition.match(/filename="?([^";]+)"?/i);
                    if (match && match[1]) filename = match[1];
                }
            }

            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            toast.success('Paket modul berhasil diunduh');
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal mengunduh paket modul';
            toast.error(message);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadIndividual = async (item: ModuleItemSummary) => {
        setIsDownloading(true);
        try {
            const url = `/api/modules/${moduleId}/download?format=individual&itemId=${item.item_id}&itemType=${item.item_type}&includeAnswers=${includeAnswers}`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Gagal mengunduh item');
            }

            const blob = await response.blob();
            const disposition = response.headers.get('Content-Disposition');
            let filename = `${item.title}.html`;

            if (disposition) {
                const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
                if (utf8Match && utf8Match[1]) {
                    try {
                        filename = decodeURIComponent(utf8Match[1]);
                    } catch {}
                } else {
                    const match = disposition.match(/filename="?([^";]+)"?/i);
                    if (match && match[1]) filename = match[1];
                }
            }

            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            toast.success(`"${item.title}" berhasil diunduh`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Gagal mengunduh item';
            toast.error(message);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col font-sans"
                style={{ fontFamily: 'Tahoma, Segoe UI, Arial, sans-serif' }}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
                            <Download className="size-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 leading-tight">Download Modul</h3>
                            <p className="text-xs text-slate-500 truncate max-w-[280px] sm:max-w-[340px]">
                                {moduleTitle}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="Tutup dialog"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 text-sm">
                    {/* Format Selection Mode */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                            Pilihan Format Unduhan
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setDownloadMode('bundle')}
                                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                                    downloadMode === 'bundle'
                                        ? 'border-blue-600 bg-blue-50/50 text-blue-950 ring-1 ring-blue-600/30'
                                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <Package className={`size-4 ${downloadMode === 'bundle' ? 'text-blue-600' : 'text-slate-500'}`} />
                                    {downloadMode === 'bundle' && (
                                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                                    )}
                                </div>
                                <span className="font-bold text-xs">Paket Lengkap (.zip)</span>
                                <span className="text-[11px] text-slate-500 leading-tight">
                                    Semua materi, lampiran file, dan bank soal dalam 1 arsip.
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDownloadMode('individual')}
                                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                                    downloadMode === 'individual'
                                        ? 'border-blue-600 bg-blue-50/50 text-blue-950 ring-1 ring-blue-600/30'
                                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <Layers className={`size-4 ${downloadMode === 'individual' ? 'text-blue-600' : 'text-slate-500'}`} />
                                    {downloadMode === 'individual' && (
                                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                                    )}
                                </div>
                                <span className="font-bold text-xs">Pilih Item Satuan</span>
                                <span className="text-[11px] text-slate-500 leading-tight">
                                    Unduh materi tertentu atau lembar soal spesifik secara terpisah.
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Answer Key Option */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                            Opsi Kunci Jawaban Bank Soal
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setIncludeAnswers(true)}
                                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                                    includeAnswers
                                        ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 ring-1 ring-emerald-600/30'
                                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <Key className={`size-4 mt-0.5 shrink-0 ${includeAnswers ? 'text-emerald-600' : 'text-slate-400'}`} />
                                <div>
                                    <span className="font-bold text-xs block">Dengan Kunci Jawaban</span>
                                    <span className="text-[10.5px] text-slate-500 leading-tight block mt-0.5">
                                        Edisi Pegangan Pelatih / Trainer
                                    </span>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIncludeAnswers(false)}
                                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                                    !includeAnswers
                                        ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 ring-1 ring-emerald-600/30'
                                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <FileCheck className={`size-4 mt-0.5 shrink-0 ${!includeAnswers ? 'text-emerald-600' : 'text-slate-400'}`} />
                                <div>
                                    <span className="font-bold text-xs block">Tanpa Kunci Jawaban</span>
                                    <span className="text-[10.5px] text-slate-500 leading-tight block mt-0.5">
                                        Edisi Lembar Latihan / Soal Saja
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Individual Items List (When mode === 'individual') */}
                    {downloadMode === 'individual' && (
                        <div className="space-y-2 border-t border-slate-100 pt-4">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                Daftar Item Pembelajaran Modul
                            </label>
                            {isLoadingItems ? (
                                <div className="p-6 text-center text-xs text-slate-400 animate-pulse">
                                    Memuat daftar item...
                                </div>
                            ) : items.length === 0 ? (
                                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                                    Belum ada materi atau ujian dalam modul ini.
                                </div>
                            ) : (
                                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                                    {items.map((item, idx) => (
                                        <div
                                            key={item.id || idx}
                                            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="w-6 h-6 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-center shrink-0">
                                                    {item.sequence_order}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-900 truncate">
                                                        {item.title}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                                                        {item.item_type === 'training' ? 'Materi Pembelajaran' : 'Bank Soal Ujian'}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleDownloadIndividual(item)}
                                                disabled={isDownloading}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs shrink-0 disabled:opacity-50"
                                            >
                                                <Download className="size-3" />
                                                <span>Unduh</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDownloading}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        Tutup
                    </button>

                    {downloadMode === 'bundle' && (
                        <button
                            type="button"
                            onClick={handleDownloadBundle}
                            disabled={isDownloading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {isDownloading ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Menyiapkan Berkas...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="size-3.5" />
                                    <span>Download Paket ZIP</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
