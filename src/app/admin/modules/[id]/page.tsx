'use client';

import { useState, useEffect, use } from 'react';
import { CubeIcon, ArrowLeft01Icon, Book01Icon, Edit01Icon } from 'hugeicons-react';
import { Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';
import { ModuleDownloadDialog } from '@/components/admin/ModuleDownloadDialog';
import { toast } from 'sonner';

export default function ModuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [moduleData, setModuleData] = useState<any>(null);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            fetch(`/api/modules/${resolvedParams.id}`).then((res) => res.json()),
            fetch('/api/trainings').then((res) => res.json()),
            fetch('/api/exams').then((res) => res.json()),
        ])
            .then(([mRes, tRes, eRes]) => {
                if (mRes.success) {
                    let tempTrainings: any[] = [];
                    let tempExams: any[] = [];

                    if (tRes.success) tempTrainings = tRes.data;
                    if (eRes.success) tempExams = eRes.data;

                    const loadedItems = mRes.data.items.map((it: any) => {
                        let itemTitle = 'Item Tanpa Judul';
                        if (it.item_type === 'training') {
                            const rec = tempTrainings.find((t) => t.id === it.item_id);
                            if (rec) itemTitle = rec.title;
                        } else if (it.item_type === 'exam') {
                            const rec = tempExams.find((e) => e.id === it.item_id);
                            if (rec) itemTitle = rec.title;
                        }
                        return {
                            ...it,
                            title: itemTitle,
                        };
                    });

                    mRes.data.items = loadedItems;
                    setModuleData(mRes.data);
                } else {
                    throw new Error(mRes.error);
                }
                setIsLoading(false);
            })
            .catch((err) => {
                setError(err.message || 'Gagal memuat data modul');
                setIsLoading(false);
            });
    }, [resolvedParams.id]);

    const items = moduleData?.items || [];
    const {
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        startIndex,
        paginatedItems,
        setPage,
        setPageSize,
    } = usePagination({ items, initialPageSize: 10 });

    const handleQuickDownloadItem = async (item: any) => {
        setDownloadingItemId(item.item_id);
        try {
            const url = `/api/modules/${resolvedParams.id}/download?format=individual&itemId=${item.item_id}&itemType=${item.item_type}&includeAnswers=true`;
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
            const message = err instanceof Error ? err.message : 'Gagal mengunduh berkas';
            toast.error(message);
        } finally {
            setDownloadingItemId(null);
        }
    };

    if (isLoading)
        return <div className="p-10 text-center text-muted-foreground text-xs font-medium animate-pulse">Memuat detail modul...</div>;
    if (error || !moduleData)
        return <div className="p-10 text-center text-destructive text-sm font-medium">{error || 'Modul tidak ditemukan'}</div>;

    return (
        <div className="space-y-6 pb-12 max-w-4xl mx-auto">
            {/* Download Modal Dialog */}
            <ModuleDownloadDialog
                isOpen={isDownloadOpen}
                onClose={() => setIsDownloadOpen(false)}
                moduleId={resolvedParams.id}
                moduleTitle={moduleData.title}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-5">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/modules"
                        className="p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors shadow-2xs"
                    >
                        <ArrowLeft01Icon size={18} />
                    </Link>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
                            <CubeIcon size={24} className="text-slate-700" />
                            {moduleData.title}
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {moduleData.description || 'Tidak ada deskripsi'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsDownloadOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs"
                    >
                        <Download className="size-4 text-blue-600" />
                        <span>Download Modul</span>
                    </button>
                </div>
            </div>

            <div className="glass-card p-5 sm:p-6 space-y-4">
                <div className="pb-3 border-b border-black/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Alur Pembelajaran Modul</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Modul ini memiliki {items.length} sesi pembelajaran.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {items.length === 0 ? (
                        <div className="p-8 text-center border border-dashed border-black/10 rounded-xl text-xs text-muted-foreground">
                            Belum ada materi atau ujian dalam modul ini.
                        </div>
                    ) : (
                        paginatedItems.map((item: any, index: number) => (
                            <div
                                key={index}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-black/5 bg-white shadow-2xs hover:border-black/10 transition-all"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-7 h-7 rounded-lg bg-slate-100 font-mono font-medium text-xs text-slate-700 flex items-center justify-center shrink-0">
                                        {startIndex + index + 1}
                                    </div>
                                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                                        {item.item_type === 'training' ? (
                                            <Book01Icon size={18} />
                                        ) : (
                                            <Edit01Icon size={18} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-foreground text-xs sm:text-sm truncate">
                                            {item.title}
                                        </h4>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">
                                            {item.item_type === 'training' ? 'Materi Pembelajaran' : 'Bank Soal Evaluasi'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                    <div className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                        Urutan: {item.sequence_order}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleQuickDownloadItem(item)}
                                        disabled={downloadingItemId === item.item_id}
                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-50"
                                        title={`Download berkas ${item.title}`}
                                        aria-label={`Download ${item.title}`}
                                    >
                                        {downloadingItemId === item.item_id ? (
                                            <Loader2 className="size-4 animate-spin text-blue-600" />
                                        ) : (
                                            <Download className="size-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
