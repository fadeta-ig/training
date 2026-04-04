'use client';

import { useState, useEffect, use } from 'react';
import { Book01Icon, ArrowLeft01Icon } from 'hugeicons-react';
import Link from 'next/link';

export default function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [isLoading, setIsLoading] = useState(true);
    const [training, setTraining] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTraining = async () => {
            try {
                const res = await fetch(`/api/trainings/${resolvedParams.id}`);
                const data = await res.json();
                if (data.success) {
                    setTraining(data.data);
                } else {
                    throw new Error(data.error);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTraining();
    }, [resolvedParams.id]);

    if (isLoading) return <div className="p-10 text-center text-muted-foreground">Memuat detail materi...</div>;
    if (error || !training) return <div className="p-10 text-center text-destructive">{error || 'Materi tidak ditemukan'}</div>;

    return (
        <div className="space-y-8 pb-12 max-w-4xl">
            <div className="flex items-center gap-4 border-b border-black/5 pb-6">
                <Link
                    href="/admin/content"
                    className="p-2.5 rounded-xl bg-white border border-black/10 text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors shadow-sm"
                >
                    <ArrowLeft01Icon size={20} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <Book01Icon size={28} className="text-muted-foreground" />
                        {training.title}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Pratinjau detail informasi materi.
                    </p>
                </div>
            </div>

            <div className="glass-card p-8 min-h-[300px]">
                <div 
                    className="prose prose-sm md:prose-base max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: training.content_html || '<p>Tidak ada konten teks.</p>' }}
                />
            </div>

            {training.media && training.media.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold">Media / Lampiran</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {training.media.map((m: any, idx: number) => (
                            <div key={idx} className="glass-card p-4 flex items-center gap-3">
                                {m.media_type === 'youtube' ? (
                                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                                        YT
                                    </div>
                                ) : m.media_type === 'image' ? (
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                                        <img src={m.media_url} alt="" className="object-cover w-full h-full" />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 bg-black/5 rounded-lg flex items-center justify-center shrink-0">
                                        FIL
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{m.original_filename || m.media_url}</p>
                                    <p className="text-xs text-muted-foreground uppercase">{m.media_type}</p>
                                </div>
                                <a href={m.media_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-600 hover:underline">
                                    Buka
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
