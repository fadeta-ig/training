'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Award,
    BookOpen,
    CalendarDays,
    Check,
    CheckCircle2,
    Clock3,
    Copy,
    Download,
    FileBadge2,
    FilePenLine,
    ListChecks,
    LockKeyhole,
    LogOut,
    Play,
    Printer,
    RotateCcw,
    ShieldCheck,
    ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { performSebPreflight, SebPreflightError, useIsSeb } from '@/hooks/useSeb';
import { RequestMaterialModal } from '@/components/participant/RequestMaterialModal';
import { formatDualSchedule, normalizeDbDateToIso } from '@/lib/timezone';

type ModuleItem = {
    module_item_id: string;
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
    item_title: string;
    duration_minutes: number | null;
    progress_status: 'locked' | 'open' | 'grading_pending' | 'completed';
    score: number | null;
    passing_grade?: number;
    result_outcome?: 'draft' | 'grading_pending' | 'passed' | 'remedial_required' | 'remedial_exhausted' | 'absent';
    result_published?: boolean;
    remedial_session_id?: string | null;
    can_retake: boolean;
    attempts_count: number;
    max_attempts: number;
};

type SessionDetail = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    server_time?: string;
    require_seb: boolean;
    module_title: string;
    module_id: string;
    session_type?: 'regular' | 'remedial';
    enforce_sequence?: boolean;
    participant_name?: string;
    graduation_status?: 'pending' | 'passed' | 'failed';
    graduation_decided_at?: string | null;
    graduation_notes?: string | null;
    skl_number?: string | null;
    certificate_file_url?: string | null;
    certificate_number?: string | null;
    result_state?: 'draft' | 'published';
    evaluation_status?: 'draft' | 'remedial_required' | 'remedial_exhausted' | 'ready_for_graduation';
    result_publication?: { version: number; published_at: string } | null;
    published_exam_results?: Array<{
        source_exam_id: string;
        exam_title: string;
        best_score: number | null;
        passing_grade: number;
        outcome: 'passed' | 'remedial_required' | 'remedial_exhausted' | 'absent';
        attempts_used: number;
    }>;
    remedial_session?: { id: string; title: string; start_time: string; end_time: string } | null;
    items: ModuleItem[];
};

type SessionState = 'completed' | 'active' | 'upcoming' | 'ended';

const SESSION_STATUS: Record<SessionState, { label: string; className: string }> = {
    completed: { label: 'Selesai', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
    active: { label: 'Sedang berlangsung', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
    upcoming: { label: 'Akan datang', className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300' },
    ended: { label: 'Berakhir (Terkunci)', className: 'border-border bg-muted text-muted-foreground' },
};

function WindowsIcon({ className = 'size-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.401H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.95" />
        </svg>
    );
}

function AppleIcon({ className = 'size-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.88c.64-.78 1.08-1.86.96-2.88-.93.04-2.05.62-2.71 1.4-.58.67-1.09 1.76-.95 2.8 1.04.08 2.09-.54 2.7-1.32z" />
        </svg>
    );
}

export default function ParticipantSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedItemForRequest, setSelectedItemForRequest] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
    const [sebCheckState, setSebCheckState] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [sebCheckMessage, setSebCheckMessage] = useState('');
    const isSeb = useIsSeb();

    const handleSebReadinessCheck = async () => {
        setSebCheckState('checking');
        setSebCheckMessage('Memeriksa Config Key, versi SEB, koneksi, dan izin kamera...');
        try {
            const result = await performSebPreflight(id, { timeoutMs: 15_000 });
            setSebCheckState('success');
            setSebCheckMessage(
                `SEB siap digunakan${result.version ? ` (versi ${result.version})` : ''}${result.mode === 'admin_override' ? ' melalui override admin aktif' : ''}.`,
            );
        } catch (checkError) {
            setSebCheckState('error');
            const code = checkError instanceof SebPreflightError ? ` [${checkError.code}]` : '';
            setSebCheckMessage(`${checkError instanceof Error ? checkError.message : 'Pemeriksaan SEB gagal.'}${code}`);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 10_000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetch(`/api/participant/sessions/${id}`)
            .then((response) => {
                if (response.status === 401) {
                    window.location.replace(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
                    return null;
                }
                return response.json();
            })
            .then((body) => {
                if (!body) return;
                if (body.success) setSession(body.data);
                else setError(body.error || 'Gagal memuat sesi');
            })
            .catch(() => setError('Tidak dapat terhubung ke server. Coba muat ulang halaman.'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-6">
                <Skeleton className="h-5 w-32" />
                <div className="space-y-3 border-b pb-6">
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-9 w-96 max-w-full" />
                    <Skeleton className="h-5 w-72 max-w-full" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-64 rounded-lg" />
                    <Skeleton className="h-64 rounded-lg" />
                </div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="mx-auto max-w-xl space-y-5">
                <Link href="/dashboard/sesi" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                    <ArrowLeft className="size-4" /> Kembali ke Sesi Saya
                </Link>
                <div className="rounded-lg border border-destructive/20 px-6 py-10 text-center">
                    <AlertCircle className="mx-auto size-9 text-destructive" />
                    <h1 className="mt-4 font-medium">Sesi tidak dapat ditampilkan</h1>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{error || 'Data sesi tidak ditemukan.'}</p>
                </div>
            </div>
        );
    }

    const startIso = normalizeDbDateToIso(session.start_time);
    const endIso = normalizeDbDateToIso(session.end_time);
    const start = new Date(startIso);
    const end = new Date(endIso);

    // Calculate server clock offset if available to protect against device clock drift
    const serverOffset = session.server_time ? new Date(session.server_time).getTime() - currentTime : 0;
    const currentAdjustedTime = new Date(currentTime + serverOffset);

    const completedCount = session.items.filter((item) => item.progress_status === 'completed').length;
    const totalItems = session.items.length;
    const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
    const isFullyCompleted = progress === 100 && totalItems > 0;
    
    // Strict time validation: Once time has passed, session is ended and locked
    const isTimeEnded = currentAdjustedTime > end;
    const isActive = !isTimeEnded && currentAdjustedTime >= start;
    const sessionState: SessionState = isTimeEnded
        ? 'ended'
        : isFullyCompleted
            ? 'completed'
            : isActive
                ? 'active'
                : 'upcoming';
    const status = SESSION_STATUS[sessionState];
    const dualSchedule = formatDualSchedule(session.start_time, session.end_time);
    const formattedScheduleString = dualSchedule.fullText;

    return (
        <div className="mx-auto max-w-5xl space-y-8 pb-12">
            <Link href="/dashboard/sesi" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="size-4" /> Kembali ke Sesi Saya
            </Link>

            <header className="grid gap-6 border-b pb-7 md:grid-cols-[minmax(0,1fr)_18rem] md:items-end">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn('rounded-md', status.className)}>
                            {sessionState === 'completed' ? <CheckCircle2 /> : sessionState === 'ended' ? <LockKeyhole /> : <Clock3 />}
                            {status.label}
                        </Badge>
                        {session.require_seb && (
                            <Badge variant="outline" className="rounded-md text-muted-foreground">
                                <ShieldCheck /> Safe Exam Browser
                            </Badge>
                        )}
                    </div>

                    <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-normal sm:text-3xl">{session.title}</h1>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="size-4 shrink-0" />
                        <span>{session.module_title || 'Program pelatihan'}</span>
                    </p>
                    <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                        <CalendarDays className="mt-1 size-4 shrink-0" />
                        <span>{formattedScheduleString}</span>
                    </p>
                </div>

                <div className="space-y-2 md:border-l md:pl-6">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Progres keseluruhan</p>
                            <p className="mt-1 text-sm">{completedCount} dari {totalItems} item selesai</p>
                        </div>
                        <span className="text-2xl font-semibold tabular-nums">{progress}%</span>
                    </div>
                    <Progress value={progress} aria-label={`Progres sesi ${progress}%`} />
                </div>
            </header>

            {session.graduation_status === 'pending' && session.evaluation_status === 'draft' && (
                <section className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/30" role="status">
                    <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
                    <div>
                        <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-200">Hasil sedang diverifikasi</h2>
                        <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-amber-300/80">
                            {session.session_type === 'remedial'
                                ? 'Hasil remedial pada jadwal ini sedang direkap dan belum dipublikasikan oleh administrator.'
                                : 'Nilai dan status remedial belum dipublikasikan oleh administrator.'}
                        </p>
                    </div>
                </section>
            )}

            {session.graduation_status === 'pending' && session.evaluation_status === 'remedial_required' && (
                <section className="flex flex-col justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center dark:border-amber-800 dark:bg-amber-950/40" role="status">
                    <div className="flex items-start gap-3">
                        <RotateCcw className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
                        <div>
                            <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-200">Anda perlu mengikuti remedial</h2>
                            <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-amber-300/80">
                                Terdapat ujian yang belum mencapai passing grade. Nilai tertinggi tetap digunakan setelah remedial.
                            </p>
                            {session.remedial_session && (
                                <p className="mt-2 text-xs font-medium text-amber-950 dark:text-amber-200">
                                    {session.remedial_session.title} · {formatDualSchedule(session.remedial_session.start_time, session.remedial_session.end_time).fullText}
                                </p>
                            )}
                        </div>
                    </div>
                    {session.remedial_session && (
                        <Link href={`/dashboard/sesi/${session.remedial_session.id}`} className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 gap-1.5')}>
                            <RotateCcw className="size-4" /> Buka Sesi Remedial
                        </Link>
                    )}
                </section>
            )}

            {session.graduation_status === 'pending' && session.evaluation_status === 'ready_for_graduation' && (
                <section className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30" role="status">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                    <div>
                        <h2 className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">Tidak perlu remedial</h2>
                        <p className="mt-0.5 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-300/80">
                            Seluruh ujian telah mencapai passing grade. Keputusan kelulusan resmi masih menunggu administrator.
                        </p>
                    </div>
                </section>
            )}

            {session.graduation_status === 'pending' && session.evaluation_status === 'remedial_exhausted' && (
                <section className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-950/30" role="status">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-700 dark:text-red-400" />
                    <div>
                        <h2 className="text-sm font-semibold text-red-950 dark:text-red-200">Evaluasi selesai, passing grade belum terpenuhi</h2>
                        <p className="mt-0.5 text-xs leading-relaxed text-red-900/80 dark:text-red-300/80">
                            Tidak ada sesi remedial lanjutan. Keputusan akhir sedang menunggu administrator.
                        </p>
                    </div>
                </section>
            )}

            {session.published_exam_results && session.published_exam_results.length > 0 && (
                <section className="rounded-xl border bg-card p-4" aria-labelledby="published-results-heading">
                    <div className="flex items-center justify-between gap-3">
                        <h2 id="published-results-heading" className="text-sm font-semibold">Hasil ujian yang dipublikasikan</h2>
                        {session.result_publication && (
                            <span className="text-xs text-muted-foreground">Versi {session.result_publication.version}</span>
                        )}
                    </div>
                    <div className="mt-3 divide-y">
                        {session.published_exam_results.map((result) => (
                            <div key={result.source_exam_id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                                <div>
                                    <p className="text-sm font-medium">{result.exam_title}</p>
                                    <p className="text-xs text-muted-foreground">Passing grade {result.passing_grade.toLocaleString('id-ID')}</p>
                                </div>
                                <p className="text-sm font-semibold tabular-nums">
                                    Nilai tertinggi: {result.best_score === null ? '-' : result.best_score.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                                </p>
                                <Badge variant="outline" className={cn(
                                    'w-fit rounded-md',
                                    result.outcome === 'passed'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : result.outcome === 'remedial_required'
                                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                                            : 'border-red-200 bg-red-50 text-red-700',
                                )}>
                                    {result.outcome === 'passed' ? 'Memenuhi' : result.outcome === 'remedial_required' ? 'Perlu remedial' : result.outcome === 'absent' ? 'Tidak mengikuti' : 'Belum memenuhi'}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Official Graduation & Certification Banner */}
            {session.graduation_status === 'passed' && (
                <section className="flex flex-col justify-between gap-5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/80 p-5 sm:flex-row sm:items-center dark:border-emerald-800/50 dark:bg-emerald-950/40 shadow-xs">
                    <div className="flex items-start gap-3.5">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm shrink-0">
                            <Award className="size-6" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-200/60 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full">
                                    Keputusan Resmi Penguji
                                </span>
                                {session.skl_number && (
                                    <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        {session.skl_number}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                                Selamat! Anda Dinyatakan LULUS
                            </h2>
                            <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed max-w-xl">
                                {session.graduation_notes || 'Anda telah memenuhi seluruh kriteria kelulusan dan standar kompetensi program pelatihan ini.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                        {/* Download SKL Button */}
                        <a
                            href={`/api/participant/sessions/${session.id}/skl`}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 border-emerald-300 bg-white hover:bg-emerald-100/70 text-emerald-900 font-semibold shadow-2xs')}
                        >
                            <Printer className="size-3.5 text-emerald-700" />
                            <span>Unduh SKL (PDF)</span>
                        </a>

                        {/* Official Certificate Button */}
                        {session.certificate_file_url ? (
                            <a
                                href={session.certificate_file_url}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs')}
                            >
                                <FileBadge2 className="size-4" />
                                <span>Unduh Sertifikat Resmi</span>
                            </a>
                        ) : (
                            <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 italic font-medium px-2">
                                Sertifikat resmi sedang diproses
                            </span>
                        )}
                    </div>
                </section>
            )}

            {session.graduation_status === 'failed' && (
                <section className="flex items-start gap-3.5 rounded-xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 shrink-0">
                        <AlertCircle className="size-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-red-950 dark:text-red-200">
                            Hasil Evaluasi: Belum Memenuhi Syarat Kelulusan
                        </h2>
                        <p className="text-xs text-red-900/80 dark:text-red-300/80 mt-0.5 leading-relaxed">
                            {session.graduation_notes || 'Berdasarkan evaluasi akhir oleh tim penguji, nilai atau persyaratan kompetensi Anda belum memenuhi batas minimal kelulusan.'}
                        </p>
                    </div>
                </section>
            )}

            {/* Session Ended Informational Callout */}
            {isTimeEnded && (
                <section className="flex flex-col justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4.5 sm:flex-row sm:items-center dark:border-amber-900/50 dark:bg-amber-950/30">
                    <div className="flex items-start gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 shrink-0 dark:bg-amber-500/20 dark:text-amber-400">
                            <LockKeyhole className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                                Sesi Pelatihan Telah Berakhir
                            </h2>
                            <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                                Seluruh materi dan ujian telah dikunci secara otomatis. Jika Anda memerlukan materi untuk pembelajaran mandiri, silakan salin format pesan permohonan ke Trainer.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSelectedItemForRequest(session.module_title || session.title)}
                        className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium')}
                    >
                        <Copy className="size-3.5" />
                        Minta Materi ke Trainer
                    </button>
                </section>
            )}

            {session.require_seb && !isSeb && !isTimeEnded && (
                <section className="relative overflow-hidden rounded-2xl border border-amber-300/80 bg-linear-to-br from-amber-50/90 via-white to-amber-50/40 p-6 shadow-xs dark:border-amber-900/50 dark:from-slate-900 dark:via-slate-900/90 dark:to-amber-950/20">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/25 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30">
                                <ShieldCheck className="size-6" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                                        <LockKeyhole className="size-3" /> Safe Exam Browser Required
                                    </span>
                                </div>
                                <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                    Sesi Ini Mewajibkan Safe Exam Browser (SEB)
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                                    Materi belajar dapat dipelajari melalui browser biasa. Namun untuk membuka dan mengerjakan modul evaluasi/ujian, Anda wajib membukanya via aplikasi Safe Exam Browser demi keamanan dan integritas pengerjaan.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-1 lg:pt-0">
                            <a
                                href={typeof window !== 'undefined' && window.location.protocol === 'https:'
                                    ? `sebs://${window.location.host}/api/participant/sessions/${session.id}/seb-config`
                                    : typeof window !== 'undefined'
                                        ? `seb://${window.location.host}/api/participant/sessions/${session.id}/seb-config`
                                        : `/api/participant/sessions/${session.id}/seb-config`
                                }
                                className={cn(
                                    buttonVariants({ size: 'default' }),
                                    'gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs hover:shadow transition-all'
                                )}
                            >
                                <ExternalLink className="size-4" /> Buka Langsung di SEB
                            </a>
                            <a
                                href={`/api/participant/sessions/${session.id}/seb-config`}
                                download
                                className={cn(
                                    buttonVariants({ variant: 'outline', size: 'default' }),
                                    'gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50 font-medium shadow-2xs transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                )}
                            >
                                <Download className="size-4" /> Unduh File (.seb)
                            </a>
                        </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-amber-200/70 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
                                <WindowsIcon className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="font-semibold text-slate-900 dark:text-slate-100 mr-1.5">Windows:</span>
                                <span>Gunakan SEB 3.10.2 pada Windows 10 1803+/11. Keluar:</span>
                                <kbd className="ml-1.5 inline-flex items-center rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    Ctrl + Q
                                </kbd>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                <AppleIcon className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="font-semibold text-slate-900 dark:text-slate-100 mr-1.5">macOS:</span>
                                <span>Gunakan SEB 3.7.1 pada macOS 12+ dan izinkan kamera. Keluar:</span>
                                <kbd className="ml-1.5 inline-flex items-center rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    Cmd + Q
                                </kbd>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {isSeb && session.require_seb && !isTimeEnded && (
                <section className={cn(
                    'flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
                    sebCheckState === 'success'
                        ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30'
                        : sebCheckState === 'error'
                            ? 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40',
                )}>
                    <div className="flex items-start gap-3">
                        <ShieldCheck className={cn(
                            'mt-0.5 size-5 shrink-0',
                            sebCheckState === 'success' ? 'text-emerald-700' : sebCheckState === 'error' ? 'text-red-700' : 'text-slate-600',
                        )} />
                        <div>
                            <h2 className="text-sm font-semibold">Pemeriksaan kesiapan SEB</h2>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {sebCheckMessage || 'Jalankan pemeriksaan sebelum hari ujian untuk memastikan Config Key dan kamera dapat digunakan.'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleSebReadinessCheck}
                        disabled={sebCheckState === 'checking'}
                        className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
                    >
                        {sebCheckState === 'checking' ? 'Memeriksa...' : sebCheckState === 'success' ? 'Periksa ulang' : 'Cek SEB & kamera'}
                    </button>
                </section>
            )}

            {isSeb && (
                <div className="flex justify-end">
                    <a href="/quit-seb" className={buttonVariants({ variant: 'destructive' })}>
                        <LogOut /> Keluar dari aplikasi SEB
                    </a>
                </div>
            )}

            <section aria-labelledby="session-content-title">
                <div className="mb-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ListChecks className="size-5 text-muted-foreground" />
                            <h2 id="session-content-title" className="text-lg font-semibold">Materi dan ujian</h2>
                        </div>
                        {!session.enforce_sequence ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Alur Fleksibel: Akses Bebas
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                <LockKeyhole className="size-3" />
                                Alur Bertahap: Berurutan
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {isTimeEnded
                            ? 'Masa pengerjaan sesi telah selesai. Modul materi dan ujian berada dalam status terkunci.'
                            : session.enforce_sequence
                                ? 'Selesaikan setiap item sesuai urutan. Item berikutnya akan terbuka setelah item sebelumnya selesai.'
                                : 'Modul ini menggunakan alur terbuka. Anda dapat mempelajari materi dan mengerjakan ujian secara bebas tanpa harus berurutan.'}
                    </p>
                </div>

                {session.items.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-6 py-12 text-center">
                        <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
                        <h3 className="mt-3 font-medium">Belum ada materi atau ujian</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Administrator belum menambahkan isi untuk sesi ini.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {session.items.map((item, index) => (
                            <SessionItemCard
                                key={item.module_item_id}
                                item={item}
                                index={index + 1}
                                sessionId={session.id}
                                sessionState={sessionState}
                                isSessionActive={isActive}
                                isSessionEnded={isTimeEnded}
                                requireSeb={session.require_seb}
                                isSeb={isSeb}
                                onRequestMaterial={(title) => setSelectedItemForRequest(title)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Modal Dialog for Requesting Material */}
            <RequestMaterialModal
                isOpen={!!selectedItemForRequest}
                onClose={() => setSelectedItemForRequest(null)}
                sessionTitle={session.title}
                moduleTitle={session.module_title}
                itemTitle={selectedItemForRequest || undefined}
                participantName={session.participant_name}
                sessionSchedule={formattedScheduleString}
            />
        </div>
    );
}

function SessionItemCard({
    item,
    index,
    sessionId,
    sessionState,
    isSessionActive,
    isSessionEnded,
    requireSeb,
    isSeb,
    onRequestMaterial,
}: {
    item: ModuleItem;
    index: number;
    sessionId: string;
    sessionState: SessionState;
    isSessionActive: boolean;
    isSessionEnded: boolean;
    requireSeb: boolean;
    isSeb: boolean;
    onRequestMaterial: (itemTitle: string) => void;
}) {
    const isCompleted = item.progress_status === 'completed';
    const isLocked = item.progress_status === 'locked';
    const isGradingPending = item.progress_status === 'grading_pending';
    const isExam = item.item_type === 'exam';
    const isTraining = item.item_type === 'training';
    const sebLocked = isExam && requireSeb && !isSeb;

    // Strict Lock: When session is ended, no direct access to either training or exam is permitted
    const canAccess = !isSessionEnded && (
        (isTraining && !isLocked && (isSessionActive || isCompleted)) ||
        (isExam && isSessionActive && !isLocked && !isGradingPending && !sebLocked) ||
        (isExam && isCompleted && item.can_retake && isSessionActive && !sebLocked)
    );

    const href = isExam
        ? `/dashboard/sesi/${sessionId}/ujian/${item.item_id}`
        : `/dashboard/sesi/${sessionId}/materi/${item.item_id}`;

    let statusLabel = 'Terkunci';
    let statusClass = 'border-border bg-muted text-muted-foreground';

    if (isSessionEnded) {
        if (isCompleted) {
            statusLabel = 'Selesai (Terkunci)';
            statusClass = 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';
        } else {
            statusLabel = 'Sesi Berakhir';
            statusClass = 'border-border bg-muted text-muted-foreground';
        }
    } else if (isGradingPending) {
        statusLabel = 'Menunggu penilaian esai';
        statusClass = 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300';
    } else if (isCompleted && item.result_outcome === 'remedial_required') {
        statusLabel = 'Perlu remedial';
        statusClass = 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300';
    } else if (isCompleted && item.result_outcome === 'passed') {
        statusLabel = 'Tidak perlu remedial';
        statusClass = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300';
    } else if (isCompleted && item.can_retake) {
        statusLabel = 'Remedial tersedia';
        statusClass = 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300';
    } else if (isCompleted) {
        statusLabel = 'Selesai';
        statusClass = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300';
    } else if (item.progress_status === 'open' && isSessionActive) {
        statusLabel = 'Siap dikerjakan';
        statusClass = 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300';
    }

    let unavailableMessage = 'Selesaikan item sebelumnya untuk membuka item ini.';
    if (isSessionEnded) {
        unavailableMessage = isExam
            ? 'Ujian telah dikunci karena jadwal sesi telah berakhir.'
            : 'Materi telah dikunci karena jadwal sesi telah berakhir.';
    } else if (sebLocked) {
        unavailableMessage = 'Buka sesi melalui Safe Exam Browser untuk mengerjakan ujian ini.';
    } else if (sessionState === 'upcoming') {
        unavailableMessage = 'Item tersedia setelah jadwal sesi dimulai.';
    } else if (isCompleted && isExam && !item.can_retake) {
        unavailableMessage = 'Ujian telah diselesaikan dan tidak memerlukan pengerjaan ulang.';
    } else if (isGradingPending) {
        unavailableMessage = 'Jawaban esai sedang dinilai. Nilai dan status kelulusan belum tersedia.';
    }

    let actionLabel = isExam ? 'Mulai ujian' : 'Buka materi';
    if (isTraining && isCompleted) actionLabel = 'Buka kembali materi';
    if (isExam && item.can_retake) actionLabel = 'Kerjakan remedial';

    const ItemIcon = isExam ? FilePenLine : BookOpen;

    return (
        <Card className="gap-0 rounded-lg py-0 shadow-none">
            <CardHeader className="gap-4 px-5 pb-4 pt-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span className="flex size-7 items-center justify-center rounded-md border bg-muted/40 tabular-nums">{index}</span>
                        <span className="flex items-center gap-1.5">
                            <ItemIcon className="size-3.5" /> {isExam ? 'Ujian' : 'Materi'}
                        </span>
                    </div>
                    <Badge variant="outline" className={cn('rounded-md', statusClass)}>
                        {isCompleted && !isSessionEnded ? <Check /> : isLocked || isSessionEnded ? <LockKeyhole /> : <Clock3 />}
                        {statusLabel}
                    </Badge>
                </div>
                <CardTitle className="text-base font-semibold leading-6">{item.item_title || 'Tanpa judul'}</CardTitle>
            </CardHeader>

            <CardContent className="border-t px-5 py-4">
                <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
                    <div>
                        <dt className="text-xs text-muted-foreground">Jenis item</dt>
                        <dd className="mt-1 font-medium">{isExam ? 'Evaluasi' : 'Materi pembelajaran'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-muted-foreground">Status</dt>
                        <dd className="mt-1 font-medium">
                            {isCompleted ? 'Sudah selesai' : isGradingPending ? 'Menunggu penilaian' : item.progress_status === 'open' && !isSessionEnded ? 'Belum selesai' : 'Tidak tersedia'}
                        </dd>
                    </div>
                    {isExam && (
                        <>
                            <div>
                                <dt className="text-xs text-muted-foreground">Durasi ujian</dt>
                                <dd className="mt-1 flex items-center gap-1.5 font-medium">
                                    <Clock3 className="size-3.5" /> {item.duration_minutes || 0} menit
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">Percobaan</dt>
                                <dd className="mt-1 font-medium tabular-nums">{item.attempts_count} dari {item.max_attempts}</dd>
                            </div>
                        </>
                    )}
                    {isExam && isCompleted && (
                        <div>
                            <dt className="text-xs text-muted-foreground">Nilai tertinggi</dt>
                            <dd className="mt-1">
                                {item.score !== null ? (
                                    <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                        {Number(item.score).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 px-2 py-0.5 rounded-md">
                                        Tahap Evaluasi & Rekap
                                    </span>
                                )}
                            </dd>
                        </div>
                    )}
                </dl>
            </CardContent>

            <CardFooter className="min-h-16 justify-between gap-3 rounded-b-lg border-t bg-muted/30 px-5 py-3">
                {canAccess ? (
                    <>
                        <span className="text-xs text-muted-foreground">
                            {isCompleted && isTraining ? 'Materi dapat dibaca kembali.' : 'Item siap dibuka.'}
                        </span>
                        <Link href={href} className={buttonVariants({ size: 'lg' })}>
                            {item.can_retake ? <RotateCcw /> : <Play />}
                            {actionLabel}
                            <ArrowRight />
                        </Link>
                    </>
                ) : isSessionEnded && isTraining ? (
                    <div className="flex w-full items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <LockKeyhole className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>Materi telah dikunci.</span>
                        </p>
                        <button
                            type="button"
                            onClick={() => onRequestMaterial(item.item_title)}
                            className={cn(
                                buttonVariants({ variant: 'outline', size: 'sm' }),
                                'gap-1.5 border-amber-300 bg-amber-50/70 text-amber-900 hover:bg-amber-100 hover:text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            )}
                        >
                            <Copy className="size-3.5" />
                            <span>Minta Materi</span>
                        </button>
                    </div>
                ) : (
                    <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
                        <span>{unavailableMessage}</span>
                    </p>
                )}
            </CardFooter>
        </Card>
    );
}
