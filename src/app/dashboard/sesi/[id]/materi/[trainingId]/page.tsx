'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft01Icon,
    Book01Icon,
    AlertCircleIcon,
    VideoReplayIcon,
    Tick01Icon,
} from 'hugeicons-react';
import { toast } from 'sonner';

type TrainingData = {
    id: string;
    title: string;
    content_html: string;
    video_url: string | null;
};

function extractYouTubeEmbedUrl(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const regex of patterns) {
        const match = url.match(regex);
        if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;
    }
    return null;
}

export default function MateriViewerPage({ params }: { params: Promise<{ id: string; trainingId: string }> }) {
    const { id: sessionId, trainingId } = use(params);
    const router = useRouter();
    const [training, setTraining] = useState<TrainingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [completed, setCompleted] = useState(false);
    const [marking, setMarking] = useState(false);

    useEffect(() => {
        fetch(`/api/participant/sessions/${sessionId}/training/${trainingId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setTraining(data.data);
                else setError(data.error || 'Gagal memuat materi');
            })
            .catch(() => setError('Kesalahan jaringan'))
            .finally(() => setLoading(false));
    }, [sessionId, trainingId]);

    const handleMarkComplete = async () => {
        setMarking(true);
        try {
            const res = await fetch(`/api/participant/sessions/${sessionId}/training/${trainingId}/complete`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setCompleted(true);
                toast.success('Materi selesai! Lanjut ke item berikutnya.');
            } else {
                toast.error(data.error || 'Gagal menandai selesai');
            }
        } catch {
            toast.error('Kesalahan jaringan');
        } finally {
            setMarking(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !training) {
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                <Link href={`/dashboard/sesi/${sessionId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <ArrowLeft01Icon size={14} /> Kembali
                </Link>
                <div className="glass-card p-8 text-center">
                    <AlertCircleIcon size={36} className="mx-auto text-destructive mb-3" />
                    <p className="text-sm text-destructive font-semibold">{error || 'Materi tidak ditemukan'}</p>
                </div>
            </div>
        );
    }

    const embedUrl = training.video_url ? extractYouTubeEmbedUrl(training.video_url) : null;

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-12">
            <Link href={`/dashboard/sesi/${sessionId}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                <ArrowLeft01Icon size={14} /> Kembali ke Sesi
            </Link>

            {/* Compact Title */}
            <div className="glass-card p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
                    <Book01Icon size={16} />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Materi Pelatihan</p>
                    <h1 className="text-base font-bold tracking-tight truncate">{training.title}</h1>
                </div>
            </div>

            {/* Video */}
            {embedUrl && (
                <div className="glass-card p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <VideoReplayIcon size={12} />
                        Video
                    </div>
                    <div className="aspect-video rounded-lg overflow-hidden bg-black">
                        <iframe
                            src={embedUrl}
                            className="w-full h-full"
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                    </div>
                </div>
            )}

            {/* Content */}
            {training.content_html && (
                <div className="glass-card p-5">
                    <div
                        className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-a:text-primary"
                        dangerouslySetInnerHTML={{ __html: training.content_html }}
                    />
                </div>
            )}

            {/* Mark Complete */}
            {completed ? (
                <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Tick01Icon size={18} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-emerald-800">Selesai!</p>
                        <p className="text-xs text-emerald-600">Item berikutnya kini terbuka.</p>
                    </div>
                    <Link
                        href={`/dashboard/sesi/${sessionId}`}
                        className="text-xs font-semibold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors active:scale-95 shrink-0"
                    >
                        Lanjut →
                    </Link>
                </div>
            ) : (
                <div className="glass-card p-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Sudah selesai membaca?</p>
                    <button
                        onClick={handleMarkComplete}
                        disabled={marking}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-5 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors active:scale-95 disabled:opacity-50 shrink-0"
                    >
                        {marking ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Tick01Icon size={14} />
                        )}
                        Tandai Selesai
                    </button>
                </div>
            )}
        </div>
    );
}
