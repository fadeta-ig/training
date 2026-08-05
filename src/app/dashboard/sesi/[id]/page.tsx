'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CalendarDays,
    Check,
    CheckCircle2,
    Clock3,
    Download,
    FilePenLine,
    ListChecks,
    LockKeyhole,
    LogOut,
    Play,
    RotateCcw,
    ShieldCheck,
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

type ModuleItem = {
    module_item_id: string;
    item_type: 'training' | 'exam';
    item_id: string;
    sequence_order: number;
    item_title: string;
    duration_minutes: number | null;
    progress_status: 'locked' | 'open' | 'completed';
    score: number | null;
    can_retake: boolean;
    attempts_count: number;
    max_attempts: number;
};

type SessionDetail = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    module_title: string;
    module_id: string;
    items: ModuleItem[];
};

type SessionState = 'completed' | 'active' | 'upcoming' | 'ended';

const SESSION_STATUS: Record<SessionState, { label: string; className: string }> = {
    completed: { label: 'Selesai', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    active: { label: 'Sedang berlangsung', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    upcoming: { label: 'Akan datang', className: 'border-sky-200 bg-sky-50 text-sky-700' },
    ended: { label: 'Berakhir', className: 'border-border bg-muted text-muted-foreground' },
};

function formatSchedule(start: Date, end: Date) {
    const dateFormatter = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    });

    if (start.toDateString() === end.toDateString()) {
        return `${dateFormatter.format(start)}, ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
    }

    return `${dateFormatter.format(start)}, ${timeFormatter.format(start)} - ${dateFormatter.format(end)}, ${timeFormatter.format(end)}`;
}

export default function ParticipantSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [session, setSession] = useState<SessionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSeb] = useState(() =>
        typeof navigator !== 'undefined' && navigator.userAgent.includes('SafeExamBrowser')
    );

    useEffect(() => {
        fetch(`/api/participant/sessions/${id}`)
            .then((response) => response.json())
            .then((body) => {
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

    const now = new Date();
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    const completedCount = session.items.filter((item) => item.progress_status === 'completed').length;
    const totalItems = session.items.length;
    const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
    const isFullyCompleted = progress === 100 && totalItems > 0;
    const isActive = !isFullyCompleted && now >= start && now <= end;
    const sessionState: SessionState = isFullyCompleted
        ? 'completed'
        : isActive
            ? 'active'
            : now < start
                ? 'upcoming'
                : 'ended';
    const status = SESSION_STATUS[sessionState];

    return (
        <div className="mx-auto max-w-5xl space-y-8 pb-12">
            <Link href="/dashboard/sesi" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="size-4" /> Kembali ke Sesi Saya
            </Link>

            <header className="grid gap-6 border-b pb-7 md:grid-cols-[minmax(0,1fr)_18rem] md:items-end">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn('rounded-md', status.className)}>
                            {sessionState === 'completed' ? <CheckCircle2 /> : <Clock3 />}
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
                        <span>{formatSchedule(start, end)}</span>
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

            {session.require_seb && !isSeb && (
                <section className="flex flex-col justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center">
                    <div className="flex gap-3">
                        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
                        <div>
                            <h2 className="text-sm font-medium text-amber-950">Ujian memerlukan Safe Exam Browser</h2>
                            <p className="mt-1 text-sm leading-5 text-amber-900/70">
                                Materi tetap dapat dibuka di browser ini. Untuk mengerjakan ujian, unduh konfigurasi lalu buka sesi melalui aplikasi SEB.
                            </p>
                        </div>
                    </div>
                    <a
                        href={`/api/participant/sessions/${session.id}/seb-config`}
                        className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'border-amber-300 bg-white text-amber-950 hover:bg-amber-100')}
                    >
                        <Download /> Unduh konfigurasi SEB
                    </a>
                </section>
            )}

            {isSeb && (
                <div className="flex justify-end">
                    <Link href="/quit-seb" className={buttonVariants({ variant: 'destructive' })}>
                        <LogOut /> Keluar dari aplikasi SEB
                    </Link>
                </div>
            )}

            <section aria-labelledby="session-content-title">
                <div className="mb-5">
                    <div className="flex items-center gap-2">
                        <ListChecks className="size-5 text-muted-foreground" />
                        <h2 id="session-content-title" className="text-lg font-semibold">Materi dan ujian</h2>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Selesaikan setiap item sesuai urutan. Item berikutnya akan terbuka setelah item sebelumnya selesai.
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
                                requireSeb={session.require_seb}
                                isSeb={isSeb}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function SessionItemCard({
    item,
    index,
    sessionId,
    sessionState,
    isSessionActive,
    requireSeb,
    isSeb,
}: {
    item: ModuleItem;
    index: number;
    sessionId: string;
    sessionState: SessionState;
    isSessionActive: boolean;
    requireSeb: boolean;
    isSeb: boolean;
}) {
    const isCompleted = item.progress_status === 'completed';
    const isLocked = item.progress_status === 'locked';
    const isExam = item.item_type === 'exam';
    const isTraining = item.item_type === 'training';
    const sebLocked = isExam && requireSeb && !isSeb;
    const canAccess = (isTraining && isCompleted)
        || (isSessionActive && !isLocked && !sebLocked)
        || (isExam && isCompleted && item.can_retake && isSessionActive && !sebLocked);
    const href = isExam
        ? `/dashboard/sesi/${sessionId}/ujian/${item.item_id}`
        : `/dashboard/sesi/${sessionId}/materi/${item.item_id}`;

    let statusLabel = 'Terkunci';
    let statusClass = 'border-border bg-muted text-muted-foreground';
    if (isCompleted && item.can_retake) {
        statusLabel = 'Remedial tersedia';
        statusClass = 'border-amber-200 bg-amber-50 text-amber-700';
    } else if (isCompleted) {
        statusLabel = 'Selesai';
        statusClass = 'border-emerald-200 bg-emerald-50 text-emerald-700';
    } else if (item.progress_status === 'open' && isSessionActive) {
        statusLabel = 'Siap dikerjakan';
        statusClass = 'border-sky-200 bg-sky-50 text-sky-700';
    }

    let unavailableMessage = 'Selesaikan item sebelumnya untuk membuka item ini.';
    if (sebLocked) unavailableMessage = 'Buka sesi melalui Safe Exam Browser untuk mengerjakan ujian ini.';
    else if (sessionState === 'upcoming') unavailableMessage = 'Item tersedia setelah jadwal sesi dimulai.';
    else if (sessionState === 'ended' && !isCompleted) unavailableMessage = 'Item tidak lagi tersedia karena sesi telah berakhir.';
    else if (isCompleted && isExam && !item.can_retake) unavailableMessage = 'Ujian telah diselesaikan dan tidak memerlukan pengerjaan ulang.';

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
                        {isCompleted ? <Check /> : isLocked ? <LockKeyhole /> : <Clock3 />}
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
                        <dd className="mt-1 font-medium">{isCompleted ? 'Sudah selesai' : item.progress_status === 'open' ? 'Belum selesai' : 'Belum tersedia'}</dd>
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
                    {isExam && isCompleted && item.score !== null && (
                        <div>
                            <dt className="text-xs text-muted-foreground">Nilai terakhir</dt>
                            <dd className="mt-1 font-semibold tabular-nums text-emerald-700">
                                {Number(item.score).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
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
