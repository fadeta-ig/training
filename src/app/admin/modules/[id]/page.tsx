'use client';

import { useState, useEffect, use } from 'react';
import { CubeIcon, ArrowLeft01Icon, Book01Icon, Edit01Icon } from 'hugeicons-react';
import Link from 'next/link';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';

export default function ModuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [moduleData, setModuleData] = useState<any>(null);

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
                        let itemTitle = 'Unknown Item';
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

    if (isLoading)
        return <div className="p-10 text-center text-muted-foreground text-xs font-medium animate-pulse">Memuat detail modul...</div>;
    if (error || !moduleData)
        return <div className="p-10 text-center text-destructive text-sm font-medium">{error || 'Modul tidak ditemukan'}</div>;

    return (
        <div className="space-y-6 pb-12 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 border-b border-black/5 pb-5">
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
                                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl border border-black/5 bg-white shadow-2xs hover:border-black/10 transition-all"
                            >
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
                                        {item.item_type}
                                    </p>
                                </div>
                                <div className="shrink-0 text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                    Urutan: {item.sequence_order}
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
