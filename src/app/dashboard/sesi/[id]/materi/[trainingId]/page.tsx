'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
    ArrowLeft01Icon,
    Book01Icon,
    AlertCircleIcon,
    VideoReplayIcon,
    Image01Icon,
    File01Icon,
    Download01Icon,
    CheckmarkCircle02Icon,
    ArrowRight01Icon,
} from 'hugeicons-react';
import { toast } from 'sonner';

type MediaAttachment = {
    id: string;
    media_type: 'video' | 'image' | 'pdf' | 'document';
    media_url: string;
    original_filename: string | null;
    sequence_order: number;
};

type TrainingData = {
    id: string;
    title: string;
    content_html: string;
    media: MediaAttachment[];
    is_completed?: boolean;
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

/** Renders a single media attachment with clean modern styling */
function MediaRenderer({ item }: { item: MediaAttachment }) {
    if (item.media_type === 'video') {
        const embedUrl = extractYouTubeEmbedUrl(item.media_url);
        if (!embedUrl) return null;
        return (
            <div className="bg-white rounded-xl border border-black/5 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <VideoReplayIcon size={14} className="text-slate-600" />
                    <span>Video Pembelajaran</span>
                </div>
                <div className="aspect-video rounded-lg overflow-hidden bg-slate-900 border border-black/5">
                    <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                </div>
            </div>
        );
    }

    if (item.media_type === 'image') {
        return (
            <div className="bg-white rounded-xl border border-black/5 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Image01Icon size={14} className="text-slate-600" />
                    <span>Gambar Lampiran</span>
                </div>
                <div className="rounded-lg overflow-hidden bg-slate-50 border border-black/5 p-2">
                    <img
                        src={item.media_url}
                        alt={item.original_filename || 'Gambar materi'}
                        className="w-full h-auto max-h-[500px] object-contain mx-auto rounded"
                        loading="lazy"
                    />
                </div>
                {item.original_filename && (
                    <p className="text-[11px] text-muted-foreground text-center font-mono">
                        {item.original_filename}
                    </p>
                )}
            </div>
        );
    }

    if (item.media_type === 'pdf') {
        return (
            <div className="bg-white rounded-xl border border-black/5 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <File01Icon size={14} className="text-slate-600" />
                        <span>Dokumen PDF</span>
                    </div>
                    <a
                        href={item.media_url}
                        download={item.original_filename || 'document.pdf'}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
                    >
                        <Download01Icon size={13} />
                        Unduh PDF
                    </a>
                </div>
                <div className="rounded-lg overflow-hidden border border-black/5" style={{ height: '520px' }}>
                    <iframe
                        src={item.media_url}
                        className="w-full h-full"
                        title={item.original_filename || 'PDF Viewer'}
                    />
                </div>
            </div>
        );
    }

    // Document type (Word, PPT, etc.)
    return (
        <div className="bg-white rounded-xl border border-black/5 p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <File01Icon size={18} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                            {item.original_filename || 'Dokumen Lampiran'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Berkas Pembelajaran</p>
                    </div>
                </div>

                <a
                    href={item.media_url}
                    download={item.original_filename || 'document'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-all shrink-0 shadow-2xs active:scale-98"
                >
                    <Download01Icon size={14} />
                    Unduh
                </a>
            </div>
        </div>
    );
}

export default function MateriViewerPage({ params }: { params: Promise<{ id: string; trainingId: string }> }) {
    const { id: sessionId, trainingId } = use(params);
    const [training, setTraining] = useState<TrainingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [completed, setCompleted] = useState(false);
    const [marking, setMarking] = useState(false);

    useEffect(() => {
        fetch(`/api/participant/sessions/${sessionId}/training/${trainingId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setTraining(data.data);
                    if (data.data.is_completed) {
                        setCompleted(true);
                    }
                } else {
                    setError(data.error || 'Gagal memuat materi');
                }
            })
            .catch(() => setError('Kesalahan jaringan saat memuat materi'))
            .finally(() => setLoading(false));
    }, [sessionId, trainingId]);

    const handleMarkComplete = async () => {
        setMarking(true);
        try {
            const res = await fetch(`/api/participant/sessions/${sessionId}/training/${trainingId}/complete`, {
                method: 'POST',
            });
            const data = await res.json();
            if (data.success) {
                setCompleted(true);
                toast.success('Materi telah diselesaikan! Anda dapat melanjutkan ke item berikutnya.');
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
            <div className="flex items-center justify-center p-20 text-xs font-medium text-muted-foreground animate-pulse">
                Memuat materi pelatihan...
            </div>
        );
    }

    if (error || !training) {
        return (
            <div className="max-w-3xl mx-auto space-y-4 pt-4">
                <Link
                    href={`/dashboard/sesi/${sessionId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                    <ArrowLeft01Icon size={14} /> Kembali ke Sesi
                </Link>
                <div className="bg-white rounded-xl border border-red-200/60 p-8 text-center space-y-3 shadow-2xs">
                    <AlertCircleIcon size={32} className="mx-auto text-red-500" />
                    <h3 className="text-sm font-semibold text-red-700">Akses Tidak Tersedia</h3>
                    <p className="text-xs text-red-600 max-w-sm mx-auto">{error || 'Materi tidak ditemukan'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-5 pb-16">
            {/* Top Navigation */}
            <div className="flex items-center justify-between">
                <Link
                    href={`/dashboard/sesi/${sessionId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                    <ArrowLeft01Icon size={15} /> Kembali ke Sesi Pelatihan
                </Link>

                {completed && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-medium">
                        <CheckmarkCircle02Icon size={12} /> Selesai Dibaca
                    </span>
                )}
            </div>

            {/* Header Title Card */}
            <div className="bg-white rounded-xl border border-black/5 p-5 sm:p-6 shadow-2xs space-y-2">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Book01Icon size={16} />
                    </div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Materi Pelatihan
                    </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight leading-snug">
                    {training.title}
                </h1>
            </div>

            {/* Media Attachments */}
            {training.media && training.media.length > 0 && (
                <div className="space-y-4">
                    {training.media.map((item) => (
                        <MediaRenderer key={item.id} item={item} />
                    ))}
                </div>
            )}

            {/* Main Article Content */}
            {training.content_html && (
                <div className="bg-white rounded-xl border border-black/5 p-6 sm:p-8 shadow-2xs">
                    <article
                        className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-p:text-slate-700 prose-p:leading-relaxed prose-a:text-slate-900 prose-a:underline prose-strong:text-foreground prose-img:rounded-xl prose-img:border prose-img:border-black/5"
                        dangerouslySetInnerHTML={{ __html: training.content_html }}
                    />
                </div>
            )}

            {/* Mark as Complete Action Bar */}
            <div className="bg-white rounded-xl border border-black/5 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {completed ? (
                    <div className="flex items-center gap-3 w-full justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                            <CheckmarkCircle02Icon size={18} className="text-emerald-600 shrink-0" />
                            <span>Materi ini telah Anda selesaikan.</span>
                        </div>
                        <Link
                            href={`/dashboard/sesi/${sessionId}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-all shrink-0 shadow-2xs active:scale-98"
                        >
                            Lanjut ke Sesi <ArrowRight01Icon size={14} />
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="text-xs text-muted-foreground">
                            Pastikan Anda telah membaca materi di atas sebelum menandai selesai.
                        </p>
                        <button
                            onClick={handleMarkComplete}
                            disabled={marking}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all shrink-0 shadow-2xs active:scale-98 disabled:opacity-50"
                        >
                            {marking ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <CheckmarkCircle02Icon size={16} />
                            )}
                            Tandai Selesai
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
