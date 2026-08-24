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
    Copy01Icon,
    CheckmarkBadge01Icon,
    LockIcon,
    InformationCircleIcon,
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
            <div className="bg-white rounded-xl border border-black/5 p-4 space-y-3 shadow-2xs dark:bg-card dark:border-white/10">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <VideoReplayIcon size={14} className="text-slate-600 dark:text-slate-400" />
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
            <div className="bg-white rounded-xl border border-black/5 p-4 space-y-3 shadow-2xs dark:bg-card dark:border-white/10">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Image01Icon size={14} className="text-slate-600 dark:text-slate-400" />
                    <span>Gambar Lampiran</span>
                </div>
                <div className="rounded-lg overflow-hidden bg-slate-50 border border-black/5 p-2 dark:bg-muted/30 dark:border-white/10">
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
            <div className="bg-white rounded-xl border border-black/5 p-4 space-y-3 shadow-2xs dark:bg-card dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <File01Icon size={14} className="text-slate-600 dark:text-slate-400" />
                        <span>Dokumen PDF</span>
                    </div>
                    <a
                        href={item.media_url}
                        download={item.original_filename || 'document.pdf'}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
                    >
                        <Download01Icon size={13} />
                        Unduh PDF
                    </a>
                </div>
                <div className="rounded-lg overflow-hidden border border-black/5 dark:border-white/10" style={{ height: '520px' }}>
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
        <div className="bg-white rounded-xl border border-black/5 p-4 shadow-2xs dark:bg-card dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 dark:bg-muted dark:text-slate-300">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-all shrink-0 shadow-2xs active:scale-98 dark:bg-primary dark:text-primary-foreground"
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
    const [isSessionEnded, setIsSessionEnded] = useState(false);
    const [sessionTitle, setSessionTitle] = useState('');
    const [completed, setCompleted] = useState(false);
    const [marking, setMarking] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetch(`/api/participant/sessions/${sessionId}/training/${trainingId}`)
            .then(async (res) => {
                const data = await res.json();
                if (data.success) {
                    setTraining(data.data);
                    if (data.data.is_completed) {
                        setCompleted(true);
                    }
                } else {
                    if (data.code === 'SESSION_ENDED' || res.status === 403) {
                        setIsSessionEnded(true);
                        setSessionTitle(data.session_title || 'Sesi Pelatihan');
                    }
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
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            let data: any = null;
            const text = await res.text();
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                toast.error(`Terjadi kesalahan server (Status ${res.status})`);
                return;
            }

            if (res.ok && data?.success) {
                setCompleted(true);
                toast.success('Materi telah diselesaikan! Anda dapat melanjutkan ke item berikutnya.');
            } else {
                toast.error(data?.error || data?.message || `Gagal menandai selesai (Status ${res.status})`);
            }
        } catch {
            toast.error('Gagal terhubung ke server. Periksa koneksi internet Anda.');
        } finally {
            setMarking(false);
        }
    };

    const requestTemplate = `Halo Bapak/Ibu Trainer & Panitia Pelatihan,

Saya bermaksud mengajukan permohonan salinan materi pembelajaran:
• Sesi Pelatihan: ${sessionTitle || 'Sesi Pelatihan'}
• ID Modul: ${trainingId}

Dikarenakan batas waktu jadwal sesi telah berakhir di sistem LMS, modul materi telah dikunci secara otomatis. Saya bermaksud meminta berkas materi terkait untuk kebutuhan pembelajaran mandiri dan arsip.

Terima kasih atas bantuan dan bimbingannya.`;

    const handleCopyRequest = async () => {
        try {
            await navigator.clipboard.writeText(requestTemplate);
            setCopied(true);
            toast.success('Format permohonan materi berhasil disalin!');
            setTimeout(() => setCopied(false), 3000);
        } catch {
            toast.error('Gagal menyalin otomatis. Silakan salin teks manual.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20 text-xs font-medium text-muted-foreground animate-pulse">
                Memuat materi pelatihan...
            </div>
        );
    }

    // Locked Screen when session has ended
    if (isSessionEnded) {
        return (
            <div className="max-w-2xl mx-auto space-y-5 pt-6 pb-16">
                <Link
                    href={`/dashboard/sesi/${sessionId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                    <ArrowLeft01Icon size={14} /> Kembali ke Halaman Sesi
                </Link>

                <div className="bg-white rounded-2xl border border-amber-200/80 p-6 sm:p-8 space-y-6 shadow-sm dark:bg-card dark:border-amber-900/50">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 dark:bg-amber-500/20 dark:text-amber-400">
                            <LockIcon size={26} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground tracking-tight">
                                Materi Telah Dikunci (Sesi Berakhir)
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                Jadwal pelaksanaan sesi pelatihan ini telah berakhir. Sesuai ketentuan, akses langsung ke materi dan dokumen di portal telah ditutup otomatis.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 flex items-start gap-2.5 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200">
                        <InformationCircleIcon size={16} className="shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                        <p className="leading-relaxed">
                            Jika Anda memerlukan dokumen atau bahan pembelajaran ini untuk arsip, silakan salin format pesan di bawah dan kirimkan ke <strong>Trainer / Panitia Pelatihan</strong> melalui channel komunikasi resmi Anda.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                            Format Pesan Permohonan Materi:
                        </label>
                        <pre className="w-full whitespace-pre-wrap rounded-xl border border-black/10 bg-slate-50 p-4 text-xs font-mono leading-relaxed text-foreground select-all dark:border-white/10 dark:bg-muted/20">
                            {requestTemplate}
                        </pre>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                        <Link
                            href={`/dashboard/sesi/${sessionId}`}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-input bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        >
                            <ArrowLeft01Icon size={14} />
                            Kembali ke Daftar Sesi
                        </Link>
                        <button
                            type="button"
                            onClick={handleCopyRequest}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all active:scale-98 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                        >
                            {copied ? (
                                <>
                                    <CheckmarkBadge01Icon size={15} className="text-emerald-300" />
                                    <span>Pesan Berhasil Disalin!</span>
                                </>
                            ) : (
                                <>
                                    <Copy01Icon size={15} />
                                    <span>Salin Template Pesan</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
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
                <div className="bg-white rounded-xl border border-red-200/60 p-8 text-center space-y-3 shadow-2xs dark:bg-card dark:border-red-900/50">
                    <AlertCircleIcon size={32} className="mx-auto text-red-500" />
                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Akses Tidak Tersedia</h3>
                    <p className="text-xs text-red-600 dark:text-red-300 max-w-sm mx-auto">{error || 'Materi tidak ditemukan'}</p>
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-medium dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        <CheckmarkCircle02Icon size={12} /> Selesai Dibaca
                    </span>
                )}
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-xl border border-black/5 shadow-2xs overflow-hidden dark:bg-card dark:border-white/10">
                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-black/5 space-y-3 dark:border-white/10">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Book01Icon size={14} className="text-slate-600 dark:text-slate-400" />
                        <span>Materi Pembelajaran</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-snug">
                        {training.title}
                    </h1>
                </div>

                {/* HTML Content */}
                <div className="p-6 sm:p-8">
                    <div
                        className="prose prose-slate max-w-none text-sm leading-relaxed text-foreground dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: training.content_html }}
                    />
                </div>
            </div>

            {/* Media Attachments Section */}
            {training.media && training.media.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        Lampiran & Berkas Pendukung ({training.media.length})
                    </h2>
                    <div className="space-y-3">
                        {training.media.map((item) => (
                            <MediaRenderer key={item.id} item={item} />
                        ))}
                    </div>
                </div>
            )}

            {/* Completion Action Footer */}
            <div className="bg-white rounded-xl border border-black/5 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs dark:bg-card dark:border-white/10">
                <div className="text-center sm:text-left">
                    <p className="text-xs font-medium text-foreground">
                        {completed ? 'Materi telah selesai Anda pelajari' : 'Selesai membaca materi ini?'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {completed
                            ? 'Anda dapat kembali ke daftar sesi untuk melanjutkan ke tahap berikutnya.'
                            : 'Tandai selesai untuk membuka item pembelajaran atau ujian selanjutnya.'}
                    </p>
                </div>

                {completed ? (
                    <Link
                        href={`/dashboard/sesi/${sessionId}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-all shadow-2xs shrink-0 active:scale-98 dark:bg-primary dark:text-primary-foreground"
                    >
                        Lanjutkan ke Sesi
                        <ArrowRight01Icon size={14} />
                    </Link>
                ) : (
                    <button
                        onClick={handleMarkComplete}
                        disabled={marking}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs shrink-0 active:scale-98 cursor-pointer disabled:cursor-not-allowed"
                    >
                        <CheckmarkCircle02Icon size={16} />
                        {marking ? 'Menyimpan progres...' : 'Tandai Selesai & Lanjutkan'}
                    </button>
                )}
            </div>
        </div>
    );
}
