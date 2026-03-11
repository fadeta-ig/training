'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    Book01Icon,
    AlertCircleIcon,
    VideoReplayIcon,
} from 'hugeicons-react';

type TrainingData = {
    id: string;
    title: string;
    content_html: string;
    video_url: string | null;
};

export default function MateriViewerPage({ params }: { params: Promise<{ id: string; trainingId: string }> }) {
    const { id: sessionId, trainingId } = use(params);
    const [training, setTraining] = useState<TrainingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/participant/sessions/${sessionId}/training/${trainingId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setTraining(data.data);
                } else {
                    setError(data.error || 'Gagal memuat materi');
                }
            })
            .catch(() => setError('Kesalahan jaringan'))
            .finally(() => setLoading(false));
    }, [sessionId, trainingId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !training) {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <Link href={`/dashboard/sesi/${sessionId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft01Icon size={16} /> Kembali
                </Link>
                <div className="glass-card p-10 text-center">
                    <AlertCircleIcon size={48} className="mx-auto text-destructive mb-4" />
                    <p className="text-destructive font-semibold">{error || 'Materi tidak ditemukan'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-12">
            <Link href={`/dashboard/sesi/${sessionId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                <ArrowLeft01Icon size={16} /> Kembali ke Sesi
            </Link>

            <div className="glass-card p-6 md:p-8 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Book01Icon size={14} />
                    Materi Pelatihan
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{training.title}</h1>
            </div>

            {/* Video */}
            {training.video_url && (
                <div className="glass-card p-6 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <VideoReplayIcon size={16} className="text-muted-foreground" />
                        Video Materi
                    </div>
                    <div className="aspect-video rounded-xl overflow-hidden bg-black">
                        <iframe
                            src={training.video_url.replace('watch?v=', 'embed/')}
                            className="w-full h-full"
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="glass-card p-6 md:p-8">
                <div
                    className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-a:text-primary"
                    dangerouslySetInnerHTML={{ __html: training.content_html }}
                />
            </div>
        </div>
    );
}
