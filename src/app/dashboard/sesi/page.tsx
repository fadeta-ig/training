'use client';

import { useEffect, useState, type ElementType } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    BookOpen,
    CalendarDays,
    CheckCircle2,
    Clock3,
    LockKeyhole,
    PlayCircle,
    ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

type Session = {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    require_seb: boolean;
    module_title: string;
    total_items: number;
    completed_items: number;
};

type SessionStatus = 'active' | 'upcoming' | 'completed' | 'ended';

const STATUS_META: Record<SessionStatus, {
    label: string;
    description: string;
    action: string;
    icon: ElementType;
    badgeClass: string;
}> = {
    active: {
        label: 'Sedang berlangsung',
        description: 'Sesi yang dapat Anda lanjutkan sekarang.',
        action: 'Lanjutkan sesi',
        icon: PlayCircle,
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    upcoming: {
        label: 'Akan datang',
        description: 'Sesi yang belum memasuki jadwal pelaksanaan.',
        action: 'Belum dapat dibuka',
        icon: Clock3,
        badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    },
    completed: {
        label: 'Selesai',
        description: 'Sesi yang seluruh materinya telah Anda selesaikan.',
        action: 'Lihat ringkasan',
        icon: CheckCircle2,
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    ended: {
        label: 'Berakhir',
        description: 'Sesi yang jadwal pelaksanaannya telah berakhir.',
        action: 'Lihat detail',
        icon: Clock3,
        badgeClass: 'border-border bg-muted text-muted-foreground',
    },
};

function getStatus(session: Session, now: Date): SessionStatus {
    if (session.total_items > 0 && session.completed_items >= session.total_items) return 'completed';
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    if (now < start) return 'upcoming';
    if (now <= end) return 'active';
    return 'ended';
}

function formatSchedule(startValue: string, endValue: string) {
    const start = new Date(startValue);
    const end = new Date(endValue);
    const dateFormatter = new Intl.DateTimeFormat('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    });
    const sameDay = start.toDateString() === end.toDateString();

    if (sameDay) {
        return `${dateFormatter.format(start)}, ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
    }

    return `${dateFormatter.format(start)}, ${timeFormatter.format(start)} - ${dateFormatter.format(end)}, ${timeFormatter.format(end)}`;
}

export default function ParticipantSessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/participant/sessions')
            .then((response) => response.json())
            .then((body) => {
                if (body.success) setSessions(body.data);
            })
            .catch(() => undefined)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="mx-auto max-w-6xl space-y-8">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-5 w-80 max-w-full" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-72 rounded-lg" />
                    <Skeleton className="h-72 rounded-lg" />
                </div>
            </div>
        );
    }

    const now = new Date();
    const groups: Array<{ status: SessionStatus; sessions: Session[] }> = [
        { status: 'active', sessions: sessions.filter((session) => getStatus(session, now) === 'active') },
        { status: 'upcoming', sessions: sessions.filter((session) => getStatus(session, now) === 'upcoming') },
        { status: 'completed', sessions: sessions.filter((session) => getStatus(session, now) === 'completed') },
        { status: 'ended', sessions: sessions.filter((session) => getStatus(session, now) === 'ended') },
    ];

    return (
        <div className="mx-auto max-w-6xl space-y-9 pb-12">
            <header className="border-b pb-6">
                <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Sesi Saya</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Pantau jadwal dan progres pelatihan Anda, lalu lanjutkan materi atau ujian dari sesi yang sedang aktif.
                </p>
            </header>

            {sessions.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-14 text-center">
                    <BookOpen className="mx-auto size-9 text-muted-foreground/50" />
                    <h2 className="mt-4 font-medium">Belum ada sesi yang terdaftar</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                        Akun Anda belum dimasukkan ke sesi pelatihan. Hubungi administrator untuk mendapatkan akses.
                    </p>
                </div>
            ) : (
                <div className="space-y-10">
                    {groups.map(({ status, sessions: groupedSessions }) => (
                        groupedSessions.length > 0 ? (
                            <SessionGroup key={status} status={status} sessions={groupedSessions} />
                        ) : null
                    ))}
                </div>
            )}
        </div>
    );
}

function SessionGroup({ status, sessions }: { status: SessionStatus; sessions: Session[] }) {
    const meta = STATUS_META[status];

    return (
        <section aria-labelledby={`session-group-${status}`}>
            <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 id={`session-group-${status}`} className="text-base font-semibold">{meta.label}</h2>
                        <Badge variant="secondary" className="rounded-md px-1.5 tabular-nums">{sessions.length}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {sessions.map((session) => (
                    <SessionCard key={session.id} session={session} status={status} />
                ))}
            </div>
        </section>
    );
}

function SessionCard({ session, status }: { session: Session; status: SessionStatus }) {
    const meta = STATUS_META[status];
    const StatusIcon = meta.icon;
    const progress = session.total_items > 0
        ? Math.round((session.completed_items / session.total_items) * 100)
        : 0;
    const isClickable = status !== 'upcoming';

    const card = (
        <Card className={cn(
            'h-full gap-0 rounded-lg py-0 shadow-none transition-colors',
            isClickable && 'group-hover:ring-foreground/25',
        )}>
            <CardHeader className="gap-4 px-5 pb-4 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className={cn('rounded-md', meta.badgeClass)}>
                        <StatusIcon />
                        {meta.label}
                    </Badge>
                    {session.require_seb && (
                        <Badge variant="outline" className="rounded-md text-muted-foreground">
                            <ShieldCheck /> SEB diperlukan
                        </Badge>
                    )}
                </div>

                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <BookOpen className="size-3.5" />
                        <span className="truncate">{session.module_title || 'Program pelatihan'}</span>
                    </p>
                    <CardTitle className="mt-2 text-lg font-semibold leading-6">{session.title}</CardTitle>
                </div>
            </CardHeader>

            <CardContent className="space-y-5 border-t px-5 py-4">
                <div>
                    <p className="text-xs font-medium text-muted-foreground">Jadwal sesi</p>
                    <p className="mt-1 flex items-start gap-2 text-sm leading-5">
                        <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>{formatSchedule(session.start_time, session.end_time)}</span>
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Progres pembelajaran</span>
                        <span className="font-medium tabular-nums">{progress}%</span>
                    </div>
                    <Progress value={progress} aria-label={`Progres sesi ${progress}%`} />
                    <p className="text-xs text-muted-foreground">
                        {session.completed_items} dari {session.total_items} item selesai
                    </p>
                </div>
            </CardContent>

            <CardFooter className="justify-between gap-3 rounded-b-lg border-t bg-muted/30 px-5 py-3.5">
                <span className="text-sm font-medium">{meta.action}</span>
                {isClickable ? (
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                ) : (
                    <LockKeyhole className="size-4 text-muted-foreground" />
                )}
            </CardFooter>
        </Card>
    );

    if (!isClickable) return card;

    return (
        <Link href={`/dashboard/sesi/${session.id}`} className="group block h-full rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {card}
        </Link>
    );
}
