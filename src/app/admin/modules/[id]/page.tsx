'use client';

import { useState, useEffect, use } from 'react';
import { CubeIcon, ArrowLeft01Icon, Book01Icon, Edit01Icon } from 'hugeicons-react';
import Link from 'next/link';

export default function ModuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [moduleData, setModuleData] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            fetch(`/api/modules/${resolvedParams.id}`).then(res => res.json()),
            fetch('/api/trainings').then(res => res.json()),
            fetch('/api/exams').then(res => res.json())
        ]).then(([mRes, tRes, eRes]) => {
            if (mRes.success) {
                let tempTrainings: any[] = [];
                let tempExams: any[] = [];

                if (tRes.success) tempTrainings = tRes.data;
                if (eRes.success) tempExams = eRes.data;

                const loadedItems = mRes.data.items.map((it: any) => {
                    let itemTitle = 'Unknown Item';
                    if (it.item_type === 'training') {
                        const rec = tempTrainings.find(t => t.id === it.item_id);
                        if (rec) itemTitle = rec.title;
                    } else if (it.item_type === 'exam') {
                        const rec = tempExams.find(e => e.id === it.item_id);
                        if (rec) itemTitle = rec.title;
                    }
                    return {
                        ...it,
                        title: itemTitle
                    };
                });
                
                mRes.data.items = loadedItems;
                setModuleData(mRes.data);
            } else {
                throw new Error(mRes.error);
            }
            setIsLoading(false);
        }).catch(err => {
            setError(err.message || 'Gagal memuat data modul');
            setIsLoading(false);
        });
    }, [resolvedParams.id]);

    if (isLoading) return <div className="p-10 text-center text-muted-foreground">Memuat detail modul...</div>;
    if (error || !moduleData) return <div className="p-10 text-center text-destructive">{error || 'Modul tidak ditemukan'}</div>;

    return (
        <div className="space-y-8 pb-12 max-w-4xl">
            <div className="flex items-center gap-4 border-b border-black/5 pb-6">
                <Link
                    href="/admin/modules"
                    className="p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <CubeIcon size={28} className="text-muted-foreground" />
                        {moduleData.title}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        {moduleData.description || 'Tidak ada deskripsi'}
                    </p>
                </div>
            </div>

            <div className="glass-card p-6 md:p-8">
                <div className="mb-6 pb-4 border-b border-black/5">
                    <h2 className="text-lg font-bold">Alur Pembelajaran Modul</h2>
                    <p className="text-sm text-muted-foreground">Modul ini memiliki {moduleData.items.length} sesi pembelajaran.</p>
                </div>

                <div className="space-y-4">
                    {moduleData.items.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-black/10 rounded-2xl text-muted-foreground">
                            Belum ada materi atau ujian dalam modul ini.
                        </div>
                    ) : (
                        moduleData.items.map((item: any, index: number) => (
                            <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-black/10 bg-white/60">
                                <div className="w-8 h-8 rounded-full bg-black/5 font-bold text-sm text-black/40 flex items-center justify-center shrink-0">
                                    {index + 1}
                                </div>
                                <div className="p-2 rounded-lg bg-black/5 text-muted-foreground shrink-0">
                                    {item.item_type === 'training' ? <Book01Icon size={20} /> : <Edit01Icon size={20} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-foreground text-sm truncate">{item.title}</h4>
                                    <p className="text-xs font-mono text-muted-foreground uppercase mt-1">{item.item_type}</p>
                                </div>
                                <div className="shrink-0 text-xs font-semibold text-muted-foreground bg-black/5 px-2 py-1 rounded">
                                    Sequence: {item.sequence_order}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
